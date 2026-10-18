import { inflateSync } from "node:zlib";

/**
 * Lo que se mide en cada captura del 3D (sin IA, sin dependencias): qué parte de la imagen no es
 * fondo y dónde está. El fondo es el color de la esquina de arriba a la izquierda.
 */
export type Medida = {
  /** Fracción de píxeles que no son fondo (0 a 1). */
  ocupacion: number;
  /** Caja de lo que no es fondo, en fracciones de la imagen (null si no hay nada). */
  caja: { x0: number; y0: number; x1: number; y1: number } | null;
};

export type Imagen = { ancho: number; alto: number; rgba: Uint8Array };

/**
 * Diferencia mínima con el fondo para contar un píxel como "algo": más claro, 12 en algún canal; más
 * oscuro, 20 en todos (la sombra de contacto es ancha y tenue; una pieza negra, como la pantalla de un TV, no).
 */
const UMBRAL = 12;
const UMBRAL_OSCURO = 20;

export function medir({ ancho, alto, rgba }: Imagen, paso = 2): Medida {
  const ref = [rgba[0], rgba[1], rgba[2]];
  let total = 0;
  let llenos = 0;
  let x0 = ancho, y0 = alto, x1 = -1, y1 = -1;
  for (let y = 0; y < alto; y += paso)
    for (let x = 0; x < ancho; x += paso) {
      const i = (y * ancho + x) * 4;
      total++;
      const d = [rgba[i] - ref[0], rgba[i + 1] - ref[1], rgba[i + 2] - ref[2]];
      const masClaro = d.some((v) => v > UMBRAL);
      const masOscuro = d.every((v) => v < -UMBRAL_OSCURO);
      if (!masClaro && !masOscuro) continue;
      llenos++;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  return {
    ocupacion: total ? llenos / total : 0,
    caja: x1 < 0 ? null : { x0: x0 / ancho, y0: y0 / alto, x1: (x1 + 1) / ancho, y1: (y1 + 1) / alto },
  };
}

export type Aviso = "vacio" | "chico" | "cortado";

/**
 * - vacío: casi nada que no sea fondo (el 3D no se dibujó o quedó fuera de cámara).
 * - chico: el equipo ocupa menos de un tercio del ancho y del alto (la cámara quedó lejos).
 * - cortado: lo dibujado toca dos bordes opuestos (no entra en la pantalla).
 */
export function avisos(m: Medida): Aviso[] {
  if (m.ocupacion < 0.005 || !m.caja) return ["vacio"];
  const { x0, y0, x1, y1 } = m.caja;
  const res: Aviso[] = [];
  if (x1 - x0 < 1 / 3 && y1 - y0 < 1 / 3) res.push("chico");
  const borde = 0.01;
  if ((x0 <= borde && x1 >= 1 - borde) || (y0 <= borde && y1 >= 1 - borde)) res.push("cortado");
  return res;
}

/** PNG de 8 bits por canal, sin entrelazado (lo que devuelve Chrome), a RGBA. */
export function leerPng(png: Buffer): Imagen {
  if (png.readUInt32BE(0) !== 0x89504e47) throw new Error("no es un PNG");
  let ancho = 0, alto = 0, tipo = 0;
  const datos: Buffer[] = [];
  for (let o = 8; o < png.length; ) {
    const largo = png.readUInt32BE(o);
    const nombre = png.toString("ascii", o + 4, o + 8);
    const cuerpo = png.subarray(o + 8, o + 8 + largo);
    if (nombre === "IHDR") {
      ancho = cuerpo.readUInt32BE(0);
      alto = cuerpo.readUInt32BE(4);
      if (cuerpo[8] !== 8 || cuerpo[12] !== 0) throw new Error("PNG no soportado (solo 8 bits sin entrelazar)");
      tipo = cuerpo[9];
    } else if (nombre === "IDAT") datos.push(cuerpo);
    else if (nombre === "IEND") break;
    o += 12 + largo;
  }
  const canales = tipo === 6 ? 4 : tipo === 2 ? 3 : 0;
  if (!canales) throw new Error(`PNG de tipo ${tipo} no soportado (solo RGB o RGBA)`);
  const crudo = inflateSync(Buffer.concat(datos));
  const fila = ancho * canales;
  const plano = new Uint8Array(alto * fila);
  for (let y = 0; y < alto; y++) {
    const filtro = crudo[y * (fila + 1)];
    const src = y * (fila + 1) + 1;
    for (let x = 0; x < fila; x++) {
      const a = x >= canales ? plano[y * fila + x - canales] : 0;
      const b = y > 0 ? plano[(y - 1) * fila + x] : 0;
      const c = x >= canales && y > 0 ? plano[(y - 1) * fila + x - canales] : 0;
      const v = crudo[src + x];
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = filtro === 0 ? 0 : filtro === 1 ? a : filtro === 2 ? b : filtro === 3 ? (a + b) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      plano[y * fila + x] = (v + pred) & 0xff;
    }
  }
  if (canales === 4) return { ancho, alto, rgba: plano };
  const rgba = new Uint8Array(ancho * alto * 4);
  for (let i = 0, j = 0; i < plano.length; i += 3, j += 4) {
    rgba[j] = plano[i]; rgba[j + 1] = plano[i + 1]; rgba[j + 2] = plano[i + 2]; rgba[j + 3] = 255;
  }
  return { ancho, alto, rgba };
}
