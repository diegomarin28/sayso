import { z } from "zod";
import { conversar, EntradaChat } from "../../../lib/chat/conversar";
import { estadoFreno, gastoPendiente, respuestaPausa } from "../../../lib/ia/freno";

export const maxDuration = 120;

/**
 * POST { casoId, pack, manualFileId?, historial?, pregunta }
 * → stream NDJSON (una línea JSON por evento):
 *   { tipo: "paso", coreografia }      frase a decir + acciones del 3D + cita
 *   { tipo: "bloqueo", coreografia }   riesgo alto: mostrar/decir la derivación, no hay más pasos
 *   { tipo: "fin", pasos } | { tipo: "error", mensaje }
 * IA en pausa (lib/ia/freno.ts): 503 { error, codigo: "ia_en_pausa" } antes de empezar.
 */
export async function POST(req: Request) {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return Response.json({ error: "El cuerpo no es JSON" }, { status: 400 });
  }
  const r = EntradaChat.safeParse(cuerpo);
  if (!r.success) return Response.json({ error: "Entrada inválida", detalle: z.treeifyError(r.error) }, { status: 400 });
  const pausa = await estadoFreno();
  if (pausa) return respuestaPausa(pausa);

  const codificador = new TextEncoder();
  const eventos = conversar(r.data);
  const cuerpoStream = new ReadableStream<Uint8Array>({
    async pull(controlador) {
      const { value, done } = await eventos.next();
      if (done) {
        await gastoPendiente();
        controlador.close();
      }
      else controlador.enqueue(codificador.encode(JSON.stringify(value) + "\n"));
    },
    async cancel() {
      await eventos.return(undefined);
    },
  });
  return new Response(cuerpoStream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
