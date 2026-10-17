import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { POST as chat } from "../../app/api/chat/route";
import { knowledgePackEjemplo } from "../../shared";
import { manejar } from "../intake/entrada";
import { llamarClaude, streamClaude } from "./claude";
import {
  configFreno,
  contadorEnMemoria,
  contadorSupabase,
  diaDe,
  estadoFreno,
  gastoPendiente,
  IAEnPausa,
  respuestaPausa,
  sumarGasto,
  usarContador,
} from "./freno";
import { CODIGO_PAUSA, MENSAJE_PAUSA, mensajePausa } from "./pausa";

const AR = "America/Argentina/Buenos_Aires";

beforeEach(() => usarContador(contadorEnMemoria()));
afterEach(() => {
  vi.unstubAllEnvs();
  usarContador(null);
});

describe("configFreno", () => {
  it("lee IA_APAGADA e IA_LIMITE_USD_DIA", () => {
    expect(configFreno({})).toEqual({ apagada: false, limiteUsdDia: null, zona: AR });
    expect(configFreno({ IA_APAGADA: "1" }).apagada).toBe(true);
    expect(configFreno({ IA_APAGADA: " true " }).apagada).toBe(true);
    expect(configFreno({ IA_APAGADA: "0" }).apagada).toBe(false);
    expect(configFreno({ IA_LIMITE_USD_DIA: "5" }).limiteUsdDia).toBe(5);
    expect(configFreno({ IA_LIMITE_USD_DIA: "2,5" }).limiteUsdDia).toBe(2.5);
  });

  it("un límite inválido pausa la IA (no la deja sin freno)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(configFreno({ IA_LIMITE_USD_DIA: "cinco" }).limiteUsdDia).toBe(0);
    expect(configFreno({ IA_LIMITE_USD_DIA: "-1" }).limiteUsdDia).toBe(0);
  });

  it("el día es el de Argentina, no el de UTC", () => {
    expect(diaDe(new Date("2026-10-18T02:00:00Z"), AR)).toBe("2026-10-17");
    expect(diaDe(new Date("2026-10-18T04:00:00Z"), AR)).toBe("2026-10-18");
  });
});

describe("estadoFreno", () => {
  it("sin variables, la IA trabaja", async () => {
    expect(await estadoFreno(new Date(), {})).toBeNull();
  });

  it("apagada: pausa con su motivo", async () => {
    const p = await estadoFreno(new Date(), { IA_APAGADA: "1" });
    expect(p).toBeInstanceOf(IAEnPausa);
    expect(p?.motivo).toBe("apagada");
    expect(p?.message).toMatch(/^IA en pausa/);
  });

  it("con límite: trabaja hasta llegar al gasto del día y después pausa", async () => {
    vi.stubEnv("IA_LIMITE_USD_DIA", "1");
    expect(await estadoFreno()).toBeNull();
    sumarGasto(0.6);
    await gastoPendiente();
    expect(await estadoFreno()).toBeNull();
    sumarGasto(0.5);
    await gastoPendiente();
    expect((await estadoFreno())?.motivo).toBe("limite");
  });

  it("el gasto de ayer no cuenta hoy", async () => {
    const env = { IA_LIMITE_USD_DIA: "1" };
    sumarGasto(5, new Date("2026-10-16T15:00:00Z"));
    await gastoPendiente();
    expect(await estadoFreno(new Date("2026-10-17T15:00:00Z"), env)).toBeNull();
  });
});

describe("contadorSupabase", () => {
  it("sin la tabla (falta la migración 006) cuenta en memoria y avisa una sola vez", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const falla = { data: null, error: { message: "relation gasto_ia does not exist" } };
    const db = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => falla }) }) }),
      rpc: async () => falla,
    } as unknown as SupabaseClient;
    const c = contadorSupabase(db);
    expect(await c.sumar("2026-10-17", 0.4)).toBeCloseTo(0.4);
    expect(await c.sumar("2026-10-17", 0.4)).toBeCloseTo(0.8);
    expect(await c.total("2026-10-17")).toBeCloseTo(0.8);
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it("con la tabla, usa el total que devuelve la suma atómica (incluye otras instancias)", async () => {
    const db = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { usd: "3.25" }, error: null }) }) }) }),
      rpc: async (_f: string, args: { p_usd: number }) => ({ data: 3 + args.p_usd, error: null }),
    } as unknown as SupabaseClient;
    const c = contadorSupabase(db);
    expect(await c.sumar("2026-10-17", 0.5)).toBeCloseTo(3.5);
    expect(await c.total("2026-10-17")).toBeCloseTo(3.25);
  });
});

describe("con la IA en pausa no se llama a Claude", () => {
  it("llamarClaude y streamClaude lanzan IAEnPausa antes de llamar", async () => {
    vi.stubEnv("IA_APAGADA", "1");
    const pedido = { modelo: "x", system: "", contenido: [], formato: z.object({}) };
    await expect(llamarClaude(pedido)).rejects.toBeInstanceOf(IAEnPausa);
    const stream = streamClaude({ model: "x", max_tokens: 1, messages: [] })[Symbol.asyncIterator]();
    await expect(stream.next()).rejects.toBeInstanceOf(IAEnPausa);
  });

  it("manejar responde 503 ia_en_pausa sin ejecutar la ruta; ia: false no se frena", async () => {
    vi.stubEnv("IA_APAGADA", "1");
    const pedido = () => new Request("http://x", { method: "POST", body: "{}" });
    const fn = vi.fn(async () => ({ ok: true }));
    const r = await manejar(pedido(), z.object({}), fn);
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ codigo: CODIGO_PAUSA, motivo: "apagada" });
    expect(fn).not.toHaveBeenCalled();
    expect((await manejar(pedido(), z.object({}), fn, { ia: false })).status).toBe(200);
  });

  it("si la pausa salta a mitad de la ruta, también es 503 (no 500)", async () => {
    const r = await manejar(new Request("http://x", { method: "POST", body: "{}" }), z.object({}), async () => {
      throw new IAEnPausa("limite");
    });
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ codigo: CODIGO_PAUSA, motivo: "limite" });
  });

  it("/api/chat responde 503 antes de abrir el stream", async () => {
    vi.stubEnv("IA_APAGADA", "1");
    const cuerpo = { casoId: "c", pack: knowledgePackEjemplo, pregunta: "¿Dónde está el SSD?" };
    const r = await chat(new Request("http://x", { method: "POST", body: JSON.stringify(cuerpo) }));
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ codigo: CODIGO_PAUSA });
  });
});

describe("mensajePausa (navegador)", () => {
  it("reconoce la pausa y da el mensaje para mostrar", async () => {
    const r = respuestaPausa(new IAEnPausa("limite"));
    expect(mensajePausa(r.status, await r.json())).toMatch(/^IA en pausa/);
    expect(mensajePausa(503, { codigo: CODIGO_PAUSA })).toBe(MENSAJE_PAUSA);
  });

  it("cualquier otro error no es pausa", () => {
    expect(mensajePausa(502, { codigo: CODIGO_PAUSA })).toBeNull();
    expect(mensajePausa(503, { error: "otra cosa" })).toBeNull();
    expect(mensajePausa(503, null)).toBeNull();
  });
});
