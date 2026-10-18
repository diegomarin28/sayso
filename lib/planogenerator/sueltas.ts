import indice from "../../public/models/piezas/indice.json";
import type { PiezaPlano, PlanoDePiezas, Vec3 } from "../../shared";
import { IndicePiezas, palabras, tipoDe, tipoPara } from "./biblioteca";

const INDICE = IndicePiezas.parse(indice);
const NOMBRES = Object.keys(INDICE.tipos);

/** Tapas y carcasas envuelven al resto: una pieza suelta puede ir adentro. */
const ENVOLTURA = /^(tapa|carcasa|puerta|marco)/;
/** Lugares que se prueban por eje dentro del equipo. */
const PASOS = 9;
/** Lo más grande que puede ser una suelta, como fracción del equipo: en el espesor y en los otros dos ejes. */
const FRACCION_ESPESOR = 0.8;
const FRACCION_LADO = 0.35;
/** Sin forma en la biblioteca: una caja de este tanto del equipo, y no más que esto (lo que la guía nombra suelto suele ser chico: un sensor, un botón, un flex). */
const SIN_FORMA = 0.15;
const SIN_FORMA_MAX_CM = 3;

type Caja = { min: Vec3; max: Vec3 };
const caja = (p: Pick<PiezaPlano, "pos" | "dim">): Caja => ({
  min: p.pos.map((v, i) => v - p.dim[i] / 2) as Vec3,
  max: p.pos.map((v, i) => v + p.dim[i] / 2) as Vec3,
});
const solape = (a: Caja, b: Caja) => [0, 1, 2].reduce((v, i) => v * Math.max(0, Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i])), 1);

/** Medidas reales de la forma de la biblioteca para ese id: la variante del equipo si la hay ("bateria@celular"). */
function medidaTipica(id: string, equipo: string[]): number[] | undefined {
  const tipo = tipoPara(id, NOMBRES);
  if (!tipo) return undefined;
  // La común primero: entre las que son del equipo, y si ninguna lo es.
  const variantes = NOMBRES.filter((n) => tipoDe(n) === tipo && INDICE.tipos[n].caja).sort((a, b) => +(a !== tipo) - +(b !== tipo));
  const delEquipo = variantes.find((n) => palabras(INDICE.tipos[n].equipos).some((e) => equipo.includes(e)));
  const elegida = delEquipo ?? variantes[0];
  return elegida ? INDICE.tipos[elegida].caja : undefined;
}

/**
 * Las piezas que la guía puede nombrar y que no tienen lugar en el plano (ni la IA ni la plantilla
 * las ubicaron) igual van al 3D: si no, la guía resaltaría algo que no está. Cada una con las medidas
 * de su forma en la biblioteca (achicadas para que entren en el equipo; el visor la gira para no
 * deformarla) y en el hueco más libre dentro del equipo, colgando de la raíz. Origen "plantilla":
 * ni el lugar ni las medidas vienen del manual. Sirve para cualquier plano, acostado o parado.
 */
export function sumarSueltas(plano: PlanoDePiezas, ids: string[], equipo: string[] = []): { plano: PlanoDePiezas; avisos: string[] } {
  const raiz = plano.piezas.find((p) => !p.padre);
  const faltan = [...new Set(ids)].filter((id) => !plano.piezas.some((p) => p.pieza === id));
  if (!raiz || !faltan.length) return { plano, avisos: [] };

  // El equipo: todo lo que ocupa el plano.
  const cajas = plano.piezas.map(caja);
  const equipoCaja: Caja = {
    min: [0, 1, 2].map((i) => Math.min(...cajas.map((c) => c.min[i]))) as Vec3,
    max: [0, 1, 2].map((i) => Math.max(...cajas.map((c) => c.max[i]))) as Vec3,
  };
  const tam = equipoCaja.max.map((v, i) => v - equipoCaja.min[i]);
  const ejes = [0, 1, 2].sort((a, b) => tam[a] - tam[b]); // del más fino al más largo
  const ocupado = plano.piezas.filter((p) => p !== raiz && !ENVOLTURA.test(p.pieza)).map(caja);
  const centro = equipoCaja.min.map((v, i) => v + tam[i] / 2);

  const nuevas: PiezaPlano[] = [];
  for (const id of faltan) {
    // Medidas: las de la forma, lo más fino al espesor del equipo, y achicadas parejo para que entren.
    const lado = Math.min(tam[ejes[1]] * SIN_FORMA, SIN_FORMA_MAX_CM);
    const tipica = medidaTipica(id, equipo)?.slice().sort((a, b) => a - b) ?? [Math.min(tam[ejes[0]] * 0.4, lado), lado, lado];
    const tope = ejes.map((e, k) => tam[e] * (k === 0 ? FRACCION_ESPESOR : FRACCION_LADO));
    const f = Math.min(1, ...tipica.map((v, k) => tope[k] / Math.max(v, 1e-6)));
    const dim = [0, 0, 0] as Vec3;
    ejes.forEach((e, k) => (dim[e] = +(tipica[k] * f).toFixed(2)));

    // Lugar: el que menos se encima con lo que ya hay; si empatan, el más cerca del centro.
    const opciones = [0, 1, 2].map((i) => {
      const libre = tam[i] - dim[i];
      if (libre <= 0) return [centro[i]];
      return Array.from({ length: PASOS }, (_, k) => equipoCaja.min[i] + dim[i] / 2 + (libre * k) / (PASOS - 1));
    });
    let mejor: { pos: Vec3; costo: number; lejos: number } | undefined;
    for (const x of opciones[0])
      for (const y of opciones[1])
        for (const z of opciones[2]) {
          const pos: Vec3 = [x, y, z];
          const c = caja({ pos, dim });
          const costo = ocupado.reduce((s, o) => s + solape(c, o), 0);
          const lejos = Math.hypot(...pos.map((v, i) => v - centro[i]));
          if (!mejor || costo < mejor.costo - 1e-9 || (Math.abs(costo - mejor.costo) <= 1e-9 && lejos < mejor.lejos)) mejor = { pos, costo, lejos };
        }
    const pos = mejor!.pos.map((v) => +v.toFixed(2)) as Vec3;
    ocupado.push(caja({ pos, dim }));
    nuevas.push({ pieza: id, forma: "caja", dim, pos, pivote: [0, 0, 0], padre: raiz.pieza, origen: "plantilla" });
  }

  return {
    plano: { ...plano, piezas: [...plano.piezas, ...nuevas] },
    avisos: faltan.map((id) => `"${id}" no tenía lugar en el plano: se agregó con su tamaño típico en un hueco libre (ubicación genérica).`),
  };
}
