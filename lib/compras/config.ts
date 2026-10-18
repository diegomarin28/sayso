import { MODELOS } from "../ia/claude";
import { LIMITES_COMPRAS } from "./limites";

/**
 * Configuración del agente de compras (A6) en un solo lugar — dueño: Diego.
 * El modelo y los precios salen de lib/ia/claude.ts (MODELOS, PRECIOS); acá solo lo propio de compras.
 */
export const COMPRAS = {
  /** Haiku alcanza: buscar, leer avisos y copiar precios. */
  modelo: MODELOS.corto,
  effort: "low" as const,
  maxTokens: 8000,
  /** Versiones básicas de las herramientas: las de filtrado dinámico (20260209) no corren en Haiku. */
  herramientas: { busqueda: "web_search_20250305", lectura: "web_fetch_20250910" } as const,
  /**
   * Búsquedas y lecturas por pedido. Haiku cobra 5 veces más la entrada de un pedido de más de 100K tokens
   * (`PRECIOS`, tarifa "largo"): con 5 búsquedas y 6 páginas de 12K, una búsqueda real leyó 166K y costó
   * US$ 0,13. Con esto queda debajo de ese umbral (ver `PEOR_PEDIDO_TOKENS`): unos US$ 0,04.
   */
  busquedas: 3,
  lecturas: 4,
  /** Tope de cada página leída (los avisos de Mercado Libre son largos; precio y envío están arriba). */
  tokensPorPagina: 8_000,
  /** Lo que suele traer cada búsqueda web en resultados (para estimar el peor pedido). */
  tokensPorBusqueda: 15_000,
  vueltas: 8,
  /**
   * Pasado este tiempo se deja de buscar y se pide el JSON con lo que hay (sin herramientas): la ruta
   * corta a los 120 s (maxDuration) y un 504 de Vercel se veía como "no pude buscar".
   */
  plazoMs: 75_000,
  ...LIMITES_COMPRAS,
  /** Largo mínimo (sin espacios ni guiones) para aceptar una coincidencia de número de parte o modelo. */
  minCoincidencia: 4,
  /** Texto de cada página leída que se guarda para verificar (el resto no hace falta). */
  maxTextoEvidencia: 60_000,
} as const;

/**
 * El pedido más largo posible (sistema, pedido y respuestas incluidos): todas las páginas leídas al tope y
 * todas las búsquedas. Tiene que quedar debajo de la tarifa larga de Haiku (100K tokens).
 */
export const PEOR_PEDIDO_TOKENS = COMPRAS.lecturas * COMPRAS.tokensPorPagina + COMPRAS.busquedas * COMPRAS.tokensPorBusqueda + 10_000;
