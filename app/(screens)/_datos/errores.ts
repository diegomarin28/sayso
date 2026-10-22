import { ErrorImagen } from "./imagen";

/**
 * Qué se le dice a la persona cuando algo falla: una frase de lo que pasó, nunca un mensaje técnico.
 * Las pantallas ofrecen la acción (reintentar o volver); acá solo está el texto.
 */

/** Error que se le puede mostrar a la persona tal cual. */
export class ErrorApi extends Error {}

/** El pedido se cortó: tardó más que el tiempo máximo o se canceló al volver la red. */
export class ErrorCortado extends ErrorApi {}

export const MENSAJE_GENERICO = "Algo salió mal. Probá de nuevo.";

/** El mensaje para el estado HTTP de una ruta que falló. */
export function mensajeDeEstado(status: number): string {
  switch (status) {
    case 401:
      return "Tu sesión venció. Volvé al inicio y probá de nuevo.";
    case 408:
    case 504:
      return "Está tardando demasiado. Probá de nuevo.";
    case 413:
      return "La foto pesa demasiado. Sacala de nuevo o elegí otra.";
    case 429:
      return "Hiciste muchos pedidos seguidos. Esperá un momento y probá de nuevo.";
    case 502:
      return "Me trabé pensando. Probá de nuevo.";
    default:
      return MENSAJE_GENERICO;
  }
}

/** El mensaje de lo que se atrapó en una pantalla: solo los errores pensados para mostrarse; el resto, el genérico. */
export function mensajeDeError(e: unknown): string {
  if (e instanceof ErrorApi || e instanceof ErrorImagen) return e.message;
  console.error("[pantalla]", e);
  return MENSAJE_GENERICO;
}
