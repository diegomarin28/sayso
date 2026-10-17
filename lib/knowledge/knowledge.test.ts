import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { fichaEjemplo, KnowledgePack } from "../../shared";
import type { EnviarMensaje } from "../ia/claude";
import { armarKnowledgePack, type Armado, type CachePacks } from "./armar";
import { buscarManual } from "./buscar";
import { descargarPdf, tituloDelPdf } from "./descargar";
import { lineasConCitas, parsearContenido } from "./lineas";
import { repoEnMemoria, repoSupabase, vistasDe } from "./manuales";

const pagina = (texto: string, pag: number): Anthropic.TextCitation => ({
  type: "page_location",
  cited_text: texto,
  document_index: 0,
  document_title: "HMM",
  start_page_number: pag,
  end_page_number: pag + 1,
  file_id: null,
});

type Bloque = { text: string; citations?: Anthropic.TextCitation[] };

const PACK: Bloque[] = [
  { text: "PIEZA|ventilador|Ventilador|sobre el disipador|7", citations: [pagina("7 Fan assembly, above the heat sink", 40)] },
  { text: "\nPASO|1|Quitá los tornillos de la tapa inferior.|tapa_inferior|bajo", citations: [pagina("Remove the base cover screws", 52)] },
  { text: "\nPASO|2|Abrí la batería y cambiá las celdas.|bateria|bajo\n", citations: [pagina("Battery pack removal procedure", 55)] },
  { text: "PASO|3|Limpiá las rejillas.|ventilador|bajo" },
  { text: "\nREPUESTO|ventilador|5F10S13875", citations: [pagina("Fan assembly FRU 5F10S13875", 90)] },
  { text: "\nREPUESTO|ssd|SSD-INVENTADO-1", citations: [pagina("SSD module", 91)] },
  { text: "\nADVERTENCIA|Desconectá la batería antes de tocar la placa.\nTexto suelto que no es una línea" },
];
const VISTA_EXPLOSIONADA: Bloque = { text: "\nVISTA|explosionada|Vista general con la lista de piezas", citations: [pagina("Major FRUs and CRUs", 51)] };
const VISTA_INTERIOR: Bloque = { text: "\nVISTA|Interior|Base sin la tapa inferior", citations: [pagina("Removing the thermal fan assembly", 73)] };

