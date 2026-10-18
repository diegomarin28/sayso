import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { fichaEjemplo } from "../../shared";
import type { EnviarMensaje } from "../ia/claude";
import { armarKnowledgePack, type CachePacks } from "./armar";
import { buscarManual } from "./buscar";
import { lineasConCitas, parsearContenido } from "./lineas";
import { repoEnMemoria } from "./manuales";
import { armarManualWeb, bloquesManualWeb, elegirSecciones, enlacesDe, htmlATexto, leerPaginaWeb, pareceIndice } from "./manualweb";

const BASE = "https://soporte.ej.com/es/100";

/** Índice de un manual web ficticio, con secciones del mismo sitio (y una de otro sitio). */
const INDICE = `<html><head><title>NB-15 Repair Manual - Soporte</title><script>no()</script></head><body>
<nav><a href="/menu">Menú del sitio</a></nav>
<h1>NB-15 Repair Manual</h1><ul>
${["Battery Safety", "Internal View", "Orderable Parts", "Screws", "Tools", "First Steps", "Display", "Battery", "Camera"]
  .map((t, i) => `<li><a href="https://soporte.ej.com/es/${200 + i}#x">${t}</a></li>`)
  .join("\n")}
<li><a href="https://otro.com/guia">Guía de otro sitio</a></li></ul></body></html>`;

const SECCION = (titulo: string) =>
  `<html><body><h1>${titulo}</h1><p>Paso 1: Remove the two screws.&nbsp;Use the suction cup.</p><table><tr><td>661-21991</td><td>Display</td></tr></table></body></html>`;

const fetchWeb = (async (url: string | URL) => {
  const u = String(url);
  if (u === BASE) return new Response(INDICE, { headers: { "content-type": "text/html; charset=utf-8" } });
  if (u.startsWith("https://soporte.ej.com/es/2")) return new Response(SECCION(`Sección ${u.slice(-3)}`), { headers: { "content-type": "text/html" } });
  return new Response("no", { status: 404 });
}) as typeof fetch;

describe("manual web: código, sin IA", () => {
  it("pasa el HTML a texto legible, sin scripts ni menú, con entidades decodificadas", () => {
    const t = htmlATexto(SECCION("Display"));
    expect(t).toContain("## Display");
    expect(t).toContain("Remove the two screws. Use the suction cup.");
    expect(t).toContain("661-21991 | Display");
    expect(htmlATexto(INDICE)).not.toContain("no()");
    expect(htmlATexto(INDICE)).not.toContain("Menú del sitio");
  });

  it("saca los enlaces del mismo sitio, sin anclas ni repetidos", () => {
    const e = enlacesDe(INDICE, BASE);
    expect(e[0]).toEqual({ titulo: "Battery Safety", url: "https://soporte.ej.com/es/200" });
    expect(e.some((x) => x.url.includes("otro.com"))).toBe(false);
  });

  it("reconoce el índice de un manual (varias secciones) y no una página suelta", async () => {
    expect(pareceIndice(await leerPaginaWeb(BASE, fetchWeb))).toBe(true);
    expect(pareceIndice(await leerPaginaWeb("https://soporte.ej.com/es/200", fetchWeb))).toBe(false);
    expect(await leerPaginaWeb("https://soporte.ej.com/nada", fetchWeb)).toBeNull();
  });

  it("solo usa secciones elegidas que estaban en el índice", async () => {
    const indice = (await leerPaginaWeb(BASE, fetchWeb))!;
    const llamar = async () => JSON.stringify({ secciones: ["https://soporte.ej.com/es/206#a", "https://inventada.com/x", "https://soporte.ej.com/es/202"] });
    const elegidas = await elegirSecciones(indice, "EJ NB-15 (celular)", "pantalla rota", llamar);
    expect(elegidas.map((e) => e.titulo)).toEqual(["Display", "Orderable Parts"]);
    const m = await armarManualWeb(indice, elegidas, fetchWeb);
    expect(m.secciones).toHaveLength(2);
    const bloques = bloquesManualWeb(m);
    expect(bloques[0]).toMatchObject({ type: "document", source: { type: "text" }, citations: { enabled: true } });
    expect(bloques[1].cache_control).toEqual({ type: "ephemeral" });
  });
});

const texto = (texto: string, documento: number, citado: string): Anthropic.TextCitation => ({
  type: "char_location",
  cited_text: citado,
  document_index: documento,
  document_title: `Sección ${documento}`,
  start_char_index: 0,
  end_char_index: citado.length,
  file_id: null,
  ...({} as Record<string, never>),
}) as Anthropic.TextCitation & { texto?: string };

