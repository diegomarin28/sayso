import type { PiezaPlano, PlanoDePiezas } from "../../shared";
import { ES_TAPA, ES_TAPA_DE_PANTALLA } from "../../lib/planogenerator/cubiertas";

/**
 * De qué lado mira la cámara a un equipo acostado (celular, tablet, notebook, reloj), sin three.js (#233).
 * Los equipos chatos se modelan con la cara de uso (pantalla o teclado) de un lado y la tapa que se saca
 * del otro: el celular y la tablet con la tapa trasera arriba, el reloj con el dorso abajo. Así:
 * - el equipo arranca mirado desde su cara de uso, como se lo ve en la mano (no "dado vuelta");
 * - cuando un paso saca o mueve una tapa (o despega la pantalla de una tablet), la cámara va a ese lado.
 * Todo sale de dónde están las piezas en el plano, por tipo y nunca por marca ni modelo.
 */

export type Lado = "arriba" | "abajo";
/**
 * `adentro`: de qué lado de la carcasa queda lo de adentro (un celular se arma desde atrás: del lado de la tapa).
 * Abierto del otro lado (despegando la pantalla), la carcasa, con su placa al medio, taparía todo.
 */
export type Lados = { inicial: Lado; piezas: Record<string, Lado>; adentro?: Lado; bisagra?: Bisagra };

/**
 * La tapa de pantalla de una notebook (#232): cerrada en el plano, del lado del teclado, girando en su bisagra.
 * Mirado por ese lado se ve abierta (`grados` sobre x, hacia afuera del equipo). Para que la pantalla quede
 * atrás del teclado, ese lado no se mira moviendo la cámara abajo (quedaría detrás de la pantalla): el equipo
 * se da vuelta sobre su eje hondo (z) y la cámara sigue arriba y adelante, como se mira una notebook abierta.
 */
export type Bisagra = { pieza: string; grados: number };
/** Cuánto se abre la tapa de pantalla (como en la biblioteca: 110°). */
export const APERTURA_PANTALLA = 110;
/** La bisagra está en un borde: el pivote, a al menos esta parte de la mitad de lo hondo de la tapa. */
const EN_EL_BORDE = 0.8;

/** La cara que se usa: la pantalla o el teclado (no "cable_pantalla": empieza con eso). */
export const ES_CARA_DE_USO = /^(pantalla|display|teclado|esfera)/;
/** Si el alto es al menos esto de la profundidad, el equipo está parado (igual que `direccionDeCamara`). */
const PARADO_DESDE = 0.7;
/** Una cara de uso cubre al menos esta parte de la planta del equipo (la pantallita de una cámara, no). */
const CARA_MINIMA = 0.3;
/** Una cara de uso está afuera: su cara exterior a menos de esta parte del alto del borde del equipo. */
const AFUERA = 0.15;

const area = (p: PiezaPlano) => p.dim[0] * p.dim[2];

/**
 * Los lados de un equipo acostado; undefined si está parado (TV, heladera: se los mira de frente). Arranca
 * por la cara de uso (la pantalla o el teclado más grande) o, si tiene tapa de pantalla con bisagra, por ese
 * lado, abierta (una notebook, #232); si no tiene ninguna, desde arriba.
 */
export function ladosDelPlano(plano: PlanoDePiezas): Lados | undefined {
  if (!plano.piezas.length) return undefined;
  const min = [0, 1, 2].map((e) => Math.min(...plano.piezas.map((p) => p.pos[e] - p.dim[e] / 2)));
  const max = [0, 1, 2].map((e) => Math.max(...plano.piezas.map((p) => p.pos[e] + p.dim[e] / 2)));
  const [x, y, z] = [0, 1, 2].map((e) => max[e] - min[e]);
  if (y >= PARADO_DESDE * z) return undefined;
  const centro = (min[1] + max[1]) / 2;
  const lado = (p: PiezaPlano): Lado => (p.pos[1] < centro ? "abajo" : "arriba");
  // La cara es una pieza del equipo, nunca el equipo entero (un teclado suelto se mira desde arriba), y se ve
  // de afuera: el teclado de una notebook cerrada queda adentro de la base (se lo ve con la tapa abierta, #232).
  const afuera = (p: PiezaPlano) =>
    lado(p) === "abajo" ? p.pos[1] - p.dim[1] / 2 - min[1] <= AFUERA * y : max[1] - (p.pos[1] + p.dim[1] / 2) <= AFUERA * y;
  const caras = plano.piezas
    .filter((p) => p.padre && ES_CARA_DE_USO.test(p.pieza) && area(p) >= CARA_MINIMA * x * z && afuera(p))
    .sort((a, b) => area(b) - area(a));
  const piezas: Record<string, Lado> = {};
  for (const p of plano.piezas) if (ES_TAPA.test(p.pieza) || caras.includes(p)) piezas[p.pieza] = lado(p);
  const tapa = plano.piezas.find(
    (p) => p.padre && ES_TAPA_DE_PANTALLA.test(p.pieza) && area(p) >= CARA_MINIMA * x * z && afuera(p) && Math.abs(p.pivote[2]) >= (EN_EL_BORDE * p.dim[2]) / 2,
  );
  if (!tapa) return { inicial: caras.length ? lado(caras[0]) : "arriba", piezas, ...ladoDeAdentro(plano, piezas) };
  // Gira hacia afuera del equipo: el centro de la tapa, del otro lado de la bisagra, pasa al lado de la tapa.
  const haciaElCentro = tapa.pivote[2] < 0 ? 1 : -1;
  piezas[tapa.pieza] = lado(tapa);
  const grados = (lado(tapa) === "abajo" ? 1 : -1) * haciaElCentro * APERTURA_PANTALLA;
  const deLaTapa = new Set(plano.piezas.filter((p) => p.padre === tapa.pieza).map((p) => p.pieza));
  return { inicial: lado(tapa), piezas, ...ladoDeAdentro(plano, piezas, deLaTapa), bisagra: { pieza: tapa.pieza, grados } };
}

/** Lo de adentro (ni carcasa, ni cara, ni tapa, ni tornillo): de qué lado del centro de la carcasa queda, en promedio. */
function ladoDeAdentro(plano: PlanoDePiezas, caras: Record<string, Lado>, afuera: ReadonlySet<string> = new Set()): { adentro?: Lado } {
  const carcasa = plano.piezas.filter((p) => !p.padre).sort((a, b) => area(b) - area(a))[0];
  const resto = plano.piezas.filter((p) => p.padre && !(p.pieza in caras) && !afuera.has(p.pieza) && !p.pieza.startsWith("tornillo"));
  if (!carcasa || !resto.length) return {};
  const desvio = resto.reduce((s, p) => s + p.pos[1] - carcasa.pos[1], 0);
  return { adentro: desvio < 0 ? "abajo" : "arriba" };
}
