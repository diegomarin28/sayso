import type Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { fichaEjemplo, type PasoReparacion } from "../../shared";
import type { EnviarMensaje, PedidoIA } from "../ia/claude";
import { armarKnowledgePack, insertarPasos, type CachePacks } from "./armar";
import { olvidarConsultas } from "./consulta";
import { repoEnMemoria } from "./manuales";

/**
 * Completar la guía (pedido de Juanma): lo que la fuente no trajo (línea FALTA, ej. "cómo abrir el equipo") se
 * busca una vez en el mismo manual y, si no está, en iFixit; los pasos van donde faltaban. Sin red ni IA.
 */

const INDICE = "https://soporte.ej.com/manual";
const SECCIONES = ["Safety", "Opening the device", "Display", "Battery", "Charging Port", "Speaker", "Camera", "Taptic Engine", "SIM Tray"];
const urlSeccion = (i: number) => `https://soporte.ej.com/manual/${i}`;
const GUIA = "https://www.ifixit.com/Guide/Fono+X21+Opening/7";

function red(): typeof fetch {
  return (async (url: string | URL) => {
    const u = String(url);
    if (u === INDICE) {
      const lista = SECCIONES.map((t, i) => `<li><a href="${urlSeccion(i)}">${t}</a></li>`).join("");
      return new Response(`<html><head><title>Fono X21 Repair Manual</title></head><body><ul>${lista}</ul></body></html>`, { headers: { "content-type": "text/html" } });
    }
    const s = u.match(/^https:\/\/soporte\.ej\.com\/manual\/(\d+)$/);
    if (s) return new Response(`<html><body><h1>${SECCIONES[+s[1]]}</h1><p>Heat the edge and use the suction cup to lift the display.</p></body></html>`, { headers: { "content-type": "text/html" } });
    const api = decodeURIComponent(u.replace("https://www.ifixit.com/api/2.0", ""));
    if (/^\/search\/.*x21.*\?filter=category/i.test(api)) return Response.json({ results: [{ title: "Fono X21" }] });
    if (api === "/wikis/CATEGORY/Fono X21") {
      return Response.json({ title: "Fono X21", description: "Repair guides for the Fono X21 smartphone.", guides: [{ guideid: 7, title: "Fono X21 Opening Procedure", subject: "Screen", type: "replacement" }] });
    }
    if (api === "/guides/7") {
      return Response.json({
        guideid: 7,
        title: "Fono X21 Opening Procedure",
        url: GUIA,
        category: "Fono X21",
        subject: "Screen",
        difficulty: "Moderate",
        author: { username: "Autora" },
        tools: [],
        parts: [],
        steps: [{ stepid: 70, title: "Open it", lines: [{ bullet: "black", text_raw: "Apply heat and pry the screen up with an opening pick." }], media: { type: "image", data: [] } }],
      });
    }
    return new Response("no", { status: 404 });
  }) as typeof fetch;
}

const citaTexto = (documento: number, citado: string): Anthropic.TextCitation => ({
  type: "char_location",
  cited_text: citado,
  document_index: documento,
  document_title: `Doc ${documento}`,
  start_char_index: 0,
  end_char_index: citado.length,
  file_id: null,
});
const mensaje = (content: unknown[]) => ({ content, stop_reason: "end_turn" }) as unknown as Anthropic.Message;
const ficha = { ...fichaEjemplo, clase: "otro" as const, marca: { ...fichaEjemplo.marca, valor: "Fono" }, modelo: { ...fichaEjemplo.modelo, valor: "X21" } };
const sinCache: CachePacks = { get: async () => undefined, set: async () => {} };
const CITADO = "Heat the edge and use the suction cup to lift the display.";

/** La guía del manual: un chequeo, FALTA "cómo abrir", y el cambio del puerto. La completación responde según `completa`. */
function claude(completa: "manual" | "nada") {
  const etapas: string[] = [];
  const pedidos: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const enviar: EnviarMensaje = async (p, etapa) => {
    etapas.push(etapa ?? "");
    pedidos.push(p);
    if (etapa === "bibliotecario: leer manual web") {
      return mensaje([
        { type: "text", text: "PASO|1|Probá con otro cable y otro cargador.|marco|bajo\nFALTA|cómo abrir el equipo y sacar la pantalla\n" },
        { type: "text", text: "PASO|2|Desatornillá el soporte del puerto y sacalo con la pinza.|conector_carga|medio", citations: [citaTexto(0, CITADO)] },
        { type: "text", text: "\nPASO|3|Volvé a armar y probá la carga: tiene que aparecer el rayo.|conector_carga|bajo", citations: [citaTexto(0, CITADO)] },
      ]);
    }
    if (etapa === "bibliotecario: completar la guía") {
      const docs = (p.messages[0].content as Anthropic.ContentBlockParam[]).filter((b) => b.type === "document").length;
      const esIfixit = JSON.stringify(p.messages[0].content).includes("ifixit.com");
      if (completa === "nada" && !esIfixit) return mensaje([{ type: "text", text: "" }]);
      return mensaje([
        { type: "text", text: "PASO|1|Calentá el borde de la pantalla unos dos minutos con un secador.|pantalla|medio", citations: [citaTexto(docs - 1, esIfixit ? "Apply heat and pry the screen up with an opening pick." : CITADO)] },
        { type: "text", text: "\nPASO|2|Levantá la pantalla con la ventosa y abrila como un libro hacia la izquierda.|pantalla|medio", citations: [citaTexto(docs - 1, esIfixit ? "Apply heat and pry the screen up with an opening pick." : CITADO)] },
      ]);
    }
    return mensaje([{ type: "text", text: "" }]);
  };
  return { enviar, etapas, pedidos };
}

