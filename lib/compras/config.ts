import { MODELOS } from "../ia/claude";

/**
 * Configuración del agente de compras (A6) en un solo lugar — dueño: Diego.
 * El modelo sale de MODELOS (lib/ia/claude.ts); acá solo lo propio de compras.
 */
export const COMPRAS = {
  /** Haiku alcanza: buscar, leer avisos y copiar precios. */
  modelo: MODELOS.corto,
  effort: "low" as const,
  maxTokens: 8000,
  /** Versiones básicas de las herramientas: las de filtrado dinámico (20260209) no corren en Haiku. */
  herramientas: { busqueda: "web_search_20250305", lectura: "web_fetch_20250910" } as const,
  busquedas: 5,
  lecturas: 6,
  /** Tope de cada página leída (los avisos de Mercado Libre son largos). */
  tokensPorPagina: 12_000,
  vueltas: 8,
  /** Candidatos que puede proponer el agente; el código elige las mejores. */
  candidatosMax: 8,
  opciones: 3,
  /** Largo mínimo (sin espacios ni guiones) para aceptar una coincidencia de número de parte o modelo. */
  minCoincidencia: 4,
  /** Texto de cada página leída que se guarda para verificar (el resto no hace falta). */
  maxTextoEvidencia: 60_000,
} as const;

/**
 * Precios de lista en USD (para registrar el costo de cada búsqueda). Si cambia COMPRAS.modelo, cambiar acá.
 * Haiku 5.5: 0,10 / 0,50 por millón de tokens hasta 100K de prompt; 0,50 / 2,50 más arriba.
 * Búsqueda web: 10 USD cada 1.000. Lectura web (web_fetch): sin cargo aparte, solo los tokens.
 */
export const PRECIOS = {
  /** Tokens de prompt a partir de los cuales rige la tarifa "largo". */
  corte: 100_000,
  normal: { entrada: 0.1, salida: 0.5 },
  largo: { entrada: 0.5, salida: 2.5 },
  /** Multiplicadores sobre el precio de entrada. */
  cacheEscritura: 1.25,
  cacheLectura: 0.1,
  busquedaWeb: 10 / 1000,
} as const;
