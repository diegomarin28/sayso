/**
 * Saca los metadatos de una foto antes de subirla a `fotos-usuarios` (docs/login.md §5): EXIF (con
 * el GPS, la fecha y el celular), XMP, IPTC y comentarios. El navegador ya los saca al reescalar con
 * canvas (`_datos/imagen.ts`), pero el servidor no confía en eso. Sin dependencias: recorre los
 * bloques del archivo y copia los que dibujan la imagen, sin volver a comprimirla.
 * Solo JPEG, PNG y WebP; si los bytes no son del tipo que dice, o están cortados, lanza ErrorImagen.
 */

export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"] as const;
export type TipoImagen = (typeof TIPOS_IMAGEN)[number];

export class ErrorImagen extends Error {}

export function sinMetadatos(bytes: Buffer, tipo: TipoImagen): Buffer {
  if (tipo === "image/jpeg") return jpeg(bytes);
  if (tipo === "image/png") return png(bytes);
  return webp(bytes);
}

/** APP0 (JFIF), APP2 (perfil de color) y APP14 (Adobe, para los colores): el resto de APPn y COM, afuera. */
const JPEG_SE_QUEDAN = new Set([0xe0, 0xe2, 0xee]);

function jpeg(b: Buffer): Buffer {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) throw new ErrorImagen("no es un JPEG");
  const partes: Buffer[] = [b.subarray(0, 2)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) throw new ErrorImagen("JPEG mal armado");
    while (b[i + 1] === 0xff) i++; // bytes de relleno
    const marca = b[i + 1];
    if (marca === undefined) throw new ErrorImagen("JPEG cortado");
    // Desde el primer barrido (SOS) son los datos de la imagen: van enteros.
    if (marca === 0xda || marca === 0xd9) {
      partes.push(b.subarray(i));
      return Buffer.concat(partes);
    }
    // Marcas sin largo (TEM y reinicios).
    if (marca === 0x01 || (marca >= 0xd0 && marca <= 0xd7)) {
      partes.push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > b.length) throw new ErrorImagen("JPEG cortado");
    const fin = i + 2 + b.readUInt16BE(i + 2);
    if (fin > b.length || fin < i + 4) throw new ErrorImagen("JPEG cortado");
    const metadato = (marca >= 0xe0 && marca <= 0xef && !JPEG_SE_QUEDAN.has(marca)) || marca === 0xfe;
    if (!metadato) partes.push(b.subarray(i, fin));
    i = fin;
  }
  throw new ErrorImagen("JPEG sin imagen");
}

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_METADATOS = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

function png(b: Buffer): Buffer {
  if (b.length < 8 || !b.subarray(0, 8).equals(FIRMA_PNG)) throw new ErrorImagen("no es un PNG");
  const partes: Buffer[] = [FIRMA_PNG];
  let i = 8;
  while (i + 8 <= b.length) {
    const tipo = b.toString("latin1", i + 4, i + 8);
    const fin = i + 12 + b.readUInt32BE(i);
    if (fin > b.length) throw new ErrorImagen("PNG cortado");
    if (!PNG_METADATOS.has(tipo)) partes.push(b.subarray(i, fin));
    if (tipo === "IEND") return Buffer.concat(partes);
    i = fin;
  }
  throw new ErrorImagen("PNG cortado");
}

/** Banderas de VP8X que anuncian metadatos: hay que apagarlas si se sacan sus bloques. */
const VP8X_EXIF = 0x08;
const VP8X_XMP = 0x04;

function webp(b: Buffer): Buffer {
  if (b.length < 12 || b.toString("latin1", 0, 4) !== "RIFF" || b.toString("latin1", 8, 12) !== "WEBP") {
    throw new ErrorImagen("no es un WebP");
  }
  const partes: Buffer[] = [];
  let i = 12;
  while (i < b.length) {
    if (i + 8 > b.length) throw new ErrorImagen("WebP cortado");
    const tipo = b.toString("latin1", i, i + 4);
    const largo = b.readUInt32LE(i + 4);
    const fin = i + 8 + largo + (largo % 2);
    if (i + 8 + largo > b.length) throw new ErrorImagen("WebP cortado");
    const bloque = Buffer.from(b.subarray(i, Math.min(fin, b.length)));
    if (tipo === "VP8X" && largo >= 1) bloque[8] &= ~(VP8X_EXIF | VP8X_XMP);
    if (tipo !== "EXIF" && tipo !== "XMP ") partes.push(bloque);
    i = fin;
  }
  const cuerpo = Buffer.concat(partes);
  const cabecera = Buffer.alloc(12);
  cabecera.write("RIFF", 0, "latin1");
  cabecera.writeUInt32LE(cuerpo.length + 4, 4);
  cabecera.write("WEBP", 8, "latin1");
  return Buffer.concat([cabecera, cuerpo]);
}
