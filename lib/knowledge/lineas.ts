import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { Rasgos3D, Cita, PasoReparacion, Pieza, Riesgo, Repuesto, type KnowledgePack } from "../../shared";
import { evaluarRiesgo } from "../safety/riesgos";
import { normalizar } from "../intake/chapa";

/**
 * El modelo escribe el knowledge pack como líneas marcadas, con citas de la API:
 *
 *   PIEZA|ventilador|Ventilador|sobre el disipador, a la derecha|12
 *   PASO|1|Quitá los 10 tornillos de la tapa inferior.|tapa_inferior|bajo
 *   REPUESTO|ventilador|5F10S13875
 *   ADVERTENCIA|Desconectá la batería antes de tocar la placa.
 *   VISTA|explosionada|Vista explosionada general con la lista de piezas
 *   VISTA|interior|Equipo dado vuelta sin la tapa inferior
 *   FORMA|redonda
 *
 * Las citas NO las escribe el modelo: las pone la API (`citations`) con el texto
 * literal del PDF y su página. Por eso un paso con cita de página es VERIFICADO.
 * El código además exige que un número de parte aparezca en el texto citado.
 */

type Bloque = { text: string; citations?: Anthropic.TextCitation[] | null };

export type Linea = { texto: string; citas: Anthropic.TextCitation[] };

/** Junta los bloques de texto en líneas y le asigna a cada línea las citas de los bloques que la tocan. */
export function lineasConCitas(bloques: Bloque[]): Linea[] {
  const lineas: Linea[] = [];
  let actual: Linea = { texto: "", citas: [] };
  for (const b of bloques) {
    const partes = b.text.split("\n");
    partes.forEach((parte, i) => {
      if (i > 0) {
        lineas.push(actual);
        actual = { texto: "", citas: [] };
      }
      actual.texto += parte;
      if (b.citations?.length && parte.trim()) actual.citas.push(...b.citations);
    });
  }
  lineas.push(actual);
  return lineas.map((l) => ({ ...l, texto: l.texto.trim() })).filter((l) => l.texto);
}

/**
 * `urls`: URL de cada documento, cuando el manual es web (una sección por documento): la cita de
 * texto ("char_location") lleva la URL de la sección en vez de un número de página.
 */
/** Si las citas de texto de un documento cuentan como VERIFICADO: uno para todos, o por documento (manual oficial sí, guía pública no). */
export type Verificable = boolean | ((documento: number) => boolean);

export function citaDesde(c: Anthropic.TextCitation, docPorDefecto: string, urls?: string[], verificable: Verificable = true): Cita | null {
  if (c.type === "page_location" && c.cited_text.trim().length >= 8) {
    return { doc: c.document_title ?? docPorDefecto, pagina: c.start_page_number, estado: "VERIFICADO" };
  }
  if (c.type === "char_location" && c.cited_text.trim().length >= 8) {
    const url = urls?.[c.document_index];
    // Texto de un manual oficial: VERIFICADO. De una guía pública guardada: se cita, pero NO_VERIFICABLE.
    const oficial = typeof verificable === "function" ? verificable(c.document_index) : verificable;
    return { doc: c.document_title ?? docPorDefecto, ...(url ? { url } : {}), estado: oficial ? "VERIFICADO" : "NO_VERIFICABLE" };
  }
  if (c.type === "web_search_result_location") {
    return { doc: c.title ?? c.url, url: c.url, estado: "NO_VERIFICABLE" };
  }
  return null;
}

function mejorCita(citas: Anthropic.TextCitation[], doc: string, urls?: string[], verificable: Verificable = true): Cita | undefined {
  const convertidas = citas.map((c) => citaDesde(c, doc, urls, verificable)).filter((c): c is Cita => c !== null);
  return convertidas.find((c) => c.estado === "VERIFICADO") ?? convertidas[0];
}

export type ClaseVista = "explosionada" | "interior";

/**
 * Páginas del manual que usa el cartógrafo (/api/plano): la vista explosionada y una vista
 * del interior. Son páginas FÍSICAS del PDF (1 = primera hoja, la misma numeración que
 * `gs -dFirstPage`), tomadas de la cita de la API, no del número que escribe el modelo.
 */
export type Vistas = Record<ClaseVista, number | null>;

/** Un tramo del procedimiento que la fuente no trae (línea FALTA): el código lo busca y completa la guía. */
export type Faltante = { procedimiento: string; /** Cuántos PASO había antes de la línea: ahí va lo que se complete. */ despuesDe: number };

