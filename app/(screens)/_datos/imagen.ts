/** Imagen lista para mandar a /api/intake (mismo formato que `ImagenSchema` de lib/intake). */
export type ImagenB64 = { base64: string; mediaType: "image/jpeg" };

const LADO_MAX = 1600;

/**
 * Achica la foto del celular (suelen pesar 3–8 MB) a JPEG de 1600 px de lado como máximo,
 * así entra en el límite de 5 MB de la API y viaja rápido. La chapa se sigue leyendo bien.
 */
export async function prepararImagen(archivo: File): Promise<ImagenB64> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return {
    base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
    mediaType: "image/jpeg",
  };
}
