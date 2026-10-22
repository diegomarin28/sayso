/**
 * `fetch` con tiempo máximo: sin esto, una red que se cuelga deja la pantalla esperando para siempre
 * (un "Trayendo la guía…" que no termina, un botón de la cuenta que no vuelve). Al vencer, el pedido
 * se corta y falla como cualquier otro error de red.
 */

/** Cuánto esperan los pedidos de la cuenta y de los casos. */
export const TIEMPO_CUENTA_MS = 20_000;
/** La descarga de la copia de los datos puede pesar más. */
export const TIEMPO_DESCARGA_MS = 60_000;

/** El pedido se cortó por tiempo (y no por falta de red). */
export class ErrorDeTiempo extends Error {
  constructor() {
    super("tiempo");
  }
}

/** Como `fetch`, pero si la respuesta no llega en `ms` corta el pedido y tira `ErrorDeTiempo`. */
export async function fetchConTiempo(
  ruta: string,
  init: RequestInit = {},
  ms = TIEMPO_CUENTA_MS,
): Promise<Response> {
  const control = new AbortController();
  let vencio = false;
  const reloj = setTimeout(() => {
    vencio = true;
    control.abort();
  }, ms);
  try {
    return await fetch(ruta, { ...init, signal: control.signal });
  } catch (e) {
    if (vencio) throw new ErrorDeTiempo();
    throw e;
  } finally {
    clearTimeout(reloj);
  }
}
