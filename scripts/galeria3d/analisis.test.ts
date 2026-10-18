import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { avisos, leerPng, medir, type Imagen } from "./analisis";

const FONDO = [28, 31, 36];

/** Imagen de fondo con un rectángulo claro en [x0, x1) × [y0, y1) (en píxeles). */
const imagen = (ancho: number, alto: number, r?: [number, number, number, number]): Imagen => {
  const rgba = new Uint8Array(ancho * alto * 4);
  for (let y = 0; y < alto; y++)
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4;
      const dentro = r && x >= r[0] && x < r[1] && y >= r[2] && y < r[3];
      rgba.set(dentro ? [200, 205, 210, 255] : [...FONDO, 255], i);
    }
  return { ancho, alto, rgba };
};

/** PNG RGBA de 8 bits con el filtro dado en todas las filas (para probar el lector). */
const png = ({ ancho, alto, rgba }: Imagen, filtro: number): Buffer => {
  const fila = ancho * 4;
  const crudo = Buffer.alloc(alto * (fila + 1));
  for (let y = 0; y < alto; y++) {
    crudo[y * (fila + 1)] = filtro;
    for (let x = 0; x < fila; x++) {
      const v = rgba[y * fila + x];
      const a = x >= 4 ? rgba[y * fila + x - 4] : 0;
      const b = y > 0 ? rgba[(y - 1) * fila + x] : 0;
      const c = x >= 4 && y > 0 ? rgba[(y - 1) * fila + x - 4] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = filtro === 0 ? 0 : filtro === 1 ? a : filtro === 2 ? b : filtro === 3 ? (a + b) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      crudo[y * (fila + 1) + 1 + x] = (v - pred) & 0xff;
    }
  }
  const trozo = (nombre: string, cuerpo: Buffer) => {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(cuerpo.length);
    return Buffer.concat([largo, Buffer.from(nombre, "ascii"), cuerpo, Buffer.alloc(4)]); // el CRC no se valida
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), trozo("IHDR", ihdr), trozo("IDAT", deflateSync(crudo)), trozo("IEND", Buffer.alloc(0))]);
};

describe("galería 3D: análisis de cada captura", () => {
  it("un equipo bien encuadrado no tiene avisos", () => {
    expect(avisos(medir(imagen(100, 100, [20, 80, 25, 75])))).toEqual([]);
  });

  it("solo fondo: vacío", () => {
    expect(avisos(medir(imagen(100, 100)))).toEqual(["vacio"]);
  });

  it("un equipo chiquito en el medio: chico (la cámara quedó lejos)", () => {
    expect(avisos(medir(imagen(100, 100, [45, 55, 45, 55])))).toEqual(["chico"]);
  });

  it("de borde a borde: cortado", () => {
    expect(avisos(medir(imagen(100, 100, [0, 100, 30, 60])))).toEqual(["cortado"]);
  });

  it("una sombra tenue de borde a borde no cuenta; una pieza negra, sí", () => {
    const im = imagen(100, 100, [20, 80, 25, 75]);
    for (let x = 0; x < 100; x++) im.rgba.set([18, 20, 24, 255], (90 * 100 + x) * 4); // sombra
    expect(avisos(medir(im, 1))).toEqual([]);
    const negra = imagen(100, 100);
    for (let y = 30; y < 70; y++) for (let x = 30; x < 70; x++) negra.rgba.set([2, 2, 3, 255], (y * 100 + x) * 4);
    expect(medir(negra, 1).caja).toEqual({ x0: 0.3, y0: 0.3, x1: 0.7, y1: 0.7 });
  });

  it("la caja y la ocupación salen en fracciones de la imagen", () => {
    const m = medir(imagen(100, 50, [10, 60, 0, 25]), 1);
    expect(m.caja).toEqual({ x0: 0.1, y0: 0, x1: 0.6, y1: 0.5 });
    expect(m.ocupacion).toBeCloseTo((50 * 25) / (100 * 50), 5);
  });

  it.each([0, 1, 2, 3, 4])("lee un PNG RGBA con el filtro %i", (filtro) => {
    const original = imagen(13, 7, [3, 9, 2, 5]);
    original.rgba[5 * 13 * 4 + 7 * 4] = 99; // un píxel distinto para que los filtros tengan qué predecir
    const leida = leerPng(png(original, filtro));
    expect(leida.ancho).toBe(13);
    expect(leida.alto).toBe(7);
    expect([...leida.rgba]).toEqual([...original.rgba]);
  });
});

describe("galería 3D: equipos de los casos de la caché", () => {
  it("toma el plano terminado y el tipo de equipo de cada caso; un caso sin plano no va", async () => {
    const { equiposDeCasos } = await import("./equipos");
    const plano = { modelo: "TV", unidades: "cm" as const, piezas: [] };
    expect(
      equiposDeCasos([
        { caso: { id: "prueba-tv" }, tipoEquipo: "televisor", guia: { plano: { plano } } },
        { caso: { id: "prueba-sin-plano" }, tipoEquipo: "celular", guia: { plano: null } },
      ]),
    ).toEqual([{ id: "prueba-tv", plano, tipoEquipo: "televisor" }]);
  });
});
