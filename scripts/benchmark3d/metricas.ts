import type { PiezaPlano, PlanoDePiezas, Vec3 } from "../../shared";
import { aPlanta, puntaje, type Esquinas } from "../../lib/planogenerator/evaluacion/planta";
import type { EjePlano, FotoReferencia, MedidasReferencia } from "./caso";

/**
 * Métricas del benchmark 3D sobre el PLANO (cajas de cada pieza: centro `pos` y medidas `dim`, en el mundo).
 * Son genéricas: no conocen ningún equipo ni tipo. Las que necesitan la escena three.js están en puntuar.ts.
 */

export type Caja = { min: Vec3; max: Vec3 };

export const cajaDe = (p: Pick<PiezaPlano, "pos" | "dim">): Caja => ({
  min: p.pos.map((v, i) => v - p.dim[i] / 2) as Vec3,
  max: p.pos.map((v, i) => v + p.dim[i] / 2) as Vec3,
});

export const volumen = (c: Caja) => [0, 1, 2].reduce((v, i) => v * Math.max(0, c.max[i] - c.min[i]), 1);

/** Volumen en común de dos piezas (0 si no se tocan). */
export function solape(a: Pick<PiezaPlano, "pos" | "dim">, b: Pick<PiezaPlano, "pos" | "dim">): number {
  const [x, y] = [cajaDe(a), cajaDe(b)];
  return [0, 1, 2].reduce((v, i) => v * Math.max(0, Math.min(x.max[i], y.max[i]) - Math.max(x.min[i], y.min[i])), 1);
}

/** ¿La pieza está en la lista (por id o por prefijo)? */
export const enLista = (id: string, lista: readonly string[]) => lista.some((e) => id === e || id.startsWith(e));

/** La caja que encierra a todas las piezas. */
export function cajaDelPlano(piezas: ReadonlyArray<Pick<PiezaPlano, "pos" | "dim">>): Caja {
  const cajas = piezas.map(cajaDe);
  return {
    min: [0, 1, 2].map((i) => Math.min(...cajas.map((c) => c.min[i]))) as Vec3,
    max: [0, 1, 2].map((i) => Math.max(...cajas.map((c) => c.max[i]))) as Vec3,
  };
}

const medidasDe = (c: Caja) => c.max.map((v, i) => v - c.min[i]) as Vec3;

/** Ancestros de cada pieza (por `padre`), sin colgarse con un ciclo. */
function ancestros(plano: PlanoDePiezas): Map<string, Set<string>> {
  const padre = new Map(plano.piezas.map((p) => [p.pieza, p.padre]));
  return new Map(plano.piezas.map((p) => {
    const res = new Set<string>();
    for (let a = p.padre; a && !res.has(a) && a !== p.pieza; a = padre.get(a)) res.add(a);
    return [p.pieza, res];
  }));
}

/** Un choque es un encastre parcial: más de esta parte de la pieza chica adentro de la otra… */
export const CHOQUE_DESDE = 0.1;
/** …pero no toda: una pieza entera adentro de otra es una carcasa con su contenido (las cajas no dicen qué es hueco). */
export const CONTENIDA_DESDE = 0.9;

/**
 * Piezas que se atraviesan a medias. No cuenta una pieza con sus ancestros (una carcasa contiene a sus piezas),
 * una pieza entera adentro de otra (ver `CONTENIDA_DESDE`) ni las piezas `fuera` del cuerpo (ver `CasoBenchmark`).
 */
export function choques(plano: PlanoDePiezas, fuera: readonly string[] = []): Array<[string, string, number]> {
  const arriba = ancestros(plano);
  const res: Array<[string, string, number]> = [];
  const ps = plano.piezas.filter((p) => !enLista(p.pieza, fuera));
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++) {
      const [a, b] = [ps[i], ps[j]];
      if (arriba.get(a.pieza)?.has(b.pieza) || arriba.get(b.pieza)?.has(a.pieza)) continue;
      const chica = Math.min(volumen(cajaDe(a)), volumen(cajaDe(b)));
      if (chica <= 0) continue;
      const parte = solape(a, b) / chica;
      if (parte > CHOQUE_DESDE && parte < CONTENIDA_DESDE) res.push([a.pieza, b.pieza, Math.round(parte * 100) / 100]);
    }
  return res;
}

/** Tolerancia para "se tocan": esta parte de la diagonal del equipo. */
export const TOQUE = 0.02;

/** Piezas que no tocan a ninguna otra: quedaron flotando lejos del equipo. */
export function flotantes(plano: PlanoDePiezas): string[] {
  if (plano.piezas.length < 2) return [];
  const total = medidasDe(cajaDelPlano(plano.piezas));
  const tol = TOQUE * Math.hypot(...total);
  const cajas = plano.piezas.map((p) => [p.pieza, cajaDe(p)] as const);
  const tocan = (a: Caja, b: Caja) => [0, 1, 2].every((i) => a.min[i] <= b.max[i] + tol && b.min[i] <= a.max[i] + tol);
  return cajas.filter(([id, c]) => !cajas.some(([otro, d]) => otro !== id && tocan(c, d))).map(([id]) => id);
}


export type Proporciones = {
  /** Medidas del plano cerrado (sin las piezas `fuera`), cm. */
  plano: Vec3;
  referencia: Vec3;
  /** Tamaño del plano / tamaño real (raíz cúbica del volumen): 1 = misma escala. */
  escala: number;
  /** Error de forma por eje, ya sin la escala: |ln(plano / real)|. */
  errores: Vec3;
};

