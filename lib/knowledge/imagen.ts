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

export async function imagenVistaInterior(
  datos: Uint8Array,
  equipo: { marca: string | null; modelo: string },
  /** Página a dibujar dentro de `datos` (el extracto o el manual completo). */
  hoja: number,
  /** La misma página en el manual completo (la que se muestra). */
  pagina: number,
  estado: VistaInteriorImagen["estado"],
  subir: SubirPng = subirPngSupabase,
): Promise<VistaInteriorImagen | null> {
  try {
    const png = await paginaComoPng(datos, hoja);
    const url = await subir(`${normalizar(equipo.marca ?? "")}_${normalizar(equipo.modelo)}_p${pagina}`, png);
    return url ? { url, pagina, estado } : null;
  } catch (e) {
    console.error("[knowledge] no pude armar la imagen de la vista interior:", (e as Error).message);
    return null;
  }
}
