/**
 * Lógica pura del foco dentro de un diálogo (sin DOM, para probarla en Node).
 * `useDialogo` la usa; ver `lib/a11y/useDialogo.ts`.
 */

/** Lo que se puede alcanzar con Tab. */
export const FOCALIZABLES =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Adónde forzar el foco al apretar Tab (o Shift+Tab) dentro de un diálogo con `total` elementos
 * focalizables, estando en `actual` (-1: el foco está fuera de la lista).
 * - `null`: el navegador ya hace lo correcto (se pasa al vecino sin salir del diálogo).
 * - `-1`: no hay nada focalizable; el foco queda en el diálogo mismo.
 * - otro número: el índice al que hay que ir (da la vuelta en los bordes o vuelve de afuera).
 */
export function destinoTab(total: number, actual: number, atras: boolean): number | null {
  if (total === 0) return -1;
  if (actual < 0 || actual >= total) return atras ? total - 1 : 0;
  if (atras && actual === 0) return total - 1;
  if (!atras && actual === total - 1) return 0;
  return null;
}

/** Solo el diálogo de más arriba reacciona a Escape y a Tab (si hay uno encima del otro). */
export function esElDeArriba<T>(pila: readonly T[], id: T): boolean {
  return pila.length > 0 && pila[pila.length - 1] === id;
}
