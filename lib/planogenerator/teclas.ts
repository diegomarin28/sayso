import type { PiezaPlano, PlanoDePiezas, Vec3 } from "../../shared";

/**
 * Filas de un teclado QWERTY genérico de notebook, de la más lejana a la más cercana a quien escribe, con el
 * centro de cada tecla en anchos de tecla desde el borde izquierdo (la fila mide 15). Sin marca ni modelo, y
 * sin distribución regional: solo letras, números y las teclas que tiene cualquier teclado.
 */
const ANCHO_FILA = 15;
const FILAS: Array<Record<string, number>> = [
  { esc: 0.5, ...fila("f1 f2 f3 f4 f5 f6 f7 f8 f9 f10 f11 f12", 1.5) },
  fila("1 2 3 4 5 6 7 8 9 0", 1.5, { borrar: 14.25 }),
  fila("q w e r t y u i o p", 2, { tab: 0.75 }),
  fila("a s d f g h j k l", 2.25, { bloq_mayus: 0.875, enter: 14.1 }),
  fila("z x c v b n m", 2.75, { shift: 1.125 }),
  { ctrl: 0.6, alt: 3.2, espacio: 7.5, flechas: 13.5 },
];
const SINONIMOS: Record<string, string> = {
  escape: "esc",
  barra_espaciadora: "espacio",
  espaciadora: "espacio",
  space: "espacio",
  intro: "enter",
  return: "enter",
  retroceso: "borrar",
  backspace: "borrar",
  mayus: "shift",
  mayusculas: "shift",
  caps: "bloq_mayus",
  caps_lock: "bloq_mayus",
  tabulador: "tab",
  control: "ctrl",
};

function fila(teclas: string, desde: number, extra: Record<string, number> = {}): Record<string, number> {
  return { ...Object.fromEntries(teclas.split(" ").map((t, k) => [t, desde + k])), ...extra };
}

/** Lo que mide una tecla de largo, en anchos de tecla (las demás miden 1). */
const LARGAS: Record<string, number> = { espacio: 6, borrar: 1.5, tab: 1.5, bloq_mayus: 1.75, enter: 1.8, shift: 2.25 };

/** Una tecla nombrada: el capuchón ("tecla_p") o lo que va debajo ("mecanismo_tijera_p", "switch_teclado_p"). */
const TECLA = /^(tecla|capuchon|keycap|mecanismo_tijera|tijera|switch_teclado|switch)_(?:de_(?:la_)?)?([a-z0-9_]+)$/;

type Ubicada = { fila: number; columna: number; largo: number; debajo: boolean };

/** Dónde está la tecla que nombra el id en el QWERTY genérico, o nada si no nombra una tecla conocida. */
export function teclaDe(id: string): Ubicada | undefined {
  const m = TECLA.exec(id);
  if (!m) return undefined;
  const nombre = SINONIMOS[m[2]] ?? m[2];
  const f = FILAS.findIndex((x) => nombre in x);
  if (f < 0) return undefined;
  return { fila: f, columna: FILAS[f][nombre], largo: LARGAS[nombre] ?? 1, debajo: !/^(tecla|capuchon|keycap)$/.test(m[1]) };
}

const esTeclado = (p: PiezaPlano) => /^teclado(?!_calculadora)/.test(p.pieza);

/**
 * Si el plano trae teclado (el de una notebook o un teclado externo), cada tecla que nombra la guía va en su
 * lugar de un QWERTY genérico dentro de ese teclado, sin importar dónde la estimó la IA: la IA no sabe hacia
 * dónde mira el teclado de la plantilla (en la notebook dada vuelta, hacia abajo). Por TIPO, nunca por modelo.
 * - La cara del teclado es la que da afuera del equipo, en su eje más fino: lejos de las demás piezas.
 *   Si el teclado es el equipo entero (un teclado externo), la de arriba.
 * - Quien escribe está del lado del trackpad o de la barra espaciadora si el plano los trae; si no, en +z.
 * - Mirando la cara, la derecha de quien escribe: si la cara mira hacia abajo, el equipo está dado vuelta y
 *   la izquierda y la derecha se invierten.
 * El capuchón sobresale de la cara; el mecanismo, justo debajo. Las que faltan en el plano se suman.
 * Origen "plantilla": el lugar no viene del manual.
 */