describe("lineasConCitas + parsearContenido", () => {
  const contenido = parsearContenido(lineasConCitas([...PACK, VISTA_EXPLOSIONADA, VISTA_INTERIOR]), "HMM");

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

  it("toma la página de cada vista de la cita de la API", () => {
    expect(contenido.vistas).toEqual({ explosionada: 51, interior: 73 });
  });

  it("descarta vistas sin cita, de tipo desconocido o repetidas", () => {
    const c = parsearContenido(
      lineasConCitas([
        { text: "VISTA|interior|sin cita" },
        { text: "\nVISTA|lateral|no existe", citations: [pagina("Side view", 3)] },
        { text: "\nVISTA|explosionada|la primera", citations: [pagina("Exploded view", 10)] },
        { text: "\nVISTA|explosionada|otra", citations: [pagina("Exploded view LCD", 20)] },
      ]),
      "HMM",
    );
    expect(c.vistas).toEqual({ explosionada: 10, interior: null });
    expect(c.descartadas).toHaveLength(3);
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

/** Texto de la tarea (último bloque de texto del mensaje del usuario). */
function tarea(p: Anthropic.MessageCreateParamsNonStreaming): string {
  const c = p.messages[0].content;
  if (typeof c === "string") return c;
  const textos = c.filter((b): b is Anthropic.TextBlockParam => b.type === "text");
  return textos.at(-1)?.text ?? "";
}

/**
 * Claude falso. Bibliotecario: llama a probar_pdf y responde el JSON final.
 * Lectura del pack: devuelve PACK + las vistas de `enPack`. Búsqueda dedicada: devuelve `dedicada`.
 */
function enviarFalso(opciones: { url?: string; enPack?: Bloque[]; dedicada?: Bloque[] } = {}) {
  const { url = "https://ej.com/hmm.pdf", enPack = [VISTA_EXPLOSIONADA, VISTA_INTERIOR], dedicada = [] } = opciones;
  const llamadas: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const enviar: EnviarMensaje = async (p) => {
    llamadas.push(p);
    if (String(p.system).includes("bibliotecario")) {
      const ultimo = p.messages.at(-1)!;
      const yaProbo = Array.isArray(ultimo.content) && ultimo.content.some((b) => b.type === "tool_result");
      if (!yaProbo) return mensaje([{ type: "tool_use", id: "t1", name: "probar_pdf", input: { url } }], "tool_use");
      return mensaje([{ type: "text", text: `{"encontrado":true,"url":"${url}","titulo":"HMM NB-15","fuente":"fabricante"}` }]);
    }
    const bloques = tarea(p).startsWith("Prepará una guía") ? [...PACK, ...enPack] : dedicada;
    return mensaje(bloques.map((b) => ({ type: "text", ...b })));
  };
  const de = (tipo: "bibliotecario" | "pack" | "vistas") =>
    llamadas.filter((p) =>
      tipo === "bibliotecario"
        ? String(p.system).includes("bibliotecario")
        : !String(p.system).includes("bibliotecario") && tarea(p).startsWith("Prepará una guía") === (tipo === "pack"),
    );
  return { enviar, llamadas, de };
}

describe("bibliotecario", () => {
  it("solo acepta una URL que probar_pdf verificó", async () => {
    const r = await buscarManual({ marca: "EJ", modelo: "NB-15", clase: "notebook" }, { enviar: enviarFalso().enviar, fetch: pdfOk });
    expect(r?.url).toBe("https://ej.com/hmm.pdf");
    const falla = await buscarManual({ marca: "EJ", modelo: "NB-15", clase: "notebook" }, { enviar: enviarFalso().enviar, fetch: nada });
    expect(falla).toBeNull();
  });
});

describe("armarKnowledgePack", () => {
  const sinCache: CachePacks = { get: async () => undefined, set: async () => {} };
  const subir = async () => "file_1";
  const modelo = fichaEjemplo.modelo.valor!;

  it("busca, lee, ubica las vistas en la misma lectura y guarda el manual con sus páginas", async () => {
    const manuales = repoEnMemoria();
    const f = enviarFalso();
    const r = await armarKnowledgePack({ ficha: fichaEjemplo, sintoma: "se apaga" }, { enviar: f.enviar, fetch: pdfOk, cache: sinCache, subir, manuales });
    KnowledgePack.parse(r.pack);
    expect(r.pack.verificado).toBe(true);
    expect(r.vistas).toEqual({ explosionada: 51, interior: 73 });
    expect(f.de("vistas")).toHaveLength(0); // no hizo falta la búsqueda dedicada
    expect(r.eventos.find((e) => e.tipo === "vistas_ubicadas")?.mensaje).toMatch(/p\. 51.*p\. 73/);
    expect(await manuales.buscar(fichaEjemplo.marca.valor, modelo)).toMatchObject({
      url: "https://ej.com/hmm.pdf",
      verificado: true,
      paginas_vista_explosionada: [51],
      pagina_vista_interior: 73,
    });
  });

  it("si falta una vista, la busca sola con el mismo prefijo (caché de prompts)", async () => {
    const manuales = repoEnMemoria();
    const f = enviarFalso({ enPack: [VISTA_EXPLOSIONADA], dedicada: [VISTA_INTERIOR] });
    const r = await armarKnowledgePack({ ficha: fichaEjemplo, sintoma: "se apaga" }, { enviar: f.enviar, fetch: pdfOk, cache: sinCache, subir, manuales });
    expect(r.vistas).toEqual({ explosionada: 51, interior: 73 });

    const [lecturaPack] = f.de("pack");
    const [lecturaVistas] = f.de("vistas");
    expect(tarea(lecturaVistas)).toMatch(/VISTA\|interior/);
    expect(tarea(lecturaVistas)).not.toMatch(/VISTA\|explosionada/);
    // Mismo modelo, system, effort y documento: la segunda lectura sale de la caché de prompts.
    const prefijo = (p: Anthropic.MessageCreateParamsNonStreaming) => {
      const c = p.messages[0].content as Anthropic.ContentBlockParam[];
      return JSON.stringify({ model: p.model, system: p.system, output_config: p.output_config, tools: p.tools, doc: c[0] });
    };
    expect(prefijo(lecturaVistas)).toBe(prefijo(lecturaPack));
  });

  it("con el manual en caché y sus vistas, no las vuelve a pedir ni busca el manual", async () => {
    const manuales = repoEnMemoria();
    await manuales.guardar({
      marca: fichaEjemplo.marca.valor!,
      modelo,
      url: "https://ej.com/hmm.pdf",
      titulo: "HMM NB-15",
      paginas_vista_explosionada: [51],
      pagina_vista_interior: 73,
      verificado: true,
      fuente: "fabricante",
    });
    const f = enviarFalso({ enPack: [] });
    const r = await armarKnowledgePack({ ficha: fichaEjemplo, sintoma: "no carga" }, { enviar: f.enviar, fetch: pdfOk, cache: sinCache, subir, manuales });
    expect(r.vistas).toEqual({ explosionada: 51, interior: 73 });
    expect(f.de("bibliotecario")).toHaveLength(0);
    expect(f.de("vistas")).toHaveLength(0);
    expect(tarea(f.de("pack")[0])).not.toMatch(/VISTA\|/);
    expect(r.eventos.map((e) => e.tipo)).toContain("manual_en_cache");
  });

  it("un manual ya verificado no pierde la marca si una lectura sale sin citas", async () => {
    const manuales = repoEnMemoria();
    await manuales.guardar({ marca: fichaEjemplo.marca.valor!, modelo, url: "https://ej.com/hmm.pdf", titulo: "HMM", verificado: true, fuente: "fabricante" });
    const f = enviarFalso();
    const sinCitas = async (p: Anthropic.MessageCreateParamsNonStreaming) =>
      tarea(p).startsWith("Prepará una guía") ? mensaje([{ type: "text", text: "PASO|1|Limpiá las rejillas.|ventilador|bajo" }]) : f.enviar(p);
    const r = await armarKnowledgePack({ ficha: fichaEjemplo, sintoma: "ruido" }, { enviar: sinCitas, fetch: pdfOk, cache: sinCache, subir, manuales });
    expect(r.pack.verificado).toBe(false);
    expect((await manuales.buscar(fichaEjemplo.marca.valor, modelo))?.verificado).toBe(true);
  });

  it("guarda el pack por modelo + síntoma", async () => {
    const mapa = new Map<string, Armado>();
    const cache: CachePacks = { get: async (k) => mapa.get(k), set: async (k, v) => void mapa.set(k, v) };
    const f = enviarFalso();
    const deps = { enviar: f.enviar, fetch: pdfOk, cache, subir, manuales: repoEnMemoria() };
    await armarKnowledgePack({ ficha: fichaEjemplo, sintoma: "se apaga" }, deps);
    const otra = await armarKnowledgePack({ ficha: fichaEjemplo, sintoma: "se apaga" }, deps);
    expect(otra.desdeCache).toBe(true);
    expect(otra.vistas).toEqual({ explosionada: 51, interior: 73 });
    expect(f.llamadas).toHaveLength(3); // 2 del bibliotecario + 1 lectura, una sola vez
  });

  it("sin manual descargable arma una guía NO verificada, sin vistas y sin guardar manual", async () => {
    const manuales = repoEnMemoria();
    const f = enviarFalso();
    const r = await armarKnowledgePack({ ficha: fichaEjemplo, sintoma: "no carga" }, { enviar: f.enviar, fetch: nada, cache: sinCache, subir, manuales });
    expect(r.pack.verificado).toBe(false);
    expect(r.manual).toBeNull();
    expect(r.vistas).toEqual({ explosionada: null, interior: null });
    expect(tarea(f.de("pack")[0])).not.toMatch(/VISTA\|/);
    expect(await manuales.buscar(fichaEjemplo.marca.valor, modelo)).toBeNull();
  });

  it("no arma nada si el modelo no está confirmado", async () => {
    const ficha = { ...fichaEjemplo, modelo: { valor: "NB-15", estado: "probable" as const } };
    await expect(armarKnowledgePack({ ficha, sintoma: "x" }, { enviar: enviarFalso().enviar })).rejects.toThrow();
  });
});

describe("repoSupabase", () => {
  /** Supabase falso: la primera escritura falla como si faltara la columna nueva. */
  function dbFalsa(faltaColumna: boolean) {
    const escritas: Record<string, unknown>[] = [];
    const db = {
      from: () => ({
        upsert: async (fila: Record<string, unknown>) => {
          escritas.push({ ...fila });
          if (faltaColumna && "pagina_vista_interior" in fila) {
            return { error: { code: "PGRST204", message: "Could not find the 'pagina_vista_interior' column" } };
          }
          return { error: null };
        },
        select: () => ({
          eq: () => ({
            // Fila vieja, de antes de la migración: sin las columnas de las vistas.
            maybeSingle: async () => ({
              data: { clave: "x", marca: "EJ", modelo: "NB-15", url: "https://ej.com/hmm.pdf", titulo: "HMM", verificado: true, fuente: "fabricante", paginas_vista_explosionada: [1, 2] },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;
    return { db, escritas };
  }

  it("si falta la migración de vistas, guarda el manual sin las páginas", async () => {
    const { db, escritas } = dbFalsa(true);
    await repoSupabase(db).guardar({ marca: "EJ", modelo: "NB-15", url: "https://ej.com/hmm.pdf", titulo: "HMM", pagina_vista_interior: 73, verificado: true, fuente: "fabricante" });
    expect(escritas).toHaveLength(2);
    expect(escritas[1]).not.toHaveProperty("pagina_vista_interior");
    expect(escritas[1]).toMatchObject({ url: "https://ej.com/hmm.pdf", clave: "EJ|NB15" });
  });

  it("lee filas viejas sin la columna nueva y no usa sus páginas (se vuelven a ubicar)", async () => {
    const r = await repoSupabase(dbFalsa(false).db).buscar("EJ", "NB-15");
    expect(r).toMatchObject({ verificado: true, paginas_vista_explosionada: [1, 2], pagina_vista_interior: null });
    expect(vistasDe(r)).toEqual({ explosionada: null, interior: null });
  });
});

describe("armarKnowledgePack sin pasos (nunca 502, nunca repaga)", () => {
  const subir = async () => "file_1";
  const ficha = fichaEjemplo;

  /** Bibliotecario que encuentra el PDF; lectura del manual y guía pública con las respuestas dadas. */
  function claude(manual: unknown[], publica: unknown[][]) {
    const llamadas: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const base = enviarFalso();
    let vuelta = 0;
    const enviar: EnviarMensaje = async (p) => {
      llamadas.push(p);
      if (String(p.system).includes("bibliotecario")) return base.enviar(p);
      if (p.tools?.length) {
        const r = publica[Math.min(vuelta, publica.length - 1)];
        vuelta++;
        return mensaje(r, vuelta < publica.length ? "pause_turn" : "end_turn");
      }
      return mensaje(manual, "max_tokens");
    };
    return { enviar, llamadas };
  }

  it("si el manual no da pasos, cae en la guía pública (NO VERIFICADO) y deja el diagnóstico", async () => {
    const c = claude([{ type: "text", text: "Acá tenés un resumen del manual sin el formato pedido." }], [[{ type: "text", text: "PASO|1|Limpiá las rejillas.|ventilador|bajo" }]]);
    const r = await armarKnowledgePack({ ficha, sintoma: "ruido" }, { enviar: c.enviar, fetch: pdfOk, subir, manuales: repoEnMemoria(), cache: { get: async () => undefined, set: async () => {} } });
    expect(r.pack.verificado).toBe(false);
    expect(r.pack.pasos).toHaveLength(1);
    expect(r.manual).toBeNull();
    const diag = r.eventos.find((e) => e.tipo === "lectura_sin_pasos");
    expect(diag?.datos).toMatchObject({ motivo: "max_tokens", lineas: 1 });
  });

  it("si nada da pasos, devuelve un pack vacío sin error y guarda el resultado: otro intento no repaga", async () => {
    const c = claude([{ type: "text", text: "nada" }], [[{ type: "text", text: "tampoco" }]]);
    const mapa = new Map<string, Armado>();
    const cache: CachePacks = { get: async (k) => mapa.get(k), set: async (k, v) => void mapa.set(k, v) };
    const deps = { enviar: c.enviar, fetch: pdfOk, subir, manuales: repoEnMemoria(), cache };
    const r = await armarKnowledgePack({ ficha, sintoma: "ruido" }, deps);
    expect(r.pack).toMatchObject({ verificado: false, pasos: [] });
    expect(r.eventos.map((e) => e.tipo)).toContain("guia_vacia");
    const antes = c.llamadas.length;
    const otra = await armarKnowledgePack({ ficha, sintoma: "ruido" }, deps);
    expect(otra.desdeCache).toBe(true);
    expect(c.llamadas.length).toBe(antes);
  });

  it("la guía pública sigue después de un pause_turn y junta lo de todas las vueltas", async () => {
    const c = claude([{ type: "text", text: "nada" }], [[{ type: "text", text: "PASO|1|Primero esto.|ventilador|bajo\n" }], [{ type: "text", text: "PASO|2|Después esto.|ventilador|bajo" }]]);
    const r = await armarKnowledgePack({ ficha, sintoma: "ruido" }, { enviar: c.enviar, fetch: pdfOk, subir, manuales: repoEnMemoria(), cache: { get: async () => undefined, set: async () => {} } });
    expect(r.pack.pasos.map((p) => p.orden)).toEqual([1, 2]);
  });

  it("acepta líneas con viñetas, numeración o negritas", () => {
    const c = parsearContenido(lineasConCitas([{ text: "1. **PASO**|1|Sacá la tapa.|tapa_inferior|bajo\n- PIEZA|ssd|SSD|abajo|" }]), "HMM");
    expect(c.pasos).toHaveLength(1);
    expect(c.piezas.map((p) => p.id)).toEqual(["ssd"]);
  });
});
