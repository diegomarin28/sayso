/**
 * Salud del visor: que el 3D nunca quede en negro (iPhone, equipos viejos, contexto perdido).
 *
 * - Antes de prender efectos se mira qué soporta el WebGL del equipo: el bloom y la luz de
 *   entorno necesitan buffers de color flotante; en celulares, sin multisampling (en iOS el
 *   posprocesado con multisampling se come la memoria del lienzo y se pierde el contexto).
 * - Al arrancar, un vigía mira la imagen (una grilla de puntos) unos segundos. Si queda negro, se apaga
 *   lo que puede fallar (primero los efectos, después la luz de entorno); si igual sigue negro,
 *   el visor muestra un aviso en vez del lienzo vacío.
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

/**
 * Dónde mira el vigía: una grilla de `n`×`n` cuadrados de `lado` px repartidos por la imagen (no solo
 * el centro: un televisor de frente tiene en el centro su pantalla apagada, que es negra de verdad).
 * Devuelve la esquina inferior izquierda de cada cuadrado (coordenadas de `readPixels`).
 */
export function puntosVigia(ancho: number, alto: number, lado: number, n = 3): Array<[number, number]> {
  const puntos: Array<[number, number]> = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const cx = (ancho * (i + 1)) / (n + 1);
      const cy = (alto * (j + 1)) / (n + 1);
      puntos.push([
        Math.min(Math.max(0, Math.floor(cx - lado / 2)), Math.max(0, ancho - lado)),
        Math.min(Math.max(0, Math.floor(cy - lado / 2)), Math.max(0, alto - lado)),
      ]);
    }
  return puntos;
}

/** Negro = ningún píxel (RGBA) con R, G o B por encima del umbral. */
export function esNegro(pixeles: Uint8Array, umbral = 8): boolean {
  for (let i = 0; i < pixeles.length; i += 4) {
    if (pixeles[i] > umbral || pixeles[i + 1] > umbral || pixeles[i + 2] > umbral) return false;
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
