import { z } from "zod";
import { ErrorVoz, hablarStream } from "../../../../lib/voice/elevenlabs";

/** POST { texto } → audio/mpeg en streaming. 503 = sin ElevenLabs: usar la voz del navegador. Dueño: Iaio. */

const Entrada = z.object({ texto: z.string().trim().min(1).max(1500) });

export async function POST(req: Request) {
  const r = Entrada.safeParse(await req.json().catch(() => null));
  if (!r.success) return Response.json({ error: "Entrada inválida" }, { status: 400 });
  try {
    const audio = await hablarStream(r.data.texto);
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (e) {
    const status = e instanceof ErrorVoz ? e.status : 500;
    console.error("[voz/hablar]", e instanceof Error ? e.message : e);
    return Response.json({ error: e instanceof ErrorVoz ? e.message : "Error interno" }, { status });
  }
}
