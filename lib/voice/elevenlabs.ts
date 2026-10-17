/**
 * ElevenLabs del lado del servidor (la clave nunca llega al navegador).
 * Sin ELEVENLABS_API_KEY las rutas de voz responden 503 con un mensaje claro y el
 * navegador usa su propia voz (Web Speech API); el campo de texto siempre está.
 */

const BASE = "https://api.elevenlabs.io/v1";

/** Flash v2.5: el de menor latencia, habla español. */
export const MODELO_TTS = "eleven_flash_v2_5";
/** Voz por defecto (multilingüe). Se cambia con ELEVENLABS_VOICE_ID sin tocar código. */
const VOZ_POR_DEFECTO = "JBFqnCBsd6RMkjVDRZzb";

export const SIN_CLAVE =
  "Falta ELEVENLABS_API_KEY: la voz de ElevenLabs está apagada y se usa la del navegador.";

export class ErrorVoz extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function clave(): string | null {
  return process.env.ELEVENLABS_API_KEY?.trim() || null;
}

export const hayElevenLabs = () => clave() !== null;

/** Token de un solo uso (15 min) para que el navegador se conecte a Scribe Realtime. */
export async function tokenScribe(): Promise<string> {
  const k = clave();
  if (!k) throw new ErrorVoz(SIN_CLAVE, 503);
  const res = await fetch(`${BASE}/single-use-token/realtime_scribe`, {
    method: "POST",
    headers: { "xi-api-key": k },
  });
  if (!res.ok)
    throw new ErrorVoz(`ElevenLabs no dio el token (${res.status})`, res.status === 401 ? 503 : 502);
  const datos = (await res.json()) as { token?: unknown };
  if (typeof datos.token !== "string") throw new ErrorVoz("ElevenLabs respondió sin token", 502);
  return datos.token;
}

/** Audio MP3 en streaming del texto, para reproducir a medida que llega. */
export async function hablarStream(texto: string): Promise<ReadableStream<Uint8Array>> {
  const k = clave();
  if (!k) throw new ErrorVoz(SIN_CLAVE, 503);
  const voz = process.env.ELEVENLABS_VOICE_ID?.trim() || VOZ_POR_DEFECTO;
  const res = await fetch(`${BASE}/text-to-speech/${voz}/stream?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": k, "Content-Type": "application/json" },
    body: JSON.stringify({ text: texto, model_id: MODELO_TTS, language_code: "es" }),
  });
  if (!res.ok || !res.body) {
    const detalle = await res.text().catch(() => "");
    throw new ErrorVoz(`ElevenLabs no pudo hablar (${res.status}) ${detalle.slice(0, 200)}`, 502);
  }
  return res.body;
}
