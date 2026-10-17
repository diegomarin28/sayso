/** Imagen lista para mandar a /api/intake (mismo formato que `ImagenSchema` de lib/intake). */
export type ImagenB64 = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };

const LADO_MAX = 1600;

/**
 * Achica la foto del celular (suelen pesar 3–8 MB) a JPEG de 1600 px de lado como máximo,
 * así entra en el límite de 5 MB de la API y viaja rápido. La chapa se sigue leyendo bien.
 */
export class ErrorImagen extends Error {}

const DIRECTOS = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_DIRECTO = 4_500_000;

export async function prepararImagen(archivo: File): Promise<ImagenB64> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(archivo);
  } catch (e) {
    // Ej. HEIC del iPhone en Chrome: el navegador no lo sabe abrir. Si es un formato que la API
    // acepta y entra en el límite, se manda tal cual; si no, se le pide otra foto.
    console.error("[imagen] no se pudo abrir", archivo.type, archivo.size, e);
    const tipo = DIRECTOS.find((t) => t === archivo.type);
    if (tipo && archivo.size <= MAX_DIRECTO) return { base64: await aBase64(archivo), mediaType: tipo };
    throw new ErrorImagen(
      "No puedo abrir ese formato de foto. Sacala con la cámara desde acá o mandala como JPG.",
    );
  }
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mediaType: "image/jpeg" };
}

async function aBase64(archivo: File): Promise<string> {
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
