import { PDFDocument } from "pdf-lib";
import { descargarPdf, type Fetch } from "../knowledge/descargar";

/**
 * Recorte del manual para el cartógrafo: en vez de mandarle a la IA el manual entero
 * (cientos de miles de tokens), un PDF chico con solo la vista interior y la vista
 * explosionada que ya encontró el bibliotecario. Lo hace el código, sin IA.
 */

/** Máximo de páginas del recorte (vista interior + vistas explosionadas). */
export const MAX_PAGINAS_RECORTE = 4;

/** PDF chico en base64 y la página del manual a la que corresponde cada hoja (en orden). */
export type ManualRecortado = { base64: string; paginas: number[] };

/**
 * Copia solo `paginas` (físicas, 1 = primera hoja) en un PDF nuevo. Descarta repetidas y
 * las que no existen. Null si no queda ninguna o si el PDF está cifrado (pdf-lib no lo descifra).
 */
export async function recortarPdf(datos: Uint8Array, paginas: number[]): Promise<ManualRecortado | null> {
  try {
    const original = await PDFDocument.load(datos, { ignoreEncryption: true, updateMetadata: false });
    if (original.isEncrypted) return null;
    const total = original.getPageCount();
    const elegidas = [...new Set(paginas)].filter((p) => Number.isInteger(p) && p >= 1 && p <= total).slice(0, MAX_PAGINAS_RECORTE);
    if (elegidas.length === 0) return null;
    const nuevo = await PDFDocument.create();
    const copiadas = await nuevo.copyPages(original, elegidas.map((p) => p - 1));
    copiadas.forEach((p) => nuevo.addPage(p));
    return { base64: await nuevo.saveAsBase64(), paginas: elegidas };
  } catch {
    return null;
  }
}

/** Páginas del recorte: la interior primero (dice DÓNDE está cada pieza), después las explosionadas. */
export function paginasRecorte(interior: number | null | undefined, explosionadas: number[] = []): number[] | null {
  if (!interior) return null; // sin vista interior la IA tiene que buscarla en el manual entero
  return [interior, ...explosionadas];
}

/** Baja el manual y lo recorta. Null si algo falla: el que llama sigue con el manual entero. */
export async function recortarManual(url: string, paginas: number[], f?: Fetch): Promise<ManualRecortado | null> {
  const pdf = await descargarPdf(url, f);
  return pdf ? recortarPdf(pdf.datos, paginas) : null;
}