export type Contenido = {
  rasgos3D?: KnowledgePack["rasgos3D"];
  piezas: Pieza[];
  pasos: PasoReparacion[];
  repuestos: z.infer<typeof Repuesto>[];
  advertencias: string[];
  vistas: Vistas;
  descartadas: string[];
  faltantes: Faltante[];
  /** Forma de la pantalla del modelo (línea FORMA), para los tipos que tienen más de una (#246). */
  formaPantalla?: NonNullable<KnowledgePack["formaPantalla"]>;
};

/** "FORMA|redonda" o "FORMA|cuadrada" (tolera mayúsculas, "circular" y "rectangular"). */
function formaDe(campo: string | undefined): Contenido["formaPantalla"] {
  const c = normalizar(campo ?? "");
  if (/^(REDOND|CIRCUL)/.test(c)) return "redonda";
  if (/^(CUADRAD|RECTANG)/.test(c)) return "cuadrada";
  return undefined;
}

/** "VISTA|explosionada|…" o "VISTA|interior|…" (tolera mayúsculas y tildes). */
function claseVista(campo: string | undefined): ClaseVista | null {
  const c = normalizar(campo ?? "");
  if (c.startsWith("EXPLOSI")) return "explosionada";
  if (c.startsWith("INTERIOR")) return "interior";
  return null;
}

const ID_PIEZA = /^[a-z0-9_]+$/;

/** `tipoEquipo`: para la seguridad de cada paso (reglas y mensaje según el equipo). */
/**
 * Lo que se le dice a la persona va solo en castellano: si el modelo pegó al final la frase original del manual
 * en inglés (ej. "…y abrila**Press the door-release button…**"), se corta desde ahí. El original ya está en la cita.
 */
const PALABRAS_INGLES = new Set(
  "the and to of from with then remove press open release install reinstall following part complete gently clean is are still present inside before after this that your you it on in into out off by or be not do use using make sure step screw screws could cause may can will should must if when damaged improper".split(" "),
);
const PALABRAS_CASTELLANO = new Set("el la los las de del que y en con para por una un se al es lo sin su tu como si más hasta sobre desde".split(" "));

function esIngles(fragmento: string): boolean {
  const palabras = fragmento.toLowerCase().match(/[a-záéíóúñü]+/g) ?? [];
  const ingles = palabras.filter((p) => PALABRAS_INGLES.has(p)).length;
  const castellano = palabras.filter((p) => PALABRAS_CASTELLANO.has(p)).length;
  return ingles >= 2 && castellano === 0;
}

export function enCastellano(texto: string): string {
  // Cortes posibles: negritas, fin de frase, dos puntos, punto y coma, o una palabra pegada a otra en mayúscula.
  const marcado = texto.replace(/\*\*/g, "\u0000").replace(/([.:;!?])(?:\s+|(?=[A-ZÁÉÍÓÚÑ¿¡]))/g, "$1\u0000").replace(/(^|[^A-Za-zÁÉÍÓÚÑáéíóúñ])([a-záéíóúñ]{3,})([A-Z][a-z])/g, "$1$2\u0000$3");
  const partes = marcado.split("\u0000");
  const primeraInglesa = partes.findIndex((p, i) => i > 0 && esIngles(p));
  const queda = (primeraInglesa === -1 ? partes : partes.slice(0, primeraInglesa)).join(" ");
  const limpio = queda.replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").replace(/[;:,]\s*$/, "").trim();
  return esIngles(limpio) ? "" : limpio;
}

/** Una advertencia es un aviso de seguridad del equipo, no una nota sobre las fuentes ("no encontré el manual…"). */
const NOTA_DE_FUENTES = /\b(no encontr\w*|fuentes?|en ingl[eé]s|manual de servicio)\b/i;

