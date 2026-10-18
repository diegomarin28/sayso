import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { fichaEjemplo } from "../../shared";
import type { EnviarMensaje } from "../ia/claude";
import { armarKnowledgePack, idDeGuiaIfixit, type CachePacks } from "./armar";
import { enCastellano, lineasConCitas, parsearContenido } from "./lineas";
import { repoEnMemoria } from "./manuales";

/**
 * Prueba real del iPhone 13 (#169, #175, #146): la guía del síntoma sin pasos en el manual oficial.
 * Sin red ni IA: manual web y API de iFixit simulados.
 */

const INDICE = "https://soporte.ej.com/manual";
const SECCIONES = ["Safety", "Introduction", "Display", "Battery", "Charging Port", "Speaker", "Camera", "Taptic Engine", "SIM Tray"];
const urlSeccion = (i: number) => `https://soporte.ej.com/manual/${i}`;
const GUIA_URL = "https://www.ifixit.com/Guide/Fono+X21+Charging+Port/3";

function red(): typeof fetch {
  return (async (url: string | URL) => {
    const u = String(url);
    if (u === INDICE) {
      const lista = SECCIONES.map((t, i) => `<li><a href="${urlSeccion(i)}">${t}</a></li>`).join("");
      return new Response(`<html><head><title>Fono X21 Repair Manual</title></head><body><ul>${lista}</ul></body></html>`, { headers: { "content-type": "text/html" } });
    }
    const s = u.match(/^https:\/\/soporte\.ej\.com\/manual\/(\d+)$/);
    if (s) return new Response(`<html><body><h1>${SECCIONES[+s[1]]}</h1><p>Remove the two screws next to the connector and lift it with tweezers.</p></body></html>`, { headers: { "content-type": "text/html" } });
    const api = decodeURIComponent(u.replace("https://www.ifixit.com/api/2.0", ""));
    if (/^\/search\/.*x21.*\?filter=category/i.test(api)) return Response.json({ results: [{ title: "Fono X21" }] });
    if (api === "/wikis/CATEGORY/Fono X21") {
      return Response.json({ title: "Fono X21", description: "Repair guides for the Fono X21 smartphone.", guides: [{ guideid: 3, title: "Fono X21 Charging Port Replacement", subject: "Charging Port", type: "replacement" }] });
    }
    if (api === "/guides/3") {
      return Response.json({
        guideid: 3,
        title: "Fono X21 Charging Port Replacement",
        url: GUIA_URL,
        category: "Fono X21",
        subject: "Charging Port",
        difficulty: "Moderate",
        author: { username: "Autora" },
        tools: [{ text: "Suction Handle" }],
        parts: [{ text: "Charging Port" }],
        steps: [{ stepid: 300, title: "Clean the port", lines: [{ bullet: "black", text_raw: "Gently clean the port with a toothpick." }], media: { type: "image", data: [{ standard: "https://img.ej/300.standard" }] } }],
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

/** Claude falso por etapa: el manual no da pasos para el síntoma; la guía de iFixit sí. */
function claude(conManualAdjunto: boolean) {
  const etapas: string[] = [];
  const pedidos: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const enviar: EnviarMensaje = async (p, etapa) => {
    etapas.push(etapa ?? "");
    pedidos.push(p);
    if (String(p.system).includes("bibliotecario")) return mensaje([{ type: "text", text: '{"encontrado":false,"url":null,"titulo":null,"fuente":null,"formato":null}' }]);
    if (etapa === "bibliotecario: guía de iFixit") {
      // Con el manual adjunto, los documentos 0..n-1 son del manual oficial y el último es el paso de iFixit.
      const docs = (p.messages[0].content as Anthropic.ContentBlockParam[]).filter((b) => b.type === "document").length;
      return mensaje([
        { type: "text", text: "PASO|1|Apagá el celular y mirá el puerto con una linterna: tiene que verse limpio.|puerto_carga|bajo", citations: [citaTexto(docs - 1, "Gently clean the port with a toothpick.")] },
        ...(conManualAdjunto
          ? [{ type: "text", text: "\nPASO|2|Sacá los dos tornillos al lado del conector y levantalo con la pinza.Remove the two screws next to the connector.|puerto_carga|medio", citations: [citaTexto(0, "Remove the two screws next to the connector and lift it with tweezers.")] }]
          : []),
        { type: "text", text: "\nADVERTENCIA|No encontré en las fuentes el manual de servicio de este modelo." },
        { type: "text", text: "\nADVERTENCIA|Si la batería está hinchada, no la toques." },
      ]);
    }
    return mensaje([{ type: "text", text: "nada útil para el síntoma" }]);
  };
  return { enviar, etapas, pedidos };
}

describe("guía pública del síntoma (sin pasos en el manual oficial)", () => {
  it("usa iFixit antes que la búsqueda web; lo que está en el manual sale VERIFICADO y lo demás como guía pública (#175)", async () => {
    const manuales = repoEnMemoria();
    await manuales.guardar({ marca: "Fono", modelo: "X21", url: INDICE, titulo: "Fono X21 Repair Manual", verificado: true, fuente: "fabricante" });
    const c = claude(true);
    const llamar = async () => JSON.stringify({ secciones: [urlSeccion(4), urlSeccion(3)] });
    const r = await armarKnowledgePack({ ficha, sintoma: "no carga", tipoEquipo: "celular" }, { enviar: c.enviar, llamar, fetch: red(), cache: sinCache, manuales, subir: async () => "f" });

    expect(c.etapas).not.toContain("bibliotecario: guía pública"); // sin búsqueda web
    expect(r.pack.verificado).toBe(false);
    expect(r.pack.pasos[0].cita).toMatchObject({ estado: "NO_VERIFICABLE", url: `${GUIA_URL}#s300` });
    expect(r.pack.pasos[1].cita).toMatchObject({ estado: "VERIFICADO", url: urlSeccion(4) });
    expect(r.pack.pasos[1].texto).toBe("Sacá los dos tornillos al lado del conector y levantalo con la pinza."); // sin el inglés pegado (#169)
    expect(r.pack.advertencias).toEqual(["Si la batería está hinchada, no la toques."]); // la nota sobre las fuentes no es una advertencia
    expect(r.fotosPasos).toEqual({ [`${GUIA_URL}#s300`]: "https://img.ej/300.standard" });
    expect(r.pack.fuentes.map((f) => f.url)).toEqual([GUIA_URL, INDICE]);
    expect(r.pack.fuentes[0].doc).toMatch(/iFixit.*CC BY-NC-SA/);
    // La lectura de la guía recibió las secciones del manual oficial adjuntas, y la tarea pide citarlo.
    const lectura = c.pedidos[c.etapas.indexOf("bibliotecario: guía de iFixit")];
    const contenido = lectura.messages[0].content as Anthropic.ContentBlockParam[];
    expect(contenido.filter((b) => b.type === "document").map((b) => (b as Anthropic.DocumentBlockParam).title)).toEqual(["Charging Port", "Battery", expect.stringMatching(/herramientas y piezas/), expect.stringMatching(/^Paso 1/)]);
    expect(JSON.stringify(contenido.at(-1))).toMatch(/citá el manual/);
    expect(r.eventos.map((e) => e.tipo)).toContain("guia_ifixit");
  });

  it("sin manual: guarda la guía de iFixit y la próxima vez la relee por su API, sin volver a buscar el manual", async () => {
    const manuales = repoEnMemoria();
    const c = claude(false);
    const deps = { enviar: c.enviar, fetch: red(), cache: sinCache, manuales, subir: async () => "f" };
    const r1 = await armarKnowledgePack({ ficha, sintoma: "no carga", tipoEquipo: "celular" }, deps);
    expect(r1.pack.pasos).toHaveLength(1);
    expect(await manuales.buscar("Fono", "X21")).toMatchObject({ fuente: "ifixit", fuentes_publicas: [GUIA_URL] });

    const antes = c.etapas.filter((e) => e.startsWith("bibliotecario: buscar") || e === "bibliotecario").length;
    const r2 = await armarKnowledgePack({ ficha, sintoma: "carga lento", tipoEquipo: "celular" }, deps);
    expect(c.etapas.filter((e) => e.startsWith("bibliotecario: buscar") || e === "bibliotecario").length).toBe(antes);
    expect(r2.pack.pasos[0].cita?.url).toBe(`${GUIA_URL}#s300`);
    expect(r2.eventos.map((e) => e.tipo)).toContain("guia_publica_en_cache");
  });

  it("reconoce la URL de una guía de iFixit", () => {
    expect(idDeGuiaIfixit(GUIA_URL)).toBe(3);
    expect(idDeGuiaIfixit("https://otra.com/Guide/x/3")).toBeNull();
    expect(idDeGuiaIfixit(undefined)).toBeNull();
  });
});

describe("solo castellano en lo que se dice (#169)", () => {
  it("corta la frase original en inglés pegada al final, en pasos, ubicaciones y advertencias", () => {
    expect(enCastellano("Presioná el botón y abrila**Press the door-release button, and then open the toner-cartridge door.**")).toBe("Presioná el botón y abrila");
    expect(enCastellano("Revisá el rodillo de la bandeja 1: release two tabs between the roller collar and roller.")).toBe("Revisá el rodillo de la bandeja 1");
    expect(enCastellano("Limpiá el puerto. No uses aire comprimido. Gently clean the connector with a soft brush.")).toBe("Limpiá el puerto. No uses aire comprimido.");
    expect(enCastellano("Improper battery replacement, installation of damaged batteries could cause fire.")).toBe("");
    expect(enCastellano("Abrí la tapa del SSD (M.2) y sacá el tornillo.")).toBe("Abrí la tapa del SSD (M.2) y sacá el tornillo.");
    const c = parsearContenido(
      lineasConCitas([
        { text: "PIEZA|pantalla|Pantalla|cubre el frente del equipo; Reinstall the following part to complete reassembly: Display.|" },
        { text: "\nADVERTENCIA|Improper battery replacement, installation of damaged batteries could cause fire." },
      ]),
      "Manual",
    );
    expect(c.piezas[0].ubicacion).toBe("cubre el frente del equipo");
    expect(c.advertencias).toEqual([]);
  });
});
