import type Anthropic from "@anthropic-ai/sdk";
import { COMPRAS, PRECIOS } from "./config";
import type { Costo } from "./esquemas";

const MILLON = 1_000_000;

/** Suma el uso de todas las vueltas del agente y lo pasa a USD con los precios de lista. */
export function costoDe(mensajes: Pick<Anthropic.Message, "usage">[]): Costo {
  const c: Costo = { modelo: COMPRAS.modelo, tokensEntrada: 0, tokensSalida: 0, busquedas: 0, lecturas: 0, usd: 0 };
  for (const { usage: u } of mensajes) {
    const escritos = u.cache_creation_input_tokens ?? 0;
    const leidos = u.cache_read_input_tokens ?? 0;
    const prompt = u.input_tokens + escritos + leidos;
    const tarifa = prompt > PRECIOS.corte ? PRECIOS.largo : PRECIOS.normal;
    const busquedas = u.server_tool_use?.web_search_requests ?? 0;

    c.tokensEntrada += prompt;
    c.tokensSalida += u.output_tokens;
    c.busquedas += busquedas;
    c.lecturas += u.server_tool_use?.web_fetch_requests ?? 0;
    c.usd +=
      ((u.input_tokens + escritos * PRECIOS.cacheEscritura + leidos * PRECIOS.cacheLectura) * tarifa.entrada +
        u.output_tokens * tarifa.salida) /
        MILLON +
      busquedas * PRECIOS.busquedaWeb;
  }
  c.usd = Number(c.usd.toFixed(5));
  return c;
}
