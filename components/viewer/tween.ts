/**
 * Transiciones con easing (sin three.js, para poder testearlas).
 * Un Tween guarda desde dónde, hacia dónde y cuándo arranca. Cuando el objetivo
 * cambia, `seguir` arranca un tramo nuevo desde el valor actual: nunca salta.
 */

export type Tween = {
  desde: number[];
  hasta: number[];
  inicio: number; // ms
  duracion: number; // ms
};

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function crearTween(valor: number[]): Tween {
  return { desde: [...valor], hasta: [...valor], inicio: 0, duracion: 0 };
}

export function valorTween(tw: Tween, ahora: number): number[] {
  if (tw.duracion <= 0 || ahora >= tw.inicio + tw.duracion) return tw.hasta;
  const k = easeInOutCubic(Math.min(Math.max((ahora - tw.inicio) / tw.duracion, 0), 1));
  return tw.desde.map((d, i) => d + (tw.hasta[i] - d) * k);
}

const iguales = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);

/** Si `objetivo` es nuevo, arranca un tramo desde el valor actual (con `retraso` opcional). Devuelve el valor de ahora. */
export function seguir(tw: Tween, objetivo: number[], ahora: number, duracion: number, retraso = 0): number[] {
  if (!iguales(objetivo, tw.hasta)) {
    tw.desde = [...valorTween(tw, ahora)];
    tw.hasta = [...objetivo];
    tw.inicio = ahora + retraso;
    tw.duracion = duracion;
  }
  return valorTween(tw, ahora);
}
