import { z } from "zod";
import { Coreografia, type KnowledgePack, type PlanoDePiezas } from "../../../shared";

/**
 * Stream de /api/chat (NDJSON, una línea por evento; ver app/api/chat/README.md).
 * Todo lo que llega se valida con Zod: una línea que no valida se descarta.
 */
export const EventoChat = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("paso"), coreografia: Coreografia }),
  z.object({ tipo: z.literal("bloqueo"), coreografia: Coreografia, clases: z.array(z.string()).default([]) }),
  z.object({ tipo: z.literal("buscando"), texto: z.string() }),
  z.object({ tipo: z.literal("fin"), pasos: z.number().optional() }),
  z.object({ tipo: z.literal("error"), mensaje: z.string() }),
]);
export type EventoChat = z.infer<typeof EventoChat>;

export type MensajeHistorial = { rol: "persona" | "experto"; texto: string };

export type PedidoChat = {
  casoId: string;
  pack: KnowledgePack;
  plano: PlanoDePiezas;
  manualFileId?: string | null;
  historial: MensajeHistorial[];
  pregunta: string;
};

/** De dónde salen los eventos: la API real o, en /lab y tests, una simulación. */
export type FuenteChat = (pedido: PedidoChat, senal: AbortSignal) => AsyncIterable<EventoChat>;

/** Parte un stream de bytes en líneas JSON (las líneas pueden venir cortadas entre paquetes). */
export async function* leerNdjson(cuerpo: ReadableStream<Uint8Array>): AsyncGenerator<EventoChat> {
  const lector = cuerpo.getReader();
  const decodificador = new TextDecoder();
  let resto = "";
  const parsear = (linea: string): EventoChat | null => {
    if (!linea.trim()) return null;
    try {
      const r = EventoChat.safeParse(JSON.parse(linea));
      if (r.success) return r.data;
      console.error("[guia] evento inválido", r.error);
    } catch {
      console.error("[guia] línea que no es JSON");
    }
    return null;
  };
  try {
    for (;;) {
      const { value, done } = await lector.read();
      if (done) break;
      resto += decodificador.decode(value, { stream: true });
      const lineas = resto.split("\n");
      resto = lineas.pop() ?? "";
      for (const l of lineas) {
        const ev = parsear(l);
        if (ev) yield ev;
      }
    }
    const ev = parsear(resto + decodificador.decode());
    if (ev) yield ev;
  } finally {
    lector.releaseLock();
  }
}

/** Fuente real: POST /api/chat. */
export const fuenteApi: FuenteChat = async function* (pedido, senal) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pedido),
    signal: senal,
  });
  if (!res.ok || !res.body) {
    yield { tipo: "error", mensaje: "El experto no pudo responder. Probá de nuevo." };
    return;
  }
  yield* leerNdjson(res.body);
};
