import { ErrorVoz, tokenScribe } from "../../../../lib/voice/elevenlabs";

/** POST → { token } para Scribe Realtime. 503 = sin ElevenLabs: usar la voz del navegador. Dueño: Iaio. */
export async function POST() {
  try {
    return Response.json({ token: await tokenScribe() });
  } catch (e) {
    const status = e instanceof ErrorVoz ? e.status : 500;
    console.error("[voz/token]", e instanceof Error ? e.message : e);
    return Response.json({ error: e instanceof ErrorVoz ? e.message : "Error interno" }, { status });
  }
}