export function ubicarTeclas(plano: PlanoDePiezas, ids: string[]): { plano: PlanoDePiezas; avisos: string[] } {
  const raiz = plano.piezas.find((p) => !p.padre);
  const teclado = plano.piezas.find((p) => p.padre && esTeclado(p)) ?? (raiz && esTeclado(raiz) ? raiz : undefined);
  const teclas = [...new Set([...plano.piezas.map((p) => p.pieza), ...ids])].filter((id) => id !== teclado?.pieza && teclaDe(id));
  if (!raiz || !teclado || !teclas.length) return { plano, avisos: [] };

  // El eje más fino del teclado es su espesor; los otros dos, a lo ancho y a lo hondo (el más largo es el ancho).
  const ejes = [0, 1, 2].sort((a, b) => teclado.dim[a] - teclado.dim[b]);
  const [esp, hondo, ancho] = ejes;
  const cara = teclado === raiz ? 1 : ladoDeLaCara(plano, teclado, esp);
  const frente = ladoDeQuienEscribe(plano, teclado, hondo);
  // Mirando la cara con quien escribe abajo: con la cara en +y y quien escribe en +z, la derecha es +x.
  const derecha = cara * frente * signoDeTerna(esp, hondo, ancho);

  const u = teclado.dim[ancho] / ANCHO_FILA;
  const alto = teclado.dim[hondo] / FILAS.length;
  const lugar = (id: string): Pick<PiezaPlano, "pos" | "dim"> => {
    const t = teclaDe(id)!;
    const grueso = Math.max(teclado.dim[esp] * (t.debajo ? 0.3 : 0.5), 0.05);
    const pos = [...teclado.pos] as Vec3;
    pos[ancho] = teclado.pos[ancho] + derecha * (t.columna - ANCHO_FILA / 2) * u;
    // La fila 0 es la más lejana a quien escribe.
    pos[hondo] = teclado.pos[hondo] + frente * (t.fila + 0.5 - FILAS.length / 2) * alto;
    const borde = teclado.pos[esp] + (cara * teclado.dim[esp]) / 2;
    pos[esp] = borde + (cara * grueso) / 2 - (t.debajo ? cara * grueso : 0);
    const dim = [0, 0, 0] as Vec3;
    dim[ancho] = t.largo * u * 0.85;
    dim[hondo] = alto * 0.85;
    dim[esp] = grueso;
    return { pos: pos.map((v) => +v.toFixed(2)) as Vec3, dim: dim.map((v) => +v.toFixed(3)) as Vec3 };
  };

  const esta = new Set(plano.piezas.map((p) => p.pieza));
  const piezas = plano.piezas.map((p) => (teclas.includes(p.pieza) ? { ...p, ...lugar(p.pieza), padre: teclado.pieza, origen: "plantilla" as const } : p));
  const nuevas = teclas
    .filter((id) => !esta.has(id))
    .map((id): PiezaPlano => ({ pieza: id, forma: "caja", ...lugar(id), pivote: [0, 0, 0], padre: teclado.pieza, origen: "plantilla" }));
  return {
    plano: { ...plano, piezas: [...piezas, ...nuevas] },
    avisos: [`${teclas.length} tecla(s) ubicadas en su lugar de un teclado QWERTY genérico dentro de "${teclado.pieza}": ${teclas.join(", ")}.`],
  };
}

/**
 * +1 o −1: hacia dónde mira la cara del teclado en el eje de su espesor: lejos de lo que hay adentro del equipo
 * (el promedio de las demás piezas; la tapa todavía no está, la suma `conTapa` después).
 */
function ladoDeLaCara(plano: PlanoDePiezas, teclado: PiezaPlano, eje: number): 1 | -1 {
  const adentro = plano.piezas.filter((p) => p.padre && p !== teclado && !teclaDe(p.pieza) && !/^(trackpad|touchpad)/.test(p.pieza));
  if (!adentro.length) return 1;
  const medio = adentro.reduce((s, p) => s + p.pos[eje], 0) / adentro.length;
  return medio > teclado.pos[eje] ? -1 : 1;
}

/** +1 o −1: de qué lado del teclado está quien escribe, en su eje hondo. */
function ladoDeQuienEscribe(plano: PlanoDePiezas, teclado: PiezaPlano, eje: number): 1 | -1 {
  const guia = plano.piezas.find((p) => /^(trackpad|touchpad|tecla_espacio)/.test(p.pieza) && p.pos[eje] !== teclado.pos[eje]);
  return guia && guia.pos[eje] < teclado.pos[eje] ? -1 : 1;
}

/** +1 si (espesor, hondo, ancho) es una terna derecha como (y, z, x); −1 si no. */
function signoDeTerna(a: number, b: number, c: number): 1 | -1 {
  return (b - a + 3) % 3 === 1 && (c - b + 3) % 3 === 1 ? 1 : -1;
}
