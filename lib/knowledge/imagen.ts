import { getDocumentProxy, renderPageAsImage } from "unpdf";
import { normalizar } from "../intake/chapa";
import { supabaseServidor } from "../supabase/cliente";
import { subirImagen } from "../supabase/repo";

/**
 * Imagen real de la vista interior del manual, para mostrarla al lado del 3D (pedido de Diego):
 * es la referencia de cómo se ve el equipo por dentro. La hace el código (sin IA, sin créditos):
 * dibuja la página del PDF a PNG y la sube a Supabase Storage. Si algo falla, no hay imagen
 * y la guía sigue igual.
 */

export type VistaInteriorImagen = {
  url: string;
  /** Página física del manual completo (1 = primera hoja). */
  pagina: number;
  /** VERIFICADO: la lectura con citas de la API confirmó que esa página es la vista interior. */
  estado: "VERIFICADO" | "NO_VERIFICADO";
};

/** Ancho del PNG en píxeles: legible en el celular sin pesar de más. */
const ANCHO_PX = 1200;

/** Dibuja una página del PDF (física, 1 = primera) como PNG. */
export async function paginaComoPng(datos: Uint8Array, pagina: number): Promise<Uint8Array> {
  const pdf = await getDocumentProxy(datos.slice());
  try {
    const ancho = (await pdf.getPage(pagina)).getViewport({ scale: 1 }).width;
    const png = await renderPageAsImage(pdf, pagina, { canvasImport: () => import("@napi-rs/canvas"), scale: ANCHO_PX / ancho });
    return new Uint8Array(png);
  } finally {
    await pdf.loadingTask.destroy();
  }
}

/** Sube el PNG y devuelve su URL pública (null si no hay Supabase o falla). Se reemplaza en los tests. */
export type SubirPng = (nombre: string, png: Uint8Array) => Promise<string | null>;

export const subirPngSupabase: SubirPng = async (nombre, png) =>
  subirImagen(supabaseServidor(), "manuales", nombre, Buffer.from(png).toString("base64"), "image/png");

/**
 * PNG de varias páginas del manual (solo páginas del manual, nunca fotos de la persona), abriendo el PDF una vez.
 * `hojas`: { hoja dentro de `datos`, página del manual completo }. Devuelve { página del manual: URL }.
 * Lo que falle se saltea: nunca rompe la guía.
 */
export async function imagenesDePaginas(
  datos: Uint8Array,
  equipo: { marca: string | null; modelo: string },
  hojas: { hoja: number; pagina: number }[],
  subir: SubirPng = subirPngSupabase,
): Promise<Record<number, string>> {
  const salida: Record<number, string> = {};
  if (hojas.length === 0) return salida;
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | null = null;
  try {
    pdf = await getDocumentProxy(datos.slice());
    for (const { hoja, pagina } of hojas) {
      try {
        const ancho = (await pdf.getPage(hoja)).getViewport({ scale: 1 }).width;
        const png = await renderPageAsImage(pdf, hoja, { canvasImport: () => import("@napi-rs/canvas"), scale: ANCHO_PX / ancho });
        const url = await subir(`${normalizar(equipo.marca ?? "")}_${normalizar(equipo.modelo)}_p${pagina}`, new Uint8Array(png));
        if (url) salida[pagina] = url;
      } catch (e) {
        console.error(`[knowledge] no pude dibujar la página ${pagina}:`, (e as Error).message);
      }
    }
  } catch (e) {
    console.error("[knowledge] no pude abrir el PDF para dibujar páginas:", (e as Error).message);
  } finally {
    await pdf?.loadingTask.destroy();
  }
  return salida;
}
