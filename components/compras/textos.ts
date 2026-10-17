import type { Compatibilidad, OpcionCompra } from "../../lib/compras/esquemas";

/** Textos de <OpcionesCompra>, aparte para poder probarlos sin navegador. */

const formatos = {
  UYU: new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 }),
  USD: new Intl.NumberFormat("es-UY", { style: "currency", currency: "USD", maximumFractionDigits: 2 }),
};

export function precio(monto: number, moneda: OpcionCompra["precio"]["moneda"]): string {
  return formatos[moneda].format(monto);
}

export function textoEnvio(o: OpcionCompra): string {
  if (o.envio.monto === null) return "Envío a Uruguay: a confirmar";
  if (o.envio.monto === 0) return "Envío gratis";
  return `Envío: ${precio(o.envio.monto, o.precio.moneda)}`;
}

export function textoTotal(o: OpcionCompra): string | null {
  if (o.totalUyu === null) return null;
  return `Total ${o.envio.monto === null ? "sin envío" : "con envío"}: ${precio(o.totalUyu, "UYU")}`;
}

export const COMPATIBILIDAD: Record<Compatibilidad, { texto: string; verificado: boolean }> = {
  numero_parte: { texto: "Coincide el número de parte", verificado: true },
  modelo: { texto: "Nombra tu modelo", verificado: true },
  no_verificado: { texto: "No verificado: revisá que sea compatible", verificado: false },
};

/** Aviso cuando el precio no se vio en la página leída (lo informó la IA y no se pudo comprobar). */
export function avisoPrecio(o: OpcionCompra): string | null {
  return o.precio.estado === "confirmado" ? null : "Precio sin confirmar: miralo en la publicación";
}
