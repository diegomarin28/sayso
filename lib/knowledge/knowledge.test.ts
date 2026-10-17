import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { fichaEjemplo, KnowledgePack } from "../../shared";
import type { EnviarMensaje } from "../ia/claude";
import { armarKnowledgePack, type Armado, type CachePacks } from "./armar";
import { buscarManual } from "./buscar";
import { descargarPdf, tituloDelPdf } from "./descargar";
import { repoEnMemoria } from "./manuales";
import { lineasConCitas, parsearContenido } from "./lineas";

const pagina = (texto: string, pag: number): Anthropic.TextCitation => ({
  type: "page_location",
  cited_text: texto,
  document_index: 0,
  document_title: "HMM",
  start_page_number: pag,
  end_page_number: pag + 1,
  file_id: null,
});

const BLOQUES = [
  { text: "PIEZA|ventilador|Ventilador|sobre el disipador|7", citations: [pagina("7 Fan assembly, above the heat sink", 40)] },
  { text: "\nPASO|1|Quitá los tornillos de la tapa inferior.|tapa_inferior|bajo", citations: [pagina("Remove the base cover screws", 52)] },
  { text: "\nPASO|2|Abrí la batería y cambiá las celdas.|bateria|bajo\n", citations: [pagina("Battery pack removal procedure", 55)] },
  { text: "PASO|3|Limpiá las rejillas.|ventilador|bajo" },
  { text: "\nREPUESTO|ventilador|5F10S13875", citations: [pagina("Fan assembly FRU 5F10S13875", 90)] },
  { text: "\nREPUESTO|ssd|SSD-INVENTADO-1", citations: [pagina("SSD module", 91)] },
  { text: "\nVISTA|Vista explosionada de la base", citations: [pagina("Major FRUs and CRUs exploded view", 52)] },
  { text: "\nADVERTENCIA|Desconectá la batería antes de tocar la placa.\nTexto suelto que no es una línea" },
];

describe("lineasConCitas + parsearContenido", () => {
  const contenido = parsearContenido(lineasConCitas(BLOQUES), "HMM");

  it("arma piezas y pasos con cita VERIFICADO y su página", () => {
    expect(contenido.piezas[0]).toMatchObject({ id: "ventilador", etiquetaManual: "7" });
    expect(contenido.pasos[0].cita).toEqual({ doc: "HMM", pagina: 52, estado: "VERIFICADO" });
  });

  it("un paso sin cita queda sin verificar", () => {
    expect(contenido.pasos.find((p) => p.orden === 3)?.cita).toBeUndefined();
  });

  it("la tabla de seguridad sube el riesgo aunque la IA diga bajo", () => {
    expect(contenido.pasos.find((p) => p.orden === 2)?.riesgo).toBe("alto");
  });

  it("solo guarda números de parte que aparecen en el texto citado", () => {
    expect(contenido.repuestos.map((r) => r.numeroParte)).toEqual(["5F10S13875"]);
    expect(contenido.descartadas.some((d) => d.includes("SSD-INVENTADO"))).toBe(true);
  });

  it("guarda las páginas de la vista explosionada", () => {
    expect(contenido.vistas).toEqual([52]);
  });

  it("junta advertencias e ignora texto suelto", () => {
    expect(contenido.advertencias).toEqual(["Desconectá la batería antes de tocar la placa."]);
  });
});

describe("buscar y descargar", () => {
  it("lee el título interno del PDF", () => {
    expect(tituloDelPdf(Buffer.from("%PDF-1.7 ... /Title (ThinkPad E14 Gen 2 HMM) ..."))).toBe("ThinkPad E14 Gen 2 HMM");
    expect(tituloDelPdf(Buffer.from("%PDF-1.7 sin titulo"))).toBeNull();
  });

  it("descarta lo que no es PDF", async () => {
    const html = (async () => new Response("<html>")) as typeof fetch;
    const pdf = (async () => new Response("%PDF-1.7 hola")) as typeof fetch;
    expect(await descargarPdf("https://x.com/m.pdf", html)).toBeNull();
    expect((await descargarPdf("https://x.com/m.pdf", pdf))?.bytes).toBe(13);
    expect(await descargarPdf("file:///etc/passwd", pdf)).toBeNull();
  });
});

const mensaje = (content: unknown[], stop_reason = "end_turn"): Anthropic.Message =>
  ({ content, stop_reason }) as unknown as Anthropic.Message;
const pdfOk = (async () => new Response("%PDF-1.7 manual")) as typeof fetch;
const nada = (async () => new Response("no", { status: 404 })) as typeof fetch;

