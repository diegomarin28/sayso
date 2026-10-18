import { z } from "zod";
import { Evento } from "../../shared";
import { mensajePausa } from "../../lib/ia/pausa";
import { ResultadoCompras, type OpcionCompra, type PedidoCompra } from "../../lib/compras/esquemas";

/**
 * De dónde salen las opciones de <OpcionesCompra>: `/api/compras` (o una simulada en /lab y tests).
 * Todo lo que llega se valida con Zod y cada falla se traduce a un mensaje para la persona: la
 * pantalla nunca muestra un error técnico ni se rompe.
 */

export const RespuestaCompras = ResultadoCompras.extend({ eventos: z.array(Evento).default([]) });
export type RespuestaCompras = z.infer<typeof RespuestaCompras>;
export type FuenteCompras = (pedido: PedidoCompra, senal: AbortSignal) => Promise<RespuestaCompras>;

/** La ruta tarda 20–60 s (y corta a los 120 s): más que esto es que algo se colgó. */
export const TIEMPO_MAXIMO_MS = 150_000;

/** Error con un mensaje que se le puede mostrar a la persona tal cual. */
export class ErrorCompras extends Error {}

/** Uno por causa: qué pasó, dicho para la persona (la alternativa la ofrece la pantalla). */
export const MENSAJES = {
  sinConexion: "No hay conexión a internet, así que no pude buscar. Revisá la conexión.",
  tardo: "La búsqueda tardó más de lo que permite el servidor y se cortó antes de terminar.",
  faltanDatos: "Faltan datos del repuesto (el modelo del equipo) para buscarlo.",
  ia: "El buscador (la IA que lee las publicaciones) no respondió esta vez.",
  interno: "Hubo un error de nuestro lado al buscar el repuesto.",
  general: "No pude buscar el repuesto por un error inesperado.",
} as const;

/** El mensaje según la respuesta HTTP de /api/compras (el tope de gasto, 503, lo resuelve `mensajePausa`). */
export function mensajePorEstado(status: number): string {
  if (status === 400) return MENSAJES.faltanDatos;
  if (status === 504 || status === 408) return MENSAJES.tardo; // Vercel cortó la función (maxDuration)
  if (status === 502) return MENSAJES.ia;
  return MENSAJES.interno;
}

/** Corta a los `ms` o cuando corta `senal` (la pantalla se cerró o se buscó de nuevo). */
function conPlazo(senal: AbortSignal, ms: number): { senal: AbortSignal; vencio: () => boolean; listo: () => void } {
  const c = new AbortController();
  let vencido = false;
  const t = setTimeout(() => ((vencido = true), c.abort()), ms);
  const cortar = () => c.abort();
  senal.addEventListener("abort", cortar, { once: true });
  return {
    senal: c.signal,
    vencio: () => vencido,
    listo: () => (clearTimeout(t), senal.removeEventListener("abort", cortar)),
  };
}

export function crearFuenteApi(fetcher: typeof fetch = (...a) => fetch(...a), plazoMs = TIEMPO_MAXIMO_MS): FuenteCompras {
  return async (pedido, senal) => {
    const plazo = conPlazo(senal, plazoMs);
    try {
      let res: Response;
      try {
        res = await fetcher("/api/compras", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(pedido),
          signal: plazo.senal,
        });
      } catch (e) {
        if (plazo.vencio()) throw new ErrorCompras(MENSAJES.tardo);
        if (senal.aborted) throw e; // la cortó la pantalla: no es un error para mostrar
        throw new ErrorCompras(MENSAJES.sinConexion);
      }
      const datos: unknown = await res.json().catch(() => null);
      const pausa = mensajePausa(res.status, datos);
      if (pausa) throw new ErrorCompras(pausa);
      if (!res.ok) {
        console.warn("[compras]", res.status, datos);
        throw new ErrorCompras(mensajePorEstado(res.status));
      }
      const r = RespuestaCompras.safeParse(datos);
      if (!r.success) {
        console.error("[compras] respuesta inválida", r.error);
        throw new ErrorCompras(MENSAJES.interno);
      }
      return r.data;
    } finally {
      plazo.listo();
    }
  };
}

export const fuenteApi = crearFuenteApi();

export type EstadoCompras =
  | { t: "inicio" }
  | { t: "buscando" }
  | { t: "listo"; opciones: OpcionCompra[]; motivo?: "incompleta" }
  | { t: "error"; mensaje: string };

/**
 * Una búsqueda completa, del lado de la pantalla: qué mostrar al terminar. `null` si la pantalla la
 * cortó (no hay nada que mostrar). Nunca deja pasar un error técnico.
 */
export async function buscar(
  fuente: FuenteCompras,
  pedido: PedidoCompra,
  senal: AbortSignal,
  onEvento?: (e: Evento) => void,
): Promise<Exclude<EstadoCompras, { t: "inicio" | "buscando" }> | null> {
  try {
    const r = await fuente(pedido, senal);
    if (senal.aborted) return null;
    r.eventos.forEach((e) => onEvento?.(e));
    return { t: "listo", opciones: r.opciones, ...(r.motivo ? { motivo: r.motivo } : {}) };
  } catch (e) {
    if (senal.aborted) return null;
    if (!(e instanceof ErrorCompras)) console.error("[compras]", e);
    return { t: "error", mensaje: e instanceof ErrorCompras ? e.message : MENSAJES.general };
  }
}

/** Solo links http(s): el botón "Comprar" nunca ejecuta nada, solo abre la publicación. */
export function hrefSeguro(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}
