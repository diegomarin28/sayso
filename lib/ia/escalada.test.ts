import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { fichaEjemplo } from "../../shared";
import { leerChapa } from "../intake/chapa";
import { eventoCosto } from "../intake/entrada";
import { armarKnowledgePack } from "../knowledge/armar";
import { repoEnMemoria } from "../knowledge/manuales";
import { calcularUso, ESCALADA, MODELOS, pedirJsonConEscalada, type EnviarMensaje, type LlamarIA, type PedidoIA } from "./claude";

/** Claude falso que responde según el modelo pedido y anota cada pedido. */
function porModelo(respuestas: Record<string, unknown>) {
  const pedidos: PedidoIA[] = [];
  const llamar: LlamarIA = async (p) => {
    pedidos.push(p);
    const r = respuestas[p.modelo];
    return typeof r === "string" ? r : JSON.stringify(r);
  };
  return { llamar, pedidos };
}

const S = z.object({ valor: z.string(), confianza: z.enum(["alta", "media", "baja"]).default("media") });
const pedido = { modelo: MODELOS.corto, system: "", contenido: [], etapa: "prueba" };

describe("pedirJsonConEscalada", () => {
  const original = { ...ESCALADA };
  afterEach(() => Object.assign(ESCALADA, original));

  it("(a) si Haiku no valida, pasa una vez a Sonnet y anota el motivo", async () => {
    const f = porModelo({ [MODELOS.corto]: "no es json", [MODELOS.vision]: { valor: "ok" } });
    const r = await pedirJsonConEscalada(S, pedido, f.llamar);
    expect(r).toEqual({ resultado: { valor: "ok", confianza: "media" }, escalada: "no_valido" });
    expect(f.pedidos.map((p) => [p.modelo, p.escalada])).toEqual([
      [MODELOS.corto, undefined],
      [MODELOS.vision, "no_valido"],
    ]);
  });

  it("(b) si el modelo marca confianza baja, escala; si no, no", async () => {
    const baja = porModelo({ [MODELOS.corto]: { valor: "dudoso", confianza: "baja" }, [MODELOS.vision]: { valor: "seguro", confianza: "alta" } });
    const revisar = (x: z.infer<typeof S>) => (x.confianza === "baja" ? ("confianza_baja" as const) : null);
    expect((await pedirJsonConEscalada(S, pedido, baja.llamar, revisar)).resultado.valor).toBe("seguro");
    const alta = porModelo({ [MODELOS.corto]: { valor: "seguro", confianza: "alta" } });
    expect(await pedirJsonConEscalada(S, pedido, alta.llamar, revisar)).toMatchObject({ escalada: null });
    expect(alta.pedidos).toHaveLength(1);
  });

  it("máximo una escalada: si Sonnet también falla, queda lo de Haiku", async () => {
    const f = porModelo({ [MODELOS.corto]: { valor: "dudoso", confianza: "baja" }, [MODELOS.vision]: "basura" });
    const r = await pedirJsonConEscalada(S, pedido, f.llamar, (x) => (x.confianza === "baja" ? "confianza_baja" : null));
    expect(r.resultado.valor).toBe("dudoso");
    expect(f.pedidos).toHaveLength(2);
  });

  it("con la escalada apagada, o si ya es Sonnet, no escala", async () => {
    ESCALADA.activa = false;
    const f = porModelo({ [MODELOS.corto]: { valor: "x", confianza: "baja" } });
    await pedirJsonConEscalada(S, pedido, f.llamar, () => "confianza_baja");
    expect(f.pedidos).toHaveLength(1);
    ESCALADA.activa = true;
    const g = porModelo({ [MODELOS.vision]: { valor: "x", confianza: "baja" } });
    await pedirJsonConEscalada(S, { ...pedido, modelo: MODELOS.vision }, g.llamar, () => "confianza_baja");
    expect(g.pedidos).toHaveLength(1);
  });
});