/** Haiku eligiendo secciones: para el síntoma, el puerto; para lo que falta, "Opening the device" y "Display". */
function eleccion() {
  const pedidos: PedidoIA[] = [];
  const llamar = async (p: PedidoIA) => {
    pedidos.push(p);
    const paraFalta = JSON.stringify(p.contenido).includes("<pregunta>");
    return JSON.stringify({ secciones: paraFalta ? [urlSeccion(1), urlSeccion(2)] : [urlSeccion(4)] });
  };
  return Object.assign(llamar, { pedidos });
}

async function repo() {
  const manuales = repoEnMemoria();
  await manuales.guardar({ marca: "Fono", modelo: "X21", url: INDICE, titulo: "Fono X21 Repair Manual", verificado: true, fuente: "fabricante" });
  return manuales;
}

const paso = (orden: number, texto = `p${orden}`): PasoReparacion => ({ id: `paso-${orden}`, orden, texto, piezas: [], riesgo: "bajo" });

describe("insertarPasos", () => {
  it("mete los pasos donde faltaban y renumera", () => {
    const r = insertarPasos([paso(1, "a"), paso(2, "b"), paso(3, "c")], 1, [paso(1, "x"), paso(2, "y")], 26);
    expect(r.map((p) => [p.orden, p.texto, p.id])).toEqual([
      [1, "a", "paso-1"],
      [2, "x", "paso-2"],
      [3, "y", "paso-3"],
      [4, "b", "paso-4"],
      [5, "c", "paso-5"],
    ]);
  });

  it("si se pasa del máximo, acorta lo nuevo: el final de la guía (armado y prueba) no se corta", () => {
    const r = insertarPasos([paso(1, "a"), paso(2, "b"), paso(3, "fin")], 1, [paso(1, "x"), paso(2, "y")], 4);
    expect(r.map((p) => p.texto)).toEqual(["a", "x", "b", "fin"]);
  });
});

describe("completar la guía con lo que faltaba", () => {
  beforeEach(() => olvidarConsultas());

  it("busca en el mismo manual las secciones de esa parte y la inserta donde faltaba, VERIFICADO", async () => {
    const c = claude("manual");
    const llamar = eleccion();
    const r = await armarKnowledgePack({ ficha, sintoma: "no carga", tipoEquipo: "celular" }, { enviar: c.enviar, llamar, fetch: red(), cache: sinCache, manuales: await repo(), subir: async () => "f" });

    expect(r.pack.pasos.map((p) => p.texto)).toEqual([
      "Probá con otro cable y otro cargador.",
      "Calentá el borde de la pantalla unos dos minutos con un secador.",
      "Levantá la pantalla con la ventosa y abrila como un libro hacia la izquierda.",
      "Desatornillá el soporte del puerto y sacalo con la pinza.",
      "Volvé a armar y probá la carga: tiene que aparecer el rayo.",
    ]);
    expect(r.pack.pasos.map((p) => p.orden)).toEqual([1, 2, 3, 4, 5]);
    expect(r.pack.pasos[1].cita).toMatchObject({ estado: "VERIFICADO", url: urlSeccion(2) });
    // Haiku eligió secciones para la parte que faltaba (no para el síntoma), sin volver a bajar el índice.
    expect(JSON.stringify(llamar.pedidos[1].contenido)).toMatch(/<pregunta>cómo abrir el equipo y sacar la pantalla<\/pregunta>/);
    expect(c.etapas.filter((e) => e === "bibliotecario: completar la guía")).toHaveLength(1);
    expect(r.eventos.find((e) => e.tipo === "guia_completada")?.mensaje).toBe("Completé la guía con 2 pasos del manual: cómo abrir el equipo y sacar la pantalla.");
  });

  it("si el manual no trae esa parte, la saca de iFixit (guía pública, NO_VERIFICABLE)", async () => {
    const c = claude("nada");
    const r = await armarKnowledgePack({ ficha, sintoma: "no carga", tipoEquipo: "celular" }, { enviar: c.enviar, llamar: eleccion(), fetch: red(), cache: sinCache, manuales: await repo(), subir: async () => "f" });
    expect(c.etapas.filter((e) => e === "bibliotecario: completar la guía")).toHaveLength(2);
    expect(r.pack.pasos[1].cita).toMatchObject({ estado: "NO_VERIFICABLE", url: `${GUIA}#s70` });
    expect(r.pack.pasos).toHaveLength(5);
    expect(r.eventos.find((e) => e.tipo === "guia_completada")?.mensaje).toMatch(/de una guía pública de iFixit/);
  });

  it("sin líneas FALTA no se completa nada (no gasta)", async () => {
    const c = claude("manual");
    const sinFalta: EnviarMensaje = async (p, etapa) => {
      if (etapa === "bibliotecario: leer manual web") {
        return mensaje([{ type: "text", text: "PASO|1|Desatornillá el soporte del puerto.|conector_carga|medio", citations: [citaTexto(0, CITADO)] }]);
      }
      return c.enviar(p, etapa);
    };
    const r = await armarKnowledgePack({ ficha, sintoma: "no carga", tipoEquipo: "celular" }, { enviar: sinFalta, llamar: eleccion(), fetch: red(), cache: sinCache, manuales: await repo(), subir: async () => "f" });
    expect(c.etapas).not.toContain("bibliotecario: completar la guía");
    expect(r.pack.pasos).toHaveLength(1);
  });
});
