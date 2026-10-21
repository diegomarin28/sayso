import type { PlanoDePiezas, Vec3 } from "../../../shared";

/**
 * El plano reflejado en x (izquierda ↔ derecha). Para las plantillas que se escribieron con el equipo visto de un lado
 * y se muestran vistas del otro: sin esto, "derecha" e "izquierda" quedan intercambiadas (#339). Solo cambia x de
 * `pos` y `pivote`; las medidas y el resto siguen igual.
 */
const neg = (v: number) => (v ? -v : 0); // sin -0

export const espejadoEnX = (plano: PlanoDePiezas): PlanoDePiezas => ({
  ...plano,
  piezas: plano.piezas.map((p) => ({
    ...p,
    pos: [neg(p.pos[0]), p.pos[1], p.pos[2]] as Vec3,
    pivote: [neg(p.pivote[0]), p.pivote[1], p.pivote[2]] as Vec3,
  })),
});
