/**
 * Salud del visor: que el 3D nunca quede en negro (iPhone, equipos viejos, contexto perdido).
 *
 * - Antes de prender efectos se mira qué soporta el WebGL del equipo: el bloom y la luz de
 *   entorno necesitan buffers de color flotante; en celulares, sin multisampling (en iOS el
 *   posprocesado con multisampling se come la memoria del lienzo y se pierde el contexto).
 * - Al arrancar, un vigía mira la imagen (filas y columnas enteras, `lineasVigia`) unos segundos. Si queda negra o plana (solo
 *   el color de fondo: `esPlana`), se apaga
 *   lo que puede fallar (primero los efectos, después la luz de entorno); si igual sigue negro,
 *   el visor muestra un aviso en vez del lienzo vacío.
 * - Si no llega a 30 fps (`bajarRendimiento`): primero se apaga el bloom y, si sigue lento, se dibuja a
 *   densidad 1 (un cuarto de los píxeles en una pantalla densa: es lo que más pesa en una GPU chica).
 */

export type SoporteGL = {
  webgl2: boolean;
  /** EXT_color_buffer_half_float o EXT_color_buffer_float: render targets flotantes (bloom, entorno). */
  colorFlotante: boolean;
  maxMuestras: number;
  /** Pantalla táctil (celular o tablet). */
  tactil: boolean;
};

export type Calidad = { efectos: boolean; multisampling: number; entorno: boolean };

const MULTISAMPLING_MAX = 4;

export function calidadInicial(s: SoporteGL): Calidad {
  return {
    efectos: s.webgl2 && s.colorFlotante,
    multisampling: s.tactil ? 0 : Math.min(MULTISAMPLING_MAX, s.maxMuestras),
    entorno: s.colorFlotante,
  };
}

/** Escalones de rendimiento: lo que ya se apagó porque el equipo no llegaba a 30 fps. */
export type Rendimiento = { sinBloom: boolean; dprBajo: boolean };
export const RENDIMIENTO_PLENO: Rendimiento = { sinBloom: false, dprBajo: false };

/** El escalón siguiente: sin bloom si todavía está prendido; si no, densidad 1. */
export function bajarRendimiento(r: Rendimiento, bloomPrendido: boolean): Rendimiento {
  return bloomPrendido ? { ...r, sinBloom: true } : { ...r, dprBajo: true };
}

/** Densidad de píxeles del lienzo: hasta 2 (pantallas densas); con el escalón bajo, 1. */
export function dprPara(r: Rendimiento): number | [number, number] {
  return r.dprBajo ? 1 : [1, 2];
}

/** Lo siguiente a apagar cuando la imagen queda negra. null = ya no queda nada para apagar. */
export function bajarCalidad(c: Calidad): Calidad | null {
  if (c.efectos) return { ...c, efectos: false };
  if (c.entorno) return { ...c, entorno: false };
  return null;
}

export function soporteDe(gl: WebGLRenderingContext | WebGL2RenderingContext, maxMuestras: number, tactil: boolean): SoporteGL {
  return {
    webgl2: typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext,
    colorFlotante: !!(gl.getExtension("EXT_color_buffer_half_float") || gl.getExtension("EXT_color_buffer_float")),
    maxMuestras,
    tactil,
  };
}

/** Un tramo de la imagen que lee el vigía (coordenadas de `readPixels`: esquina inferior izquierda, ancho y alto). */
export type TramoVigia = { x: number; y: number; ancho: number; alto: number };

/**
 * Dónde mira el vigía: `n` filas y `n` columnas enteras de 1 px, repartidas por la imagen. No puntos
 * sueltos: un televisor o un monitor de frente es casi todo pantalla negra, y una grilla de puntos caía
 * toda en el vidrio oscuro o en el fondo (#238: «No pude mostrar el 3D» en una TV). Una línea que cruza
 * el equipo pasa siempre por algún borde de pieza, el bisel o el pie, que no son del color del fondo.
 */
export function lineasVigia(ancho: number, alto: number, n = 9): TramoVigia[] {
  const tramos: TramoVigia[] = [];
  for (let i = 1; i <= n; i++) {
    tramos.push({ x: 0, y: Math.min(alto - 1, Math.floor((alto * i) / (n + 1))), ancho, alto: 1 });
    tramos.push({ x: Math.min(ancho - 1, Math.floor((ancho * i) / (n + 1))), y: 0, ancho: 1, alto });
  }
  return tramos.filter((t) => t.ancho > 0 && t.alto > 0);
}

/**
 * La imagen está plana (el 3D no se dibujó o se rompió) si TODOS los tramos de `lineasVigia` son del color de
 * `referencia` (una esquina: el fondo, o negro si se rompió todo). `leer` devuelve los RGBA de un tramo.
 */
export function imagenPlana(leer: (t: TramoVigia) => Uint8Array, ancho: number, alto: number, referencia: ArrayLike<number>, n = 9): boolean {
  return lineasVigia(ancho, alto, n).every((t) => esPlana(leer(t), referencia));
}

/**
 * Plana = todos los píxeles (RGBA) con R, G y B a no más del umbral de `referencia` (el color de una
 * esquina del lienzo). Así se ve el 3D roto con cualquier fondo: todo negro (contexto perdido,
 * posprocesado roto) o solo el color de fondo (la escena no se dibujó).
 */
export function esPlana(pixeles: Uint8Array, referencia: ArrayLike<number>, umbral = 8): boolean {
  for (let i = 0; i < pixeles.length; i += 4) {
    for (let c = 0; c < 3; c++) if (Math.abs(pixeles[i + c] - referencia[c]) > umbral) return false;
  }
  return true;
}

/**
 * Cuadros negros seguidos en la ventana de arranque. Mira desde el cuadro `desde` (la cámara ya
 * se acomodó) hasta `hasta`; avisa si hay `seguidos` cuadros negros sin cortar.
 */
export class Vigia {
  private cuadro = 0;
  private negros = 0;
  constructor(private readonly opciones = { desde: 20, hasta: 240, seguidos: 45 }) {}

  /** Una vez por cuadro: true si hay que leer la imagen de este cuadro. */
  siguiente(): boolean {
    this.cuadro++;
    return this.cuadro >= this.opciones.desde && this.cuadro <= this.opciones.hasta;
  }

  /** "negro" cuando se juntaron los cuadros negros seguidos. */
  registrar(negro: boolean): "negro" | "sigue" {
    this.negros = negro ? this.negros + 1 : 0;
    return this.negros >= this.opciones.seguidos ? "negro" : "sigue";
  }

  get terminado(): boolean {
    return this.cuadro > this.opciones.hasta;
  }
}
