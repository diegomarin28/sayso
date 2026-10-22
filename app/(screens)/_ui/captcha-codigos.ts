/** El script de Turnstile no cargó (red, bloqueador): no hay código de Cloudflare, así que usamos uno propio. */
export const CODIGO_NO_CARGO = "no-cargo";

/**
 * Frase corta para el código de error de Turnstile. Sin red, solo cambia el texto: el código lo muestra
 * el cartel aparte. Los códigos de Cloudflare: 110xxx son de configuración del widget (110200, dominio
 * no autorizado) y 300xxx o 600xxx son fallos de la verificación.
 */
export function fraseCaptcha(codigo: string | null): string {
  if (codigo === null) return "Probá de nuevo.";
  if (codigo === CODIGO_NO_CARGO) return "No se pudo cargar la verificación. Revisá la conexión y volvé a intentar.";
  if (codigo === "110200") return "Esta página no está autorizada para la verificación (dominio no autorizado).";
  if (codigo.startsWith("110")) return "Hay un problema de configuración de la verificación.";
  if (codigo.startsWith("300") || codigo.startsWith("600")) return "Cloudflare no pudo confirmar la verificación. Probá de nuevo.";
  return "Pasó algo inesperado con la verificación. Probá de nuevo.";
}
