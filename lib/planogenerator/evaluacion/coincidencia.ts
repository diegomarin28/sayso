import type { PlanoDePiezas } from "../../../shared";
import { centroNormalizado, puntaje } from "./planta";

/** Piezas que arma el sistema (no las ubica la IA): no cuentan. */
const ESTRUCTURA = new Set(["base", "tapa_inferior"]);

export type Coincidencia = { puntos: number; max: number; porcentaje: number; piezas: { id: string; d: number; puntos: number }[] };

/**
 * Cuánto coinciden dos planos del mismo pack (ej. Haiku contra Sonnet), con la misma escala 0–2
 * por pieza que la evaluación contra el manual. No dice cuál acierta: solo si ubican igual.
 * Una pieza de `ref` que falta en `otro` vale 0.
 */
export function coincidencia(ref: PlanoDePiezas, otro: PlanoDePiezas): Coincidencia {
  const piezas = ref.piezas
    .filter((p) => !ESTRUCTURA.has(p.pieza))
    .map((p) => {
      const a = centroNormalizado(ref, p.pieza);
      const b = centroNormalizado(otro, p.pieza);
      const d = a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : Infinity;
      return { id: p.pieza, d, puntos: Number.isFinite(d) ? puntaje(d) : 0 };
    });
  const puntos = piezas.reduce((s, p) => s + p.puntos, 0);
  const max = piezas.length * 2;
  return { puntos, max, porcentaje: max ? Math.round((100 * puntos) / max) : 0, piezas };
}
