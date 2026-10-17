import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { Cita, PasoReparacion, Pieza, Riesgo, Repuesto } from "../../shared";
import { evaluarRiesgo } from "../safety/riesgos";
import { normalizar } from "../intake/chapa";

/**
 * El modelo escribe el knowledge pack como líneas marcadas, con citas de la API:
 *
 *   PIEZA|ventilador|Ventilador|sobre el disipador, a la derecha|12
 *   PASO|1|Quitá los 10 tornillos de la tapa inferior.|tapa_inferior|bajo
 *   REPUESTO|ventilador|5F10S13875
 *   ADVERTENCIA|Desconectá la batería antes de tocar la placa.
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

export function citaDesde(c: Anthropic.TextCitation, docPorDefecto: string): Cita | null {
  if (c.type === "page_location" && c.cited_text.trim().length >= 8) {
    return { doc: c.document_title ?? docPorDefecto, pagina: c.start_page_number, estado: "VERIFICADO" };
  }
  if (c.type === "web_search_result_location") {
    return { doc: c.title ?? c.url, url: c.url, estado: "NO_VERIFICABLE" };
  }
  return null;
}

function mejorCita(citas: Anthropic.TextCitation[], doc: string): Cita | undefined {
  const convertidas = citas.map((c) => citaDesde(c, doc)).filter((c): c is Cita => c !== null);
  return convertidas.find((c) => c.estado === "VERIFICADO") ?? convertidas[0];
}

export type Contenido = {
  piezas: Pieza[];
  pasos: PasoReparacion[];
  repuestos: z.infer<typeof Repuesto>[];
  advertencias: string[];
  descartadas: string[];
};

const ID_PIEZA = /^[a-z0-9_]+$/;

export function parsearContenido(lineas: Linea[], doc: string): Contenido {
  const r: Contenido = { piezas: [], pasos: [], repuestos: [], advertencias: [], descartadas: [] };
  const idsPiezas = new Set<string>();

  for (const l of lineas) {
    const campos = l.texto.replace(/^[-*\s`]+|`+$/g, "").split("|").map((c) => c.trim());
    const tipo = campos[0]?.toUpperCase();
    const cita = mejorCita(l.citas, doc);

    if (tipo === "PIEZA" && campos.length >= 4) {
      const [, id, nombre, ubicacion, etiqueta] = campos;
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
      const [, orden, texto, piezas, riesgo] = campos;
      const propuesto = Riesgo.safeParse(riesgo.toLowerCase());
      // La tabla de seguridad decide; la IA solo puede subir el riesgo.
      const evaluado = evaluarRiesgo(texto, { riesgoPropuesto: propuesto.success ? propuesto.data : "medio", ignorarNegadas: true });
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
        (c) => c.type === "page_location" && normalizar(c.cited_text).includes(normalizar(numeroParte)),
      );
      if (cita?.estado === "VERIFICADO" && enManual && numeroParte.length >= 4) {
        r.repuestos.push({ pieza: pieza.toLowerCase(), numeroParte, cita });
      } else r.descartadas.push(l.texto);
    } else if (tipo === "ADVERTENCIA" && campos[1]) {
      r.advertencias.push(campos.slice(1).join(" | "));
    }
  }

  r.pasos.sort((a, b) => a.orden - b.orden);
  return r;
}
