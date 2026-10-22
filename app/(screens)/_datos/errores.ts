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
export const MENSAJE_TARDA = "Está tardando demasiado. Probá de nuevo.";
export const MENSAJE_CORTADO = "Se cortó la conexión. Probá de nuevo.";
export const MENSAJE_SIN_RED = "No hay conexión. Revisá internet y probá de nuevo.";

/** El mensaje para el estado HTTP de una ruta que falló. */
export function mensajeDeEstado(status: number): string {
  switch (status) {
    case 401:
      return "Tu sesión venció. Volvé al inicio y probá de nuevo.";
    case 408:
    case 504:
      return MENSAJE_TARDA;
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

/**
 * El mensaje de un error de `/api/cuenta/*`. Esas rutas ya devuelven una frase en español; solo se
 * reemplaza lo que no sirve para la persona: el límite de pedidos, la validación cruda y lo que no vino.
 */
export function mensajeDeCuenta(status: number, mensajeDelServidor?: string): string {
  if (status === 429) return mensajeDeEstado(429);
  const texto = mensajeDelServidor?.trim();
  if (!texto) return status === 400 || status === 422 ? "Revisá los datos y probá de nuevo." : mensajeDeEstado(status);
  if (/^entrada inv[aá]lida$/i.test(texto)) return "Revisá los datos y probá de nuevo.";
  return texto;
}

/** Qué se le dice a la persona cuando se rompe una pantalla (o la app): si no hay internet, es eso. */
export function textoDeFalla(enLinea: boolean, sujeto: string): { titulo: string; detalle: string } {
  return enLinea
    ? { titulo: `${sujeto} se trabó.`, detalle: "No se perdió nada de lo que hiciste. Probá de nuevo o volvé al inicio." }
    : { titulo: "Sin conexión.", detalle: "No pude cargar. Cuando vuelva internet, probá de nuevo; no se perdió nada de lo que hiciste." };
}

/** El mensaje de lo que se atrapó en una pantalla: solo los errores pensados para mostrarse; el resto, el genérico. */
export function mensajeDeError(e: unknown): string {
  if (e instanceof ErrorApi || e instanceof ErrorImagen) return e.message;
  console.error("[pantalla]", e);
  return MENSAJE_GENERICO;
}
