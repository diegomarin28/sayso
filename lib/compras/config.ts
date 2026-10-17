import { MODELOS } from "../ia/claude";

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
