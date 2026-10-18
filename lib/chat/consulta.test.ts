import type Anthropic from "@anthropic-ai/sdk";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { beforeEach, describe, expect, it } from "vitest";
import { knowledgePackEjemplo } from "../../shared";
import { LIMITES, type LlamarIA, type PedidoIA, type StreamIA } from "../ia/claude";

const LIMITES_CHAT = LIMITES.chat as { busquedaWeb: boolean };
import { repoEnMemoria } from "../knowledge/manuales";
import { evaluarPedido } from "../safety/riesgos";
import { manualGuardado, olvidarConsultas } from "../knowledge/consulta";
import { conversar, pideProcedimiento, type EventoChat } from "./conversar";

/**
 * "¿Cómo cambio el conector de carga?" (prueba real del iPhone 13): el experto tiene que dar los pasos
 * leyendo el procedimiento de ESA pieza, no mandar a consultar el manual. Sin red ni IA.
 */

const INDICE = "https://soporte.ej.com/manual";
const SECCIONES = ["Safety", "Introduction", "Display", "Battery", "Charging Port", "Speaker", "Camera", "Taptic Engine", "SIM Tray"];
const urlSeccion = (i: number) => `https://soporte.ej.com/manual/${i}`;

/** Manual web del fabricante + API de iFixit (con una guía del puerto de carga del "Fono X21"). */
function red(): typeof fetch {
  return (async (url: string | URL) => {
    const u = String(url);
    if (u === INDICE) {
      const lista = SECCIONES.map((t, i) => `<li><a href="${urlSeccion(i)}">${t}</a></li>`).join("");
      return new Response(`<html><head><title>Fono X21 Repair Manual</title></head><body><ul>${lista}</ul></body></html>`, { headers: { "content-type": "text/html" } });
    }
    const s = u.match(/^https:\/\/soporte\.ej\.com\/manual\/(\d+)$/);
    if (s) {
      const t = SECCIONES[+s[1]];
      return new Response(`<html><body><h1>${t}</h1><p>Remove the two screws next to the ${t} connector and lift it with tweezers.</p></body></html>`, {
        headers: { "content-type": "text/html" },
      });
    }
    const api = decodeURIComponent(u.replace("https://www.ifixit.com/api/2.0", ""));
    if (/^\/search\/.*fono.*x21.*\?filter=category/i.test(api)) return Response.json({ results: [{ title: "Fono X21" }] });
    if (api === "/wikis/CATEGORY/Fono X21") {
      return Response.json({
        title: "Fono X21",
        description: "Repair guides for the Fono X21 smartphone.",
        guides: [{ guideid: 3, title: "Fono X21 Charging Port Replacement", subject: "Charging Port", type: "replacement" }],
      });
    }
    if (api === "/guides/3") {
      return Response.json({
        guideid: 3,
        title: "Fono X21 Charging Port Replacement",
        url: "https://www.ifixit.com/Guide/Fono+X21+Charging+Port/3",
        category: "Fono X21",
        subject: "Charging Port",
        difficulty: "Moderate",
        author: { username: "Autora" },
        tools: [{ text: "Suction Handle" }],
        parts: [{ text: "Charging Port" }],
        steps: [{ stepid: 300, title: "Remove the port", lines: [{ bullet: "black", text_raw: "Unscrew the port bracket and pull the port out." }], media: { type: "image", data: [] } }],
      });
    }
    return new Response("no", { status: 404 });
  }) as typeof fetch;
}

/** Claude falso: cada llamada responde con su guion (texto o citas) y queda anotada. */
function guion(respuestas: (string | Anthropic.TextCitation)[][]): StreamIA & { pedidos: Anthropic.MessageCreateParamsNonStreaming[] } {
  const pedidos: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const f = async function* (p: Anthropic.MessageCreateParamsNonStreaming) {
    const partes = respuestas[pedidos.length] ?? ["Listo. "];
    pedidos.push(p);
    for (const x of partes) {
      yield {
        type: "content_block_delta",
        index: 0,
        delta: typeof x === "string" ? { type: "text_delta", text: x } : { type: "citations_delta", citation: x },
      } as Anthropic.RawMessageStreamEvent;
    }
  };
  return Object.assign(f, { pedidos });
}