/** Bibliotecario falso: llama a probar_pdf con `url` y después responde el JSON final. */
function enviarFalso(url = "https://ej.com/hmm.pdf"): EnviarMensaje & { llamadas: number } {
  const f = Object.assign(
    async (p: Anthropic.MessageCreateParamsNonStreaming) => {
      f.llamadas++;
      if (String(p.system).includes("bibliotecario")) {
        const ultimo = p.messages.at(-1)!;
        const yaProbo = Array.isArray(ultimo.content) && ultimo.content.some((b) => b.type === "tool_result");
        if (!yaProbo) return mensaje([{ type: "tool_use", id: "t1", name: "probar_pdf", input: { url } }], "tool_use");
        return mensaje([{ type: "text", text: `{"encontrado":true,"url":"${url}","titulo":"HMM NB-15","fuente":"fabricante"}` }]);
      }
      return mensaje(BLOQUES.map((b) => ({ type: "text", ...b })));
    },
    { llamadas: 0 },
  );
  return f;
}

describe("bibliotecario", () => {
  it("solo acepta una URL que probar_pdf verificó", async () => {
    const r = await buscarManual({ marca: "EJ", modelo: "NB-15", clase: "notebook" }, { enviar: enviarFalso(), fetch: pdfOk });
    expect(r?.url).toBe("https://ej.com/hmm.pdf");
    const falla = await buscarManual({ marca: "EJ", modelo: "NB-15", clase: "notebook" }, { enviar: enviarFalso(), fetch: nada });
    expect(falla).toBeNull();
  });
});

describe("armarKnowledgePack", () => {
  const sinCache: CachePacks = { get: async () => undefined, set: async () => {} };
  const subir = async () => "file_1";

  it("busca, verifica, lee, guarda el manual en la caché y la reusa", async () => {
    const manuales = repoEnMemoria();
    const enviar = enviarFalso();
    const r = await armarKnowledgePack({ ficha: fichaEjemplo, sintoma: "se apaga" }, { enviar, fetch: pdfOk, cache: sinCache, subir, manuales });
    KnowledgePack.parse(r.pack);
    expect(r.pack.verificado).toBe(true);
    expect(r.paginasVistaExplosionada).toEqual([52]);
    const guardado = await manuales.buscar(fichaEjemplo.marca.valor, fichaEjemplo.modelo.valor!);
    expect(guardado).toMatchObject({ url: "https://ej.com/hmm.pdf", verificado: true, paginas_vista_explosionada: [52] });
    expect(enviar.llamadas).toBe(3); // 2 del bibliotecario + 1 lectura

    // Otro síntoma, mismo modelo: no se vuelve a buscar el manual.
    const enviar2 = enviarFalso();
    const r2 = await armarKnowledgePack({ ficha: fichaEjemplo, sintoma: "no carga" }, { enviar: enviar2, fetch: pdfOk, cache: sinCache, subir, manuales });
    expect(enviar2.llamadas).toBe(1);
    expect(r2.eventos.map((e) => e.tipo)).toContain("manual_en_cache");
  });

  it("guarda el pack por modelo + síntoma", async () => {
    const mapa = new Map<string, Armado>();
    const cache: CachePacks = { get: async (k) => mapa.get(k), set: async (k, v) => void mapa.set(k, v) };
    const enviar = enviarFalso();
    const deps = { enviar, fetch: pdfOk, cache, subir, manuales: repoEnMemoria() };
    await armarKnowledgePack({ ficha: fichaEjemplo, sintoma: "se apaga" }, deps);
    const otra = await armarKnowledgePack({ ficha: fichaEjemplo, sintoma: "se apaga" }, deps);
    expect(otra.desdeCache).toBe(true);
    expect(enviar.llamadas).toBe(3);
  });

  it("sin manual descargable arma una guía NO verificada y no guarda manual", async () => {
    const manuales = repoEnMemoria();
    const r = await armarKnowledgePack({ ficha: fichaEjemplo, sintoma: "no carga" }, { enviar: enviarFalso(), fetch: nada, cache: sinCache, subir, manuales });
    expect(r.pack.verificado).toBe(false);
    expect(r.manual).toBeNull();
    expect(await manuales.buscar(fichaEjemplo.marca.valor, fichaEjemplo.modelo.valor!)).toBeNull();
  });

  it("no arma nada si el modelo no está confirmado", async () => {
    const ficha = { ...fichaEjemplo, modelo: { valor: "NB-15", estado: "probable" as const } };
    await expect(armarKnowledgePack({ ficha, sintoma: "x" }, { enviar: enviarFalso() })).rejects.toThrow();
  });
});