export function proporciones(plano: PlanoDePiezas, ref: MedidasReferencia, fuera: readonly string[] = []): Proporciones | null {
  const piezas = plano.piezas.filter((p) => !enLista(p.pieza, fuera));
  if (!piezas.length) return null;
  const m = medidasDe(cajaDelPlano(piezas));
  const r: Vec3 = [ref.x, ref.y, ref.z];
  const escala = Math.cbrt((m[0] * m[1] * m[2]) / (r[0] * r[1] * r[2]));
  return { plano: m, referencia: r, escala, errores: m.map((v, i) => Math.abs(Math.log(v / escala / r[i]))) as Vec3 };
}

/** Un error de razón 2 (el doble o la mitad) ya vale 0. */
const DE_RAZON = (e: number) => Math.max(0, 1 - e / Math.LN2);
export const puntosForma = (p: Proporciones) => p.errores.reduce((s, e) => s + DE_RAZON(e), 0) / 3;
export const puntosEscala = (p: Proporciones) => DE_RAZON(Math.abs(Math.log(p.escala)));

const EJE: Record<EjePlano, [0 | 1 | 2, 1 | -1]> = {
  "+x": [0, 1], "-x": [0, -1], "+y": [1, 1], "-y": [1, -1], "+z": [2, 1], "-z": [2, -1],
};

/** Marco de una foto que es el equipo entero (sin las piezas `fuera`), para equipos sin una carcasa que lo encierre. */
export const MARCO_TODO = "todo";

/** Centro de una pieza en la vista de la foto, normalizado a la caja del marco: de -1 a 1 (derecha, abajo). */
export function enVista(
  plano: PlanoDePiezas,
  id: string,
  foto: Pick<FotoReferencia, "derecha" | "abajo" | "marco">,
  fuera: readonly string[] = [],
): [number, number] | null {
  const p = plano.piezas.find((q) => q.pieza === id);
  const marco =
    foto.marco === MARCO_TODO
      ? cajaDelPlano(plano.piezas.filter((q) => !enLista(q.pieza, fuera)))
      : plano.piezas.filter((q) => q.pieza === foto.marco).map(cajaDe)[0];
  if (!marco || !p) return null;
  return [foto.derecha, foto.abajo].map((e) => {
    const [i, signo] = EJE[e];
    const [centro, mitad] = [(marco.min[i] + marco.max[i]) / 2, (marco.max[i] - marco.min[i]) / 2];
    return (signo * (p.pos[i] - centro)) / mitad;
  }) as [number, number];
}

/** El punto de la foto (píxeles) en el contorno del marco, de -1 a 1 (derecha, abajo). */
export function enFoto(px: [number, number], foto: Pick<FotoReferencia, "esquinas">): [number, number] {
  const { ai, ad, bd, bi } = foto.esquinas;
  // planta.ts: z = -1 atrás (arriba en la foto), z = 1 frente (abajo).
  const e: Esquinas = { BL: ai, BR: ad, FR: bd, FL: bi };
  return aPlanta(px, e);
}

export type PiezaEnFoto = { foto: string; pieza: string; d: number | null; puntos: number };

/** Puntaje 0–2 por pieza anotada (escala de docs/3d-estrategia.md): una pieza que el plano no tiene vale 0. */
export function posiciones(plano: PlanoDePiezas, fotos: readonly FotoReferencia[], fuera: readonly string[] = []): PiezaEnFoto[] {
  return fotos.flatMap((f) =>
    Object.entries(f.piezas).map(([id, px]) => {
      const a = enVista(plano, id, f, fuera);
      const b = enFoto(px, f);
      const d = a ? Math.hypot(a[0] - b[0], a[1] - b[1]) : null;
      return { foto: f.archivo, pieza: id, d: d === null ? null : Math.round(d * 100) / 100, puntos: d === null ? 0 : puntaje(d) };
    }),
  );
}

/** El mismo plano reflejado en x (izquierda ↔ derecha): para ver si la posición mejora con el equipo espejado. */
export const espejadoEnX = (plano: PlanoDePiezas): PlanoDePiezas => ({
  ...plano,
  piezas: plano.piezas.map((p) => ({ ...p, pos: [-p.pos[0], p.pos[1], p.pos[2]] as Vec3, pivote: [-p.pivote[0], p.pivote[1], p.pivote[2]] as Vec3 })),
});

export type Certeza = {
  /** Piezas por origen (sin dato = no verificada). */
  origen: Record<"manual" | "foto" | "estimada" | "plantilla" | "sinDato", number>;
  /**
   * Lo que el plano dice haber visto sin respaldo: "manual" sin página o "foto" sin URL. Sin origen no es
   * incoherente: el visor lo muestra "sin verificar" (igual que unas medidas sin origen: estimadas).
   */
  incoherencias: string[];
};

export function certeza(plano: PlanoDePiezas): Certeza {
  const origen = { manual: 0, foto: 0, estimada: 0, plantilla: 0, sinDato: 0 };
  const incoherencias: string[] = [];
  for (const p of plano.piezas) {
    origen[p.origen ?? "sinDato"]++;
    if (p.origen === "manual" && !p.cita?.pagina) incoherencias.push(`${p.pieza}: "manual" sin página`);
    else if (p.origen === "foto" && !p.cita?.url) incoherencias.push(`${p.pieza}: "foto" sin URL`);
  }
  return { origen, incoherencias };
}
