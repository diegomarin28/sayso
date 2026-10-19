import type { PedidoDeFoto } from "../../../shared";
import type { Toma } from "../_estado/flujo";

/**
 * Qué se le pide a la persona en esta foto: la instrucción del pedido o, si eligió sacarle una foto
 * a otro lugar con el modelo (la caja, el control remoto…), eso. Es el texto que ve y también el que
 * recibe el control de calidad, que juzga la foto contra él (#229): si no coinciden, rechaza la caja
 * por "no ser la etiqueta" (#315).
 *
 * `elegida`: la alternativa que se acaba de tocar, que en ese mismo momento todavía no está en `toma`.
 */
export function instruccionDeFoto(
  pedido: Pick<PedidoDeFoto, "instruccion">,
  toma: Pick<Toma, "alternativa">,
  elegida?: string,
): string {
  const alternativa = elegida ?? toma.alternativa;
  if (!alternativa) return pedido.instruccion;
  const que = `${alternativa.charAt(0).toLowerCase()}${alternativa.slice(1)}`;
  return `Sacale una foto ${que.startsWith("el ") ? `al ${que.slice(3)}` : `a ${que}`}, que se lea el modelo.`;
}
