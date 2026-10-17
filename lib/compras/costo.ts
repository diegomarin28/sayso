import type Anthropic from "@anthropic-ai/sdk";
import { calcularUso, totalUsd } from "../ia/claude";
import { COMPRAS } from "./config";
import type { Costo } from "./esquemas";

export const ETAPA = "compras: buscar repuesto";

/** Total de una búsqueda (todas las vueltas del agente), con los precios de lib/ia/claude.ts. */
export function costoDe(mensajes: Pick<Anthropic.Message, "usage">[]): Costo {
  const usos = mensajes.map((m) => calcularUso(ETAPA, COMPRAS.modelo, m.usage));
  const suma = (f: (u: (typeof usos)[number]) => number) => usos.reduce((s, u) => s + f(u), 0);
  return {
    modelo: COMPRAS.modelo,
    tokensEntrada: suma((u) => u.entrada + u.cacheEscrita + u.cacheLeida),
    tokensSalida: suma((u) => u.salida),
    busquedas: suma((u) => u.busquedas),
    usd: Number(totalUsd(usos).toFixed(5)),
  };
}