export function parsearContenido(lineas: Linea[], doc: string, urls?: string[], tipoEquipo?: string, verificable: Verificable = true): Contenido {
  const r: Contenido = {
    piezas: [],
    pasos: [],
    repuestos: [],
    advertencias: [],
    vistas: { explosionada: null, interior: null },
    descartadas: [],
    faltantes: [],
  };
  const idsPiezas = new Set<string>();

  for (const l of lineas) {
    // Tolera viñetas, numeración, negritas y comillas de código alrededor de la línea.
    const limpia = l.texto.replace(/\*\*/g, "").replace(/^[\s`>]*(?:[-*•]+|\d+[.)])?\s*/, "").replace(/`+$/, "");
    const campos = limpia.split("|").map((c) => c.trim());
    const tipo = campos[0]?.toUpperCase();
    const cita = mejorCita(l.citas, doc, urls, verificable);

    if (tipo === "PIEZA" && campos.length >= 4) {
      const [, id, nombreCrudo, ubicacionCruda, etiqueta] = campos;
      const nombre = enCastellano(nombreCrudo) || nombreCrudo;
      const ubicacion = enCastellano(ubicacionCruda);
      const p = Pieza.safeParse({
        id: id.toLowerCase(),
        nombre,
        descripcion: nombre,
        ubicacion,
        // Solo números/códigos cortos de la vista explosionada (ej. "12", "3a").
        ...(etiqueta && /^[A-Za-z0-9-]{1,6}$/.test(etiqueta) ? { etiquetaManual: etiqueta } : {}),
      });
      if (p.success && !idsPiezas.has(p.data.id)) {
        idsPiezas.add(p.data.id);
        r.piezas.push(p.data);
      } else r.descartadas.push(l.texto);
    } else if (tipo === "PASO" && campos.length >= 5) {
      const [, orden, textoCrudo, piezas, riesgo] = campos;
      const texto = enCastellano(textoCrudo);
      const propuesto = Riesgo.safeParse(riesgo.toLowerCase());
      // La tabla de seguridad decide; la IA solo puede subir el riesgo.
      const evaluado = evaluarRiesgo(texto, { riesgoPropuesto: propuesto.success ? propuesto.data : "medio", ignorarNegadas: true, tipoEquipo });
      const p = PasoReparacion.safeParse({
        id: `paso-${orden}`,
        orden: Number(orden),
        texto,
        piezas: piezas
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((s) => ID_PIEZA.test(s)),
        riesgo: evaluado.riesgo,
        ...(cita ? { cita } : {}),
      });
      if (p.success) r.pasos.push(p.data);
      else r.descartadas.push(l.texto);
    } else if (tipo === "REPUESTO" && campos.length >= 3) {
      const [, pieza, numeroParte] = campos;
      // Solo si el número de parte aparece LITERAL en el texto citado del manual.
      const enManual = l.citas.some(
        (c) => (c.type === "page_location" || c.type === "char_location") && normalizar(c.cited_text).includes(normalizar(numeroParte)),
      );
      if (cita?.estado === "VERIFICADO" && enManual && numeroParte.length >= 4) {
        r.repuestos.push({ pieza: pieza.toLowerCase(), numeroParte, cita });
      } else r.descartadas.push(l.texto);
    } else if (tipo === "VISTA") {
      // La página sale de la cita de la API (texto de esa misma página), nunca del modelo.
      const clase = claseVista(campos[1]);
      const pagina = l.citas.find((c) => c.type === "page_location");
      if (clase && pagina?.type === "page_location" && r.vistas[clase] === null) r.vistas[clase] = pagina.start_page_number;
      else r.descartadas.push(l.texto);
    } else if (tipo === "RASGO" && campos.length === 4) {
      const [, equipo, campo, texto] = campos;
      const valor = /^(si|sí|true)$/.test(texto.toLowerCase()) ? true : /^(no|false)$/.test(texto.toLowerCase()) ? false : /^[0-3]$/.test(texto) ? Number(texto) : texto;
      const validado = Rasgos3D.safeParse({ [equipo]: { [campo]: valor } });
      const entrada = validado.success ? (validado.data as Record<string, Record<string, unknown>>)[equipo] : undefined;
      if (entrada && Object.hasOwn(entrada, campo)) {
        const anteriores = (r.rasgos3D as Record<string, Record<string, unknown>> | undefined)?.[equipo] ?? {};
        if (!Object.hasOwn(anteriores, campo)) r.rasgos3D = { ...r.rasgos3D, [equipo]: { ...anteriores, ...entrada } };
        else r.descartadas.push(l.texto);
      } else r.descartadas.push(l.texto);
    } else if (tipo === "FORMA") {
      // La primera que se entiende; una forma que no es ninguna de las dos se descarta.
      const forma = formaDe(campos[1]);
      if (forma && !r.formaPantalla) r.formaPantalla = forma;
      else r.descartadas.push(l.texto);
    } else if (tipo === "FALTA" && campos[1]) {
      const procedimiento = enCastellano(campos.slice(1).join(" ")) || campos.slice(1).join(" ");
      r.faltantes.push({ procedimiento: procedimiento.slice(0, 200), despuesDe: r.pasos.length });
    } else if (tipo === "ADVERTENCIA" && campos[1]) {
      const aviso = enCastellano(campos.slice(1).join(" | "));
      if (aviso && !NOTA_DE_FUENTES.test(aviso)) r.advertencias.push(aviso);
      else r.descartadas.push(l.texto);
    }
  }

  r.pasos.sort((a, b) => a.orden - b.orden);
  return r;
}
