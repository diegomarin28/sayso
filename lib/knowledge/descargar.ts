/**
 * Descarga y valida un PDF. Lo hace el código (no la IA): si no es un PDF real
 * o es demasiado grande, se descarta y se prueba el siguiente candidato.
 * Los manuales de servicio suelen pesar 20–60 MB: se suben con la Files API.
 */

export const MAX_PDF_BYTES = 150 * 1024 * 1024;

export type Pdf = { url: string; datos: Buffer; bytes: number };

export type Fetch = typeof fetch;

export async function descargarPdf(url: string, f: Fetch = fetch): Promise<Pdf | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const r = await f(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
      headers: { "user-agent": "Mozilla/5.0 (experto-al-lado; hackaton)" },
    });
    if (!r.ok) return null;
    const largo = Number(r.headers.get("content-length") ?? 0);
    if (largo > MAX_PDF_BYTES) return null;
    const datos = Buffer.from(await r.arrayBuffer());
    if (datos.length > MAX_PDF_BYTES) return null;
    if (datos.subarray(0, 5).toString("latin1") !== "%PDF-") return null;
    return { url, datos, bytes: datos.length };
  } catch {
    return null;
  }
}