describe("citas de texto de un manual web", () => {
  it("un paso citado queda VERIFICADO con la URL de su sección, y el número de parte se acepta si está en el texto", () => {
    const urls = ["https://soporte.ej.com/es/206", "https://soporte.ej.com/es/202"];
    const c = parsearContenido(
      lineasConCitas([
        { text: "PASO|1|Sacá los dos tornillos.|pantalla|bajo", citations: [texto("", 0, "Remove the two screws.")] },
        { text: "\nREPUESTO|pantalla|661-21991", citations: [texto("", 1, "661-21991 | Display")] },
        { text: "\nREPUESTO|bateria|661-99999", citations: [texto("", 1, "661-21991 | Display")] },
      ]),
      "Manual",
      urls,
    );
    expect(c.pasos[0].cita).toEqual({ doc: "Sección 0", url: urls[0], estado: "VERIFICADO" });
    expect(c.repuestos.map((r) => r.numeroParte)).toEqual(["661-21991"]);
  });
});

describe("bibliotecario y armado con un manual web", () => {
  const mensaje = (content: unknown[], stop_reason = "end_turn") => ({ content, stop_reason }) as unknown as Anthropic.Message;

  /** Bibliotecario que prueba el índice con probar_manual_web; lectura que cita la sección 0. */
  function claude() {
    const llamadas: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const enviar: EnviarMensaje = async (p) => {
      llamadas.push(p);
      if (String(p.system).includes("bibliotecario")) {
        const ultimo = p.messages.at(-1)!;
        const yaProbo = Array.isArray(ultimo.content) && ultimo.content.some((b) => b.type === "tool_result");
        if (!yaProbo) return mensaje([{ type: "tool_use", id: "t1", name: "probar_manual_web", input: { url: BASE } }], "tool_use");
        return mensaje([{ type: "text", text: `{"encontrado":true,"url":"${BASE}","titulo":"NB-15 Repair Manual","fuente":"fabricante","formato":"web"}` }]);
      }
      return mensaje([
        { type: "text", text: "PASO|1|Calentá el borde y usá la ventosa para abrirlo.|pantalla|medio", citations: [texto("", 0, "Use the suction cup.")] },
        { type: "text", text: "\nREPUESTO|pantalla|661-21991", citations: [texto("", 1, "661-21991 | Display")] },
      ]);
    };
    return { enviar, llamadas };
  }

  it("el bibliotecario acepta un manual web que probar_manual_web confirmó", async () => {
    const r = await buscarManual({ marca: "EJ", modelo: "NB-15", clase: "celular" }, { enviar: claude().enviar, fetch: fetchWeb });
    expect(r).toMatchObject({ formato: "web", url: BASE, fuente: "fabricante" });
  });

  it("arma la guía VERIFICADA desde el manual web, con números de parte, y lo guarda para la próxima", async () => {
    const c = claude();
    const manuales = repoEnMemoria();
    const sinCache: CachePacks = { get: async () => undefined, set: async () => {} };
    const llamar = async () => JSON.stringify({ secciones: ["https://soporte.ej.com/es/206", "https://soporte.ej.com/es/202"] });
    const r = await armarKnowledgePack(
      { ficha: fichaEjemplo, sintoma: "pantalla rota", tipoEquipo: "celular" },
      { enviar: c.enviar, llamar, fetch: fetchWeb, cache: sinCache, manuales, subir: async () => "file_x" },
    );
    expect(r.pack.verificado).toBe(true);
    expect(r.pack.fuentes[0]).toEqual({ doc: "NB-15 Repair Manual", url: BASE });
    expect(r.pack.pasos[0].cita).toMatchObject({ estado: "VERIFICADO", url: "https://soporte.ej.com/es/206" });
    expect(r.pack.repuestos.map((x) => x.numeroParte)).toEqual(["661-21991"]);
    expect(r.manual).toBeNull(); // sin PDF: el chat responde con el pack y el 3D usa su plantilla
    expect(r.eventos.map((e) => e.tipo)).toContain("secciones_elegidas");
    // La lectura recibió las secciones como texto con citas, y la tarea pide arrancar con el equipo cerrado.
    const lectura = c.llamadas.at(-1)!;
    const contenido = lectura.messages[0].content as Anthropic.ContentBlockParam[];
    expect(contenido.filter((b) => b.type === "document")).toHaveLength(2);
    expect(JSON.stringify(contenido.at(-1))).toMatch(/CERRADO/);
    expect(await manuales.buscar(fichaEjemplo.marca.valor, fichaEjemplo.modelo.valor!)).toMatchObject({ url: BASE, verificado: true });
  });
});
