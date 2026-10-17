/**
 * Límites de compras que también usa el navegador (los esquemas de esquemas.ts), sin dependencias:
 * así <OpcionesCompra> valida la respuesta sin arrastrar el SDK de la IA al cliente.
 */
export const LIMITES_COMPRAS = {
  /** Candidatos que puede proponer el agente; el código elige las mejores. */
  candidatosMax: 8,
  opciones: 3,
} as const;
