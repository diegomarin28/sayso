import type { PlanoDePiezas, Vec3 } from "../../shared";

/**
 * Equipos parados (TV, heladera, aire, lavarropas, microondas): el plano se arma igual que el de una
 * notebook, con la "planta" acostada (x, z) y las capas hacia arriba (+y). Para mostrarlo parado se
 * gira 90° sobre el eje x: la planta queda de frente (z de la planta → alto; -1 = arriba) y las capas
 * quedan hacia la cámara (+z), que es lo que se ve en la vista del interior del manual.
 */
const n = (v: number) => v || 0; // sin -0
const girar = ([x, y, z]: Vec3): Vec3 => [n(x), n(-z), n(y)];

export function pararPlano(plano: PlanoDePiezas): PlanoDePiezas {
  const piezas = plano.piezas.map((p) => ({ ...p, pos: girar(p.pos), pivote: girar(p.pivote), dim: [p.dim[0], p.dim[2], p.dim[1]] as Vec3 }));
  // Apoyado en el piso (y = 0), como los demás planos.
  const piso = Math.min(...piezas.map((p) => p.pos[1] - p.dim[1] / 2));
  return { ...plano, piezas: piezas.map((p) => ({ ...p, pos: [p.pos[0], n(p.pos[1] - piso), p.pos[2]] as Vec3 })) };
}
