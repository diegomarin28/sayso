import { describe, expect, it } from "vitest";
import { ErrorImagen, sinMetadatos } from "./sin-metadatos";

const b = (...partes: (number[] | string)[]) =>
  Buffer.concat(partes.map((p) => (typeof p === "string" ? Buffer.from(p, "latin1") : Buffer.from(p))));

/** Segmento JPEG: marca + largo (incluye los 2 bytes del largo) + datos. */
const segmento = (marca: number, datos: string) => {
  const largo = datos.length + 2;
  return b([0xff, marca, largo >> 8, largo & 0xff], datos);
};

describe("sinMetadatos: JPEG", () => {
  const SOI = b([0xff, 0xd8]);
  const JFIF = segmento(0xe0, "JFIF\0");
  const ICC = segmento(0xe2, "ICC_PROFILE\0");
  const TABLA = segmento(0xdb, "tabla");
  const IMAGEN = b([0xff, 0xda, 0x00, 0x02, 0x12, 0x34, 0xff, 0xe1, 0x56, 0xff, 0xd9]);

  it("saca EXIF (con GPS), XMP, IPTC, comentarios y APPn de fabricante; deja lo que dibuja la imagen", () => {
    const con = Buffer.concat([
      SOI,
      JFIF,
      segmento(0xe1, "Exif\0\0GPS -34.6,-58.4"),
      segmento(0xe1, "http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>"),
      ICC,
      segmento(0xed, "Photoshop 3.0\0IPTC"),
      segmento(0xe4, "fabricante"),
      segmento(0xfe, "comentario"),
      TABLA,
      IMAGEN,
    ]);
    const sin = sinMetadatos(con, "image/jpeg");
    expect(sin).toEqual(Buffer.concat([SOI, JFIF, ICC, TABLA, IMAGEN]));
    expect(sin.toString("latin1")).not.toMatch(/Exif|GPS|xmpmeta|IPTC|comentario|fabricante/);
  });

  it("no toca los datos de la imagen después del barrido, aunque parezcan un bloque", () => {
    const sin = sinMetadatos(Buffer.concat([SOI, TABLA, IMAGEN]), "image/jpeg");
    expect(sin.subarray(-IMAGEN.length)).toEqual(IMAGEN);
  });

  it("rechaza lo que no es JPEG o está cortado", () => {
    for (const malo of [b("hola"), Buffer.concat([SOI, b([0xff, 0xe1, 0x00, 0x40])]), Buffer.concat([SOI, b([0x00])]), SOI]) {
      expect(() => sinMetadatos(malo, "image/jpeg")).toThrow(ErrorImagen);
    }
  });
});

/** Bloque PNG: largo + tipo + datos + CRC (el CRC no se revisa: se copia tal cual). */
const bloquePng = (tipo: string, datos: string) => {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  return b(largo.toJSON().data, tipo, datos, [1, 2, 3, 4]);
};

describe("sinMetadatos: PNG", () => {
  const FIRMA = b([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const IHDR = bloquePng("IHDR", "0123456789abc");
  const IDAT = bloquePng("IDAT", "pixeles");
  const IEND = bloquePng("IEND", "");

  it("saca eXIf, textos y fecha; deja cabecera, píxeles y fin", () => {
    const con = Buffer.concat([
      FIRMA,
      IHDR,
      bloquePng("eXIf", "MM\0*GPS"),
      bloquePng("tEXt", "Author\0Ana"),
      bloquePng("iTXt", "XML:com.adobe.xmp\0"),
      bloquePng("tIME", "1234567"),
      IDAT,
      IEND,
    ]);
    expect(sinMetadatos(con, "image/png")).toEqual(Buffer.concat([FIRMA, IHDR, IDAT, IEND]));
  });

  it("rechaza lo que no es PNG o está cortado", () => {
    expect(() => sinMetadatos(b("hola"), "image/png")).toThrow(ErrorImagen);
    expect(() => sinMetadatos(Buffer.concat([FIRMA, IHDR]), "image/png")).toThrow(ErrorImagen);
  });
});

/** Bloque WebP: tipo + largo (little endian) + datos + relleno a par. */
const bloqueWebp = (tipo: string, datos: number[] | string) => {
  const cuerpo = typeof datos === "string" ? Buffer.from(datos, "latin1") : Buffer.from(datos);
  const largo = Buffer.alloc(4);
  largo.writeUInt32LE(cuerpo.length);
  return Buffer.concat([Buffer.from(tipo, "latin1"), largo, cuerpo, Buffer.alloc(cuerpo.length % 2)]);
};
const riff = (...bloques: Buffer[]) => {
  const cuerpo = Buffer.concat(bloques);
  const tam = Buffer.alloc(4);
  tam.writeUInt32LE(cuerpo.length + 4);
  return Buffer.concat([Buffer.from("RIFF", "latin1"), tam, Buffer.from("WEBP", "latin1"), cuerpo]);
};

describe("sinMetadatos: WebP", () => {
  const VP8 = bloqueWebp("VP8 ", "pixeles");

  it("saca EXIF y XMP, apaga sus banderas en VP8X y corrige el tamaño del RIFF", () => {
    const con = riff(
      bloqueWebp("VP8X", [0x0c | 0x10, 0, 0, 0, 1, 0, 0, 1, 0, 0]),
      VP8,
      bloqueWebp("EXIF", "MM\0*GPS"),
      bloqueWebp("XMP ", "<x:xmpmeta/>"),
    );
    const sin = sinMetadatos(con, "image/webp");
    expect(sin).toEqual(riff(bloqueWebp("VP8X", [0x10, 0, 0, 0, 1, 0, 0, 1, 0, 0]), VP8));
    expect(sin.readUInt32LE(4)).toBe(sin.length - 8);
  });

  it("rechaza lo que no es WebP o está cortado", () => {
    expect(() => sinMetadatos(b("hola"), "image/webp")).toThrow(ErrorImagen);
    const cortado = riff(VP8).subarray(0, 20);
    expect(() => sinMetadatos(cortado, "image/webp")).toThrow(ErrorImagen);
  });
});
