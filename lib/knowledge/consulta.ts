import type Anthropic from "@anthropic-ai/sdk";
import { subirArchivo, type LlamarIA, type SubirArchivo } from "../ia/claude";
import { descargarPdf, type Fetch, type Pdf } from "./descargar";
import { nombreExtracto, prepararExtracto } from "./extracto";
import { manualDelModelo } from "./fuentes";
import { buscarGuiaIfixit, manualWebDeIfixit } from "./ifixit";
import { bloqueManual } from "./lector";
import { esSoloGuia, type RegistroManual, type RepoManuales } from "./manuales";
import { armarManualWeb, bloquesManualWeb, elegirSecciones, leerPaginaWeb, pareceIndice, type ManualWeb, type PaginaWeb } from "./manualweb";

/**
 * Consulta puntual del experto ("¿cómo cambio el conector de carga?"): si el knowledge pack no alcanza,
 * el código arma una fuente chica PARA ESA PREGUNTA, no la del síntoma:
 * 1. El manual oficial del equipo (el que guardó el bibliotecario): PDF → extracto con las páginas del
 *    procedimiento de esa pieza; manual web → las secciones de esa pieza. Citas VERIFICADO, salvo que el manual no
 *    sea el oficial de este modelo (`manualDelModelo`): se lee igual, con citas NO_VERIFICABLE.
 * 2. Si el manual no cubre la pieza (o no hay manual): la guía de iFixit para esa pregunta (guía pública,
 *    citas NO_VERIFICABLE).
 * "Consultá el manual" nunca es la respuesta: el manual lo lee el experto.
 */

/** `origen`: el manual guardado del equipo o una guía de iFixit. `oficial`: sus citas cuentan como VERIFICADO. */
export type FuenteConsulta = { origen: "manual" | "ifixit"; oficial: boolean } & (
  /** Extracto del manual en PDF subido a la Files API; `paginas` = las del manual completo. */
  | { tipo: "pdf"; titulo: string; url: string; fileId: string; paginas: number[] }
  /** Secciones de texto (manual web o guía pública); cada cita lleva la URL de su sección. */
  | { tipo: "web"; titulo: string; url: string; manual: ManualWeb }
);

export type DepsConsulta = {
  manuales?: RepoManuales;
  fetch?: Fetch;
  /** Elegir páginas o secciones (Haiku, JSON). */
  llamar?: LlamarIA;
  subir?: SubirArchivo;
};

/** El manual oficial guardado para el equipo del pack. El pack trae "Marca Modelo" junto: se prueba cada corte. */
export async function manualGuardado(nombre: string, repo: RepoManuales): Promise<RegistroManual | null> {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  for (let i = 0; i < Math.min(palabras.length, 4); i++) {
    const r = await repo.buscar(i === 0 ? null : palabras.slice(0, i).join(" "), palabras.slice(i).join(" "));
    if (r && !esSoloGuia(r)) return r;
  }
  return null;
}

/** Memoria del proceso: el último PDF bajado y las fuentes ya armadas (la misma pregunta no vuelve a pagar). */
const pdfs = new Map<string, Pdf>();
const fuentes = new Map<string, FuenteConsulta>();
const MAX_EN_MEMORIA = { pdfs: 2, fuentes: 50 };

function recordar<T>(m: Map<string, T>, clave: string, valor: T, max: number): T {
  m.delete(clave);
  m.set(clave, valor);
  while (m.size > max) m.delete(m.keys().next().value!);
  return valor;
}

const claveDe = (url: string, pregunta: string) => `${url}|${pregunta.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, " ").trim()}`;

/** Para tests. */
export function olvidarConsultas() {
  pdfs.clear();
  fuentes.clear();
}

/**
 * Fuente del manual oficial enfocada en la pregunta (o en una parte del procedimiento que falta), o null si no se
 * pudo bajar o leer. `previo`: el PDF o el índice web que ya se bajaron (al armar la guía), para no volver a bajarlos.
 * `r.oficial`: si ya se sabe (al armar la guía); si no, se decide con el modelo y la fuente del registro.
 */
export async function fuenteDelManual(
  r: Pick<RegistroManual, "url" | "titulo"> & Partial<Pick<RegistroManual, "modelo" | "fuente">> & { oficial?: boolean },
  equipo: string,
  pregunta: string,
  deps: DepsConsulta = {},
  previo: { pdf?: Pdf; indice?: PaginaWeb } = {},
): Promise<FuenteConsulta | null> {
  const clave = claveDe(r.url, pregunta);
  const guardada = fuentes.get(clave);
  if (guardada) return guardada;
  const oficial = r.oficial ?? (r.modelo ? manualDelModelo(r.modelo, r).oficial : true);
  const pdf = previo.pdf ?? pdfs.get(r.url) ?? (previo.indice ? null : await descargarPdf(r.url, deps.fetch));
  if (pdf) {
    recordar(pdfs, r.url, pdf, MAX_EN_MEMORIA.pdfs);
    const e = await prepararExtracto(new Uint8Array(pdf.datos), equipo, pregunta, [], deps.llamar, "pregunta");
    const fileId = await (deps.subir ?? subirArchivo)(Buffer.from(e.datos), nombreExtracto(e.paginas));
    return recordar(fuentes, clave, { tipo: "pdf", origen: "manual", titulo: r.titulo, url: r.url, fileId, paginas: e.paginas, oficial }, MAX_EN_MEMORIA.fuentes);
  }
  const indice = previo.indice ?? (await leerPaginaWeb(r.url, deps.fetch));
  if (!pareceIndice(indice)) return null;
  const secciones = await elegirSecciones(indice, equipo, pregunta, deps.llamar, "pregunta");
  const manual = await armarManualWeb(indice, secciones, deps.fetch);
  if (!manual.secciones.length) return null;
  return recordar(fuentes, clave, { tipo: "web", origen: "manual", titulo: r.titulo, url: r.url, manual: { ...manual, titulo: r.titulo }, oficial }, MAX_EN_MEMORIA.fuentes);
}

/** La guía de iFixit para la pregunta (guía pública), o null si no hay una de ese modelo. Sin IA. */
export async function fuenteIfixit(equipo: string, pregunta: string, f?: Fetch): Promise<FuenteConsulta | null> {
  const clave = claveDe(`ifixit:${equipo}`, pregunta);
  const guardada = fuentes.get(clave);
  if (guardada) return guardada;
  const guia = await buscarGuiaIfixit(equipo, pregunta, f);
  if (!guia) return null;
  const manual = manualWebDeIfixit(guia);
  return recordar(fuentes, clave, { tipo: "web", origen: "ifixit", titulo: guia.titulo, url: guia.url, manual, oficial: false }, MAX_EN_MEMORIA.fuentes);
}

/** Documentos para la lectura (con citas y caché de prompts). */
export function bloquesDeFuente(f: FuenteConsulta): Anthropic.DocumentBlockParam[] {
  return f.tipo === "pdf" ? [bloqueManual({ fileId: f.fileId, titulo: f.titulo })] : bloquesManualWeb(f.manual);
}

/** URL de cada documento (para la cita de un texto web). */
export function urlsDeFuente(f: FuenteConsulta): string[] | undefined {
  return f.tipo === "web" ? f.manual.secciones.map((s) => s.url) : undefined;
}

