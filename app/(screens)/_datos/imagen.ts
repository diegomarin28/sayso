/** Imagen lista para mandar a /api/intake (mismo formato que `ImagenSchema` de lib/intake). */
export type ImagenB64 = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };

const LADO_MAX = 1600;

export class ErrorImagen extends Error {}

/** Para mostrar la imagen ya preparada (sirve también para HEIC, que Chrome no muestra). */
export const vistaPrevia = (imagen: ImagenB64) => `data:${imagen.mediaType};base64,${imagen.base64}`;

/**
 * Achica la foto del celular (suelen pesar 3–8 MB) a JPEG de 1600 px de lado como máximo,
 * así entra en el límite de 5 MB de la API y viaja rápido. La chapa se sigue leyendo bien.
 * Acepta lo que el navegador sepa abrir (JPG, PNG, WebP, GIF, AVIF…) y además HEIC del iPhone.
 */
export async function prepararImagen(archivo: File): Promise<ImagenB64> {
  const bitmap = await abrir(archivo);
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mediaType: "image/jpeg" };
}

const esHeic = (archivo: File) => /hei[cf]/i.test(archivo.type) || /\.hei[cf]$/i.test(archivo.name);

async function abrir(archivo: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(archivo);
  } catch (e) {
    if (esHeic(archivo)) {
      try {
        // Se carga solo cuando hace falta (trae libheif en WebAssembly, pesa varios MB).
        const { heicTo } = await import("heic-to");
        return await heicTo({ blob: archivo, type: "bitmap" });
      } catch (e2) {
        console.error(
          "[imagen] no se pudo convertir HEIC",
          archivo.size,
          e2 instanceof Error ? e2.message : JSON.stringify(e2),
        );
      }
    } else {
      console.error("[imagen] no se pudo abrir", archivo.type, archivo.size, e);
    }
    throw new ErrorImagen("No pude abrir esa foto. Probá sacarla de nuevo o con otra app de cámara.");
  }
}
