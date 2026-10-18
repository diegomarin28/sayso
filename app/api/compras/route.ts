import { buscarOpciones } from "../../../lib/compras/agente";
import { PedidoCompra } from "../../../lib/compras/esquemas";
import { evento, manejar } from "../../../lib/intake/entrada";

/** Dueño: Diego (A6). Buscar y leer avisos tarda ~20–60 s. */
export const maxDuration = 120;

/**
 * POST { pieza, nombre?, numeroParte, modelo, marca?, casoId? }
 *   → { opciones (hasta 3, mejor primero), cotizacion, descartados, costo, motivo?, eventos }
 * Cada opción trae `compatibilidad` ("numero_parte" | "modelo" | "no_verificado") y el estado del precio y del envío.
 * El costo va en `costo` y, si hay casoId, `manejar` suma su evento al feed. Nunca compra: la pantalla solo abre la publicación.
 */
export function POST(req: Request) {
  return manejar(req, PedidoCompra, async (pedido) => {
    const r = await buscarOpciones(pedido);
    const verificadas = r.opciones.filter((o) => o.compatibilidad !== "no_verificado").length;
    const pieza = pedido.nombre ?? pedido.pieza;
    const mensaje = r.opciones.length
      ? `Encontré ${r.opciones.length} opciones para ${pieza} (${verificadas} con número de parte o modelo verificado).`
      : r.motivo === "incompleta"
        ? `No llegué a terminar la búsqueda de ${pieza} a tiempo.`
        : `No encontré dónde comprar ${pieza} para este modelo.`;
    const eventos = pedido.casoId
      ? [evento(pedido.casoId, "compras", "opciones_compra", mensaje, { descartados: r.descartados.length })]
      : [];
    return { ...r, eventos };
  });
}
