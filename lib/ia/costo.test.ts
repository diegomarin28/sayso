import { describe, expect, it } from "vitest";
import { z } from "zod";
import { evento, manejar } from "../intake/entrada";
import { AcumuladorUso, calcularUso, medirCosto, MODELOS, registrarUso, totalUsd } from "./claude";

describe("calcularUso", () => {
  it("Sonnet: entrada, salida, caché escrita (1,25x), caché leída (0,1x) y búsquedas web", () => {
    const u = calcularUso("x", MODELOS.vision, {
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_input_tokens: 2000,
      cache_read_input_tokens: 10000,
      server_tool_use: { web_search_requests: 3 },
    });
    expect(u.usd).toBeCloseTo((1000 * 2 + 2000 * 2 * 1.25 + 10000 * 0.2 + 500 * 10) / 1e6 + 3 * 0.01, 10);
    expect(u).toMatchObject({ entrada: 1000, salida: 500, cacheEscrita: 2000, cacheLeida: 10000, busquedas: 3 });
  });

  it("Haiku: más barato, y tarifa larga si el prompt pasa los 100K tokens", () => {
    expect(calcularUso("x", MODELOS.corto, { input_tokens: 10_000, output_tokens: 1000 }).usd).toBeCloseTo((10_000 * 0.1 + 1000 * 0.5) / 1e6, 10);
    expect(calcularUso("x", MODELOS.corto, { input_tokens: 150_000, output_tokens: 1000 }).usd).toBeCloseTo((150_000 * 0.5 + 1000 * 2.5) / 1e6, 10);
  });

  it("un modelo sin precio se cuenta como Sonnet (no subestimar)", () => {
    expect(calcularUso("x", "otro-modelo", { input_tokens: 1000 }).usd).toBeCloseTo(0.002, 10);
  });
});

describe("AcumuladorUso", () => {
  it("junta el usage del inicio del stream con el del delta final", () => {
    const a = new AcumuladorUso("chat", MODELOS.vision);
    a.ver({ type: "message_start", message: { usage: { input_tokens: 100, output_tokens: 1, cache_read_input_tokens: 900 } } } as never);
    a.ver({ type: "message_delta", delta: {}, usage: { output_tokens: 50, input_tokens: null } } as never);
    expect(a.uso()).toMatchObject({ entrada: 100, salida: 50, cacheLeida: 900 });
  });
});

describe("medirCosto", () => {
  it("junta los usos de las llamadas hechas adentro, aunque sean asíncronas", async () => {
    const { resultado, usos } = await medirCosto(async () => {
      await Promise.resolve();
      registrarUso(calcularUso("a", MODELOS.corto, { input_tokens: 10 }));
      await new Promise((r) => setTimeout(r, 1));
      registrarUso(calcularUso("b", MODELOS.corto, { input_tokens: 20 }));
      return 42;
    });
    expect(resultado).toBe(42);
    expect(usos.map((u) => u.etapa)).toEqual(["a", "b"]);
    expect(totalUsd(usos)).toBeCloseTo(30 * 0.1 / 1e6, 12);
  });

  it("afuera de una medición no junta nada (solo queda en el log)", async () => {
    registrarUso(calcularUso("suelto", MODELOS.corto, { input_tokens: 1 }));
    const { usos } = await medirCosto(async () => 0);
    expect(usos).toEqual([]);
  });
});

describe("manejar", () => {
  const pedido = (cuerpo: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(cuerpo) });

  it("suma un evento de costo al final, con el caso y el agente del primer evento", async () => {
    const res = await manejar(pedido({ casoId: "c7" }), z.object({ casoId: z.string() }), async ({ casoId }) => {
      registrarUso(calcularUso("identificador: leer chapa", MODELOS.vision, { input_tokens: 2000, output_tokens: 300 }));
      return { ok: true, eventos: [evento(casoId, "identificador", "chapa_leida", "Leí la chapa.")] };
    });
    const json = (await res.json()) as { eventos: { agente: string; tipo: string; casoId: string; mensaje: string; datos: { usd: number } }[] };
    expect(json.eventos).toHaveLength(2);
    expect(json.eventos[1]).toMatchObject({ casoId: "c7", agente: "identificador", tipo: "costo" });
    expect(json.eventos[1].datos.usd).toBeCloseTo((2000 * 2 + 300 * 10) / 1e6, 10);
    expect(json.eventos[1].mensaje).toMatch(/US\$ 0,0070/);
  });

  it("sin llamadas a la IA no agrega nada", async () => {
    const res = await manejar(pedido({ casoId: "c7" }), z.object({ casoId: z.string() }), async ({ casoId }) => ({
      eventos: [evento(casoId, "identificador", "x", "y")],
    }));
    expect(((await res.json()) as { eventos: unknown[] }).eventos).toHaveLength(1);
  });
});