const citaTexto = (documento: number, citado: string): Anthropic.TextCitation => ({
  type: "char_location",
  cited_text: citado,
  document_index: documento,
  document_title: `Sección ${documento}`,
  start_char_index: 0,
  end_char_index: citado.length,
  file_id: null,
});

/** Haiku eligiendo secciones (o páginas): siempre lo mismo, y anota el pedido. */
function eleccion(respuesta: unknown): LlamarIA & { pedidos: PedidoIA[] } {
  const pedidos: PedidoIA[] = [];
  return Object.assign(async (p: PedidoIA) => (pedidos.push(p), JSON.stringify(respuesta)), { pedidos });
}

async function todos(gen: AsyncGenerator<EventoChat>) {
  const r: EventoChat[] = [];
  for await (const e of gen) r.push(e);
  return r;
}

const dichos = (ev: EventoChat[]) => ev.flatMap((e) => (e.tipo === "paso" ? [e.coreografia] : []));
const pack = { ...knowledgePackEjemplo, modelo: "Fono X21" };
const historial = [{ rol: "experto" as const, texto: "Revisá el cable." }];
const pregunta = "¿Cómo cambio el conector de carga?";
const seisPasos = (doc: number) =>
  ["Apagá el equipo. ", "Sacá la pantalla. ", "Desconectá la batería. ", "Sacá los dos tornillos del conector. ", "Levantalo con la pinza. ", "Poné el nuevo. "].flatMap((t) => [
    citaTexto(doc, "Remove the two screws next to the Charging Port connector"),
    t,
  ]);

async function repoConManualWeb() {
  const manuales = repoEnMemoria();
  await manuales.guardar({ marca: "Fono", modelo: "X21", url: INDICE, titulo: "Fono X21 Repair Manual", verificado: true, fuente: "fabricante" });
  return manuales;
}

