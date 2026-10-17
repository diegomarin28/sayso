import { z } from "zod";

/**
 * Lo que la app necesita saber del freno de gasto (lib/ia/freno.ts), sin código de servidor:
 * se usa en el navegador para mostrar "IA en pausa" en vez de un error genérico.
 */
export const CODIGO_PAUSA = "ia_en_pausa";

export const MENSAJE_PAUSA = "IA en pausa. Probá de nuevo más tarde.";

const RespPausa = z.object({ codigo: z.literal(CODIGO_PAUSA), error: z.string().min(1).max(300).optional() });

/** Si la respuesta de una ruta es la pausa de la IA, el mensaje para mostrar; si no, null. */
export function mensajePausa(status: number, datos: unknown): string | null {
  if (status !== 503) return null;
  const r = RespPausa.safeParse(datos);
  return r.success ? (r.data.error ?? MENSAJE_PAUSA) : null;
}
