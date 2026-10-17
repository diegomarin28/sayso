import { buscarOpciones } from "../../../lib/compras/agente";
import { PedidoCompra } from "../../../lib/compras/esquemas";
import { evento, manejar } from "../../../lib/intake/entrada";

/** Dueño: Diego (A6). Buscar y leer avisos tarda ~20–60 s. */
export const maxDuration = 120;

/**
 * POST { pieza, numeroParte, modelo, marca?, casoId? }
 *   → { opciones (hasta 3, mejor primero), cotizacion, descartados, costo, eventos }
 * Cada opción trae `compatibilidad` ("numero_parte" | "modelo" | "no_verificado") y el estado del precio y del envío.
 * Nunca compra: la pantalla solo abre la publicación.
 */
export function POST(req: Request) {
  return manejar(req, PedidoCompra, async (pedido) => {
    const r = await buscarOpciones(pedido);
    const verificadas = r.opciones.filter((o) => o.compatibilidad !== "no_verificado").length;
    const mensaje = r.opciones.length
      ? `Encontré ${r.opciones.length} opciones para ${pedido.pieza} (${verificadas} con número de parte o modelo verificado).`
      : `No encontré dónde comprar ${pedido.pieza} para este modelo.`;
    const eventos = pedido.casoId
      ? [evento(pedido.casoId, "compras", "opciones_compra", mensaje, { costo: r.costo, descartados: r.descartados.length })]
      : [];
    return { ...r, eventos };
  });
}