describe("consulta puntual: el experto da los pasos de la pieza, no manda al manual", () => {
  beforeEach(() => olvidarConsultas());

  it("encuentra el manual guardado con el nombre junto del pack (marca + modelo)", async () => {
    const manuales = await repoConManualWeb();
    expect(await manualGuardado("Fono X21", manuales)).toMatchObject({ url: INDICE });
    expect(await manualGuardado("Otro 99", manuales)).toBeNull();
  });

  it("detecta cuándo piden un procedimiento (abrir, cambiar, sacar)", () => {
    expect(pideProcedimiento("¿Cómo abro el celular?")).toBe(true);
    expect(pideProcedimiento("cómo cambio la batería")).toBe(true);
    expect(pideProcedimiento("¿Cómo cambio el conector de carga?")).toBe(true);
    expect(pideProcedimiento("¿Dónde está el SSD?")).toBe(false);
    expect(pideProcedimiento("¿Qué es la chapa?")).toBe(false);
  });

  it("cambiar la batería de un celular no se bloquea (sí la batería hinchada)", () => {
    expect(evaluarPedido("¿Cómo cambio la batería?", { tipoEquipo: "celular" }).bloqueado).toBe(false);
    expect(evaluarPedido("¿Cómo abro el celular?", { tipoEquipo: "celular" }).bloqueado).toBe(false);
  });

  it("manual web: lee las secciones de ESA pieza y da todos los pasos, VERIFICADO con la URL de la sección", async () => {
    const stream = guion([["[[manual]]"], seisPasos(0)]);
    const llamar = eleccion({ secciones: [urlSeccion(4), urlSeccion(3), urlSeccion(1)] });
    const ev = await todos(conversar({ casoId: "c1", pack, historial, pregunta, tipoEquipo: "celular" }, stream, undefined, { manuales: await repoConManualWeb(), fetch: red(), llamar }));

    expect(ev[0]).toMatchObject({ tipo: "buscando" });
    const pasos = dichos(ev);
    expect(pasos).toHaveLength(6); // pregunta de seguimiento, pero es un procedimiento: no se corta a 4
    expect(pasos[0].cita).toEqual({ doc: "Sección 0", url: urlSeccion(4), estado: "VERIFICADO" });
    expect(pasos.map((p) => p.dice).join(" ")).not.toMatch(/consult|support\.|técnico/i);
    // Haiku eligió secciones para la PREGUNTA (no para el síntoma) y la lectura recibió esas secciones.
    expect(JSON.stringify(llamar.pedidos[0].contenido)).toMatch(/<pregunta>¿Cómo cambio el conector de carga\?<\/pregunta>/);
    expect(llamar.pedidos[0].system).toMatch(/procedimiento de lo que pregunta/);
    const docs = (stream.pedidos[1].messages[0].content as Anthropic.ContentBlockParam[]).filter((b) => b.type === "document");
    expect(docs.map((d) => (d as Anthropic.DocumentBlockParam).title)).toEqual(["Charging Port", "Battery", "Introduction"]);
    expect(JSON.stringify(stream.pedidos[1].system)).toMatch(/\[\[no_cubre\]\]/);
    expect(ev.at(-1)).toMatchObject({ tipo: "fin", pasos: 6 });
  });

  it("si el manual no cubre la pieza, lo dice y da los pasos de iFixit, marcados como guía pública", async () => {
    const stream = guion([["[[manual]]"], ["[[no_cubre]]"], [citaTexto(1, "Unscrew the port bracket and pull the port out."), "Desatornillá el soporte del puerto. "]]);
    const llamar = eleccion({ secciones: [urlSeccion(5)] });
    const ev = await todos(conversar({ casoId: "c1", pack, pregunta, tipoEquipo: "celular" }, stream, undefined, { manuales: await repoConManualWeb(), fetch: red(), llamar }));

    const pasos = dichos(ev);
    expect(pasos[0].dice).toMatch(/El manual oficial no incluye este procedimiento\. Te paso los pasos de una guía pública de iFixit/);
    expect(pasos[1].dice).toMatch(/Desatornillá/);
    expect(pasos[1].cita).toMatchObject({ estado: "NO_VERIFICABLE", url: "https://www.ifixit.com/Guide/Fono+X21+Charging+Port/3#s300" });
    expect(JSON.stringify(stream.pedidos[2].system)).toMatch(/guía pública adjunta \(de iFixit/);
  });

  it("sin manual ni iFixit, con la búsqueda web apagada: da los pasos generales del tipo de equipo, NO VERIFICADO y sin mandar al manual", async () => {
    const antes = LIMITES_CHAT.busquedaWeb;
    LIMITES_CHAT.busquedaWeb = false;
    try {
      const stream = guion([["[[manual]]"], ["Apagá el celular. ", "Calentá el borde de la pantalla. ", "Levantala con una ventosa. "]]);
      const otro = { ...knowledgePackEjemplo, modelo: "Marca Desconocida Z9" };
      const ev = await todos(conversar({ casoId: "c1", pack: otro, pregunta, tipoEquipo: "celular" }, stream, undefined, { manuales: repoEnMemoria(), fetch: red(), llamar: eleccion({}) }));
      const pasos = dichos(ev);
      expect(pasos[0].dice).toBe("No tengo el manual oficial de este equipo para esto. Te doy los pasos generales para un equipo de tipo celular: no son de este modelo, así que andá con cuidado.");
      // La ventosa se explica la primera vez que se nombra (#230).
    expect(pasos.slice(1).map((p) => p.dice)).toEqual([
      "Apagá el celular.",
      "Calentá el borde de la pantalla.",
      expect.stringMatching(/^Levantala con una ventosa\. Ventosa: es un disco de goma con manija que se pega por vacío; sirve para /),
    ]);
      expect(pasos[1].cita).toEqual({ doc: "Pasos generales para celular (sin fuente)", estado: "NO_ENCONTRADO" });
      expect(pasos.map((p) => p.dice).join(" ")).not.toMatch(/consult/i);
      // Sin búsqueda web: una sola llamada más, sin herramientas.
      expect(stream.pedidos).toHaveLength(2);
      expect(stream.pedidos[1].tools).toBeUndefined();
      expect(JSON.stringify(stream.pedidos[1].system)).toMatch(/pasos GENERALES de cómo se hace eso en un equipo de tipo .{0,2}celular/);
    } finally {
      LIMITES_CHAT.busquedaWeb = antes;
    }
  });

  it("los pasos generales pasan por la seguridad: un paso peligroso se bloquea", async () => {
    const stream = guion([["[[manual]]"], ["Pinchá la batería hinchada para desinflarla. "]]);
    const otro = { ...knowledgePackEjemplo, modelo: "Marca Desconocida Z9" };
    const ev = await todos(conversar({ casoId: "c1", pack: otro, pregunta, tipoEquipo: "celular" }, stream, undefined, { manuales: repoEnMemoria(), fetch: red(), llamar: eleccion({}) }));
    expect(ev.some((e) => e.tipo === "bloqueo")).toBe(true);
  });

  it("con la búsqueda web prendida (decisión #206), primero busca una guía pública (citas NO_VERIFICABLE) y no da pasos generales", async () => {
    const antes = LIMITES_CHAT.busquedaWeb;
    LIMITES_CHAT.busquedaWeb = true;
    try {
      const cita: Anthropic.TextCitation = { type: "web_search_result_location", cited_text: "Remove the screws", url: "https://guias.ej/z9", title: "Guía Z9", encrypted_index: "x" };
      const stream = guion([["[[manual]]"], [cita, "Sacá los tornillos del puerto. "]]);
      const otro = { ...knowledgePackEjemplo, modelo: "Marca Desconocida Z9" };
      const ev = await todos(conversar({ casoId: "c1", pack: otro, pregunta, tipoEquipo: "celular" }, stream, undefined, { manuales: repoEnMemoria(), fetch: red(), llamar: eleccion({}) }));
      const pasos = dichos(ev);
      expect(pasos[0].dice).toMatch(/Te paso los pasos de una guía pública de la web, sin verificar\./);
      expect(pasos[1].cita).toEqual({ doc: "Guía Z9", url: "https://guias.ej/z9", estado: "NO_VERIFICABLE" });
      expect(stream.pedidos[1].tools?.length).toBeGreaterThan(0);
      expect(stream.pedidos).toHaveLength(2);
    } finally {
      LIMITES_CHAT.busquedaWeb = antes;
    }
  });

  it("manual en PDF: arma un extracto con las páginas del procedimiento y cita la página del manual completo", async () => {
    const doc = await PDFDocument.create();
    const fuente = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 1; i <= 40; i++) doc.addPage([300, 300]).drawText(`Pagina ${i}`, { x: 20, y: 250, size: 12, font: fuente });
    const pdf = await doc.save();
    const manuales = repoEnMemoria();
    await manuales.guardar({ marca: "Fono", modelo: "X21", url: "https://ej.com/hmm.pdf", titulo: "HMM Fono X21", verificado: true, fuente: "fabricante" });
    const subidos: string[] = [];
    const citaP2: Anthropic.TextCitation = {
      type: "page_location",
      cited_text: "Remove the charging port bracket screws",
      document_index: 0,
      document_title: "HMM Fono X21",
      start_page_number: 2,
      end_page_number: 3,
      file_id: null,
    };
    const stream = guion([["[[manual]]"], [citaP2, "Sacá los tornillos del soporte. "]]);
    const ev = await todos(
      conversar({ casoId: "c1", pack, pregunta, tipoEquipo: "celular" }, stream, undefined, {
        manuales,
        fetch: (async () => new Response(pdf.slice())) as typeof fetch,
        llamar: eleccion({ indice: [], explosionada: [], interior: [], sintoma: [{ desde: 20, hasta: 29 }] }),
        subir: async (_d, nombre) => (subidos.push(nombre), "file_pregunta"),
      }),
    );
    // Un procedimiento de 10 páginas seguidas entra entero (no se corta a 6 como una sección del síntoma).
    expect(subidos).toEqual(["extracto_20-21-22-23-24-25-26-27-28-29.pdf"]);
    expect(dichos(ev)[0].cita).toEqual({ doc: "HMM Fono X21", pagina: 21, estado: "VERIFICADO" });
    expect(JSON.stringify(stream.pedidos[1].messages[0].content)).toMatch(/file_pregunta/);
  });
});