describe("(c) chapa", () => {
  const imagen = { base64: "AAAA", mediaType: "image/jpeg" as const };
  const lectura = (serieLectura: "clara" | "dudosa", marca = { valor: "Lenovo", lectura: "clara" as const }) => ({
    transcripcion: "Lenovo Type 20XW S/N PF2ABC12",
    marca,
    modelo: { valor: "20XW", lectura: "clara" },
    serie: { valor: "PF2ABC12", lectura: serieLectura },
    anio: { valor: null, lectura: "dudosa" },
  });

  it("escala si un dato escrito en la etiqueta quedó probable", async () => {
    const f = porModelo({ [MODELOS.corto]: lectura("dudosa"), [MODELOS.vision]: lectura("clara") });
    const r = await leerChapa({ casoId: "c1", clase: "notebook", imagenes: [imagen] }, f.llamar);
    expect(r.escalada).toBe("chapa_probable");
    expect(r.ficha.serie.estado).toBe("confirmado");
  });

  it("no escala por lo deducido (ej. la marca a partir del modelo)", async () => {
    const deducida = { ...lectura("clara"), transcripcion: "Type 20XW S/N PF2ABC12", marca: { valor: "Lenovo", lectura: "dudosa" } };
    const f = porModelo({ [MODELOS.corto]: deducida });
    const r = await leerChapa({ casoId: "c1", clase: "notebook", imagenes: [imagen] }, f.llamar);
    expect(r.escalada).toBeNull();
    expect(r.ficha.marca).toMatchObject({ estado: "probable", fuente: "deducido" });
    expect(f.pedidos).toHaveLength(1);
  });
});

describe("(d) lectura del manual sin pasos", () => {
  it("relee una vez con Sonnet antes de caer en la guía pública", async () => {
    const modelos: (string | undefined)[] = [];
    const escaladas: (string | undefined)[] = [];
    const mensaje = (content: unknown[], stop_reason = "end_turn") => ({ content, stop_reason }) as unknown as Anthropic.Message;
    const enviar: EnviarMensaje = async (p, _etapa, escalada) => {
      if (String(p.system).includes("bibliotecario")) {
        const yaProbo = p.messages.at(-1)!.content instanceof Array && (p.messages.at(-1)!.content as { type: string }[]).some((b) => b.type === "tool_result");
        return yaProbo
          ? mensaje([{ type: "text", text: '{"encontrado":true,"url":"https://ej.com/m.pdf","titulo":"HMM","fuente":"fabricante","formato":"pdf"}' }])
          : mensaje([{ type: "tool_use", id: "t", name: "probar_pdf", input: { url: "https://ej.com/m.pdf" } }], "tool_use");
      }
      modelos.push(p.model);
      escaladas.push(escalada);
      // Un paso sin cita no cuenta como guía del manual: el de Sonnet viene citado (como la API real).
      const cita = { type: "page_location", cited_text: "Remove the base cover screws", document_index: 0, document_title: "HMM", start_page_number: 1, end_page_number: 2, file_id: null };
      return p.model === MODELOS.vision ? mensaje([{ type: "text", text: "PASO|1|Sacá la tapa.|tapa_inferior|bajo", citations: [cita] }]) : mensaje([{ type: "text", text: "nada útil" }]);
    };
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    const pdf = await doc.save();
    const r = await armarKnowledgePack(
      { ficha: fichaEjemplo, sintoma: "x" },
      { enviar, fetch: (async () => new Response(pdf.slice())) as typeof fetch, subir: async () => "f", manuales: repoEnMemoria(), cache: { get: async () => undefined, set: async () => {} } },
    );
    expect(modelos.slice(0, 2)).toEqual([MODELOS.corto, MODELOS.vision]);
    expect(escaladas[1]).toBe("sin_pasos");
    expect(r.pack.pasos).toHaveLength(1);
    expect(r.eventos.map((e) => e.tipo)).toContain("lectura_escalada");
  });
});

describe("feed", () => {
  it("el evento de costo dice cuántas veces escaló y por qué", () => {
    const usos = [
      calcularUso("leer chapa", MODELOS.corto, { input_tokens: 100 }),
      { ...calcularUso("leer chapa", MODELOS.vision, { input_tokens: 100 }), escalada: "chapa_probable" as const },
    ];
    const e = eventoCosto("c1", "identificador", usos)!;
    expect(e.mensaje).toMatch(/Escaló a un modelo más capaz 1 vez \(la etiqueta quedó dudosa\)/);
    expect(e.datos).toMatchObject({ escaladas: 1 });
  });
});
