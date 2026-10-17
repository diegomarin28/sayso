import { LIMITES } from "../ia/claude";

/**
 * Descarga y valida un PDF. Lo hace el código (no la IA): si no es un PDF real
 * o es demasiado grande, se descarta.
 * Los manuales de servicio suelen pesar 20–60 MB: se suben con la Files API.
 */

export type Pdf = { url: string; datos: Buffer; bytes: number };

export type Fetch = typeof fetch;

export async function descargarPdf(url: string, f: Fetch = fetch): Promise<Pdf | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const r = await f(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(LIMITES.pdf.timeoutMs),
      headers: { "user-agent": "Mozilla/5.0 (experto-al-lado; hackaton)" },
    });
    if (!r.ok) return null;
    const largo = Number(r.headers.get("content-length") ?? 0);
    if (largo > LIMITES.pdf.maxBytes) return null;
    const datos = Buffer.from(await r.arrayBuffer());
    if (datos.length > LIMITES.pdf.maxBytes) return null;
    if (datos.subarray(0, 5).toString("latin1") !== "%PDF-") return null;
    return { url, datos, bytes: datos.length };
  } catch {
    return null;
  }
}

/** Título del diccionario /Info del PDF, si está en texto plano (ayuda al bibliotecario a confirmar el modelo). */
export function tituloDelPdf(datos: Buffer): string | null {
  const ventana = 300_000;
  const texto = datos.subarray(0, ventana).toString("latin1") + datos.subarray(Math.max(0, datos.length - ventana)).toString("latin1");
  const m = /\/Title\s*\(([^)]{3,200})\)/.exec(texto);
  return m ? m[1].replace(/\\(.)/g, "$1").trim() : null;
}
