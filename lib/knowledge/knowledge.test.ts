import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { fichaEjemplo, KnowledgePack } from "../../shared";
import type { EnviarMensaje } from "../ia/claude";
import { armarKnowledgePack, type Armado, type CachePacks } from "./armar";
import { ordenar } from "./buscar";
import { descargarPdf } from "./descargar";
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

  it("junta advertencias e ignora texto suelto", () => {
    expect(contenido.advertencias).toEqual(["Desconectá la batería antes de tocar la placa."]);
  });
});

describe("buscar y descargar", () => {
  it("ordena: modelo exacto, fabricante, PDF", () => {
    const r = ordenar([
      { titulo: "a", url: "https://x.com/a", fuente: "otro", modeloExacto: true },
      { titulo: "b", url: "https://lenovo.com/b.pdf", fuente: "fabricante", modeloExacto: true },
      { titulo: "c", url: "https://lenovo.com/c.pdf", fuente: "fabricante", modeloExacto: false },
    ]);
    expect(r.map((c) => c.titulo)).toEqual(["b", "a", "c"]);
  });

  it("descarta lo que no es PDF", async () => {
    const html = (async () => new Response("<html>")) as typeof fetch;
    const pdf = (async () => new Response("%PDF-1.7 hola")) as typeof fetch;
    expect(await descargarPdf("https://x.com/m.pdf", html)).toBeNull();
    expect((await descargarPdf("https://x.com/m.pdf", pdf))?.bytes).toBe(13);
    expect(await descargarPdf("file:///etc/passwd", pdf)).toBeNull();
  });
});

describe("armarKnowledgePack", () => {
  const mensaje = (content: unknown[]): Anthropic.Message =>
    ({ content, stop_reason: "end_turn" }) as unknown as Anthropic.Message;

  function enviarFalso(): EnviarMensaje & { llamadas: number } {
    const f = Object.assign(
      async (p: Anthropic.MessageCreateParamsNonStreaming) => {
        f.llamadas++;
        if (String(p.system).includes("bibliotecario")) {
          return mensaje([
            { type: "text", text: '{"candidatos":[{"titulo":"HMM NB-15","url":"https://ej.com/hmm.pdf","fuente":"fabricante","modeloExacto":true}]}' },
          ]);
        }
        return mensaje(BLOQUES.map((b) => ({ type: "text", ...b })));
      },
      { llamadas: 0 },
    );
    return f;
  }

  it("busca, descarga, lee, valida y guarda en caché", async () => {
    const enviar = enviarFalso();
    const mapa = new Map<string, Armado>();
    const cache: CachePacks = { get: async (k) => mapa.get(k), set: async (k, v) => void mapa.set(k, v) };
    const fetchPdf = (async () => new Response("%PDF-1.7 manual")) as typeof fetch;

    const r = await armarKnowledgePack({ ficha: fichaEjemplo, sintoma: "se apaga" }, { enviar, fetch: fetchPdf, cache, subir: async () => "file_1" });
    KnowledgePack.parse(r.pack);
    expect(r.pack.verificado).toBe(true);
    expect(r.manual?.url).toBe("https://ej.com/hmm.pdf");
    expect(r.eventos.map((e) => e.tipo)).toContain("manual_encontrado");
    expect(enviar.llamadas).toBe(2);

    const otra = await armarKnowledgePack({ ficha: fichaEjemplo, sintoma: "se apaga" }, { enviar, fetch: fetchPdf, cache, subir: async () => "file_1" });
    expect(otra.desdeCache).toBe(true);
    expect(enviar.llamadas).toBe(2);
  });

  it("sin manual descargable arma una guía NO verificada", async () => {
    const enviar = enviarFalso();
    const nada = (async () => new Response("no", { status: 404 })) as typeof fetch;
    const r = await armarKnowledgePack({ ficha: fichaEjemplo, sintoma: "no carga" }, { enviar, fetch: nada, cache: { get: async () => undefined, set: async () => {} } });
    expect(r.pack.verificado).toBe(false);
    expect(r.manual).toBeNull();
  });

  it("no arma nada si el modelo no está confirmado", async () => {
    const ficha = { ...fichaEjemplo, modelo: { valor: "NB-15", estado: "probable" as const } };
    await expect(armarKnowledgePack({ ficha, sintoma: "x" }, { enviar: enviarFalso() })).rejects.toThrow();
  });
});
