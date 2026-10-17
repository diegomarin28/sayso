import type { Coreografia } from "../../../shared";
import type { EventoChat, MensajeHistorial } from "./eventos-chat";

/**
 * Reproduce una respuesta del experto, en orden: cada paso se muestra (y se anima) y se
 * espera a que termine de "decirse" antes del siguiente. Sin React: testeable.
 */
export type EstadoGuia = "esperando" | "pensando" | "buscando" | "hablando" | "bloqueado" | "error";

export type Manejadores = {
  estado: (e: EstadoGuia, detalle?: string) => void;
  /** Muestra la frase y manda la coreografía al visor. */
  paso: (c: Coreografia, bloqueo: boolean) => void;
  /** Espera a que la frase termine (voz real o tiempo de lectura). */
  decir: (texto: string, senal: AbortSignal) => Promise<void>;
};

/** Tiempo para leer una frase si no hay voz: ~55 ms por letra, entre 2,5 y 9 s. */
export function tiempoDeLectura(texto: string): number {
  return Math.min(Math.max(texto.length * 55 + 1200, 2500), 9000);
}

export function esperar(ms: number, senal: AbortSignal): Promise<void> {
  return new Promise((resolver) => {
    if (senal.aborted) return resolver();
    const t = setTimeout(resolver, ms);
    senal.addEventListener("abort", () => (clearTimeout(t), resolver()), { once: true });
  });
}

/** Devuelve lo que dijo el experto (para el historial). */
export async function reproducir(
  eventos: AsyncIterable<EventoChat>,
  m: Manejadores,
  senal: AbortSignal,
): Promise<MensajeHistorial | null> {
  const dicho: string[] = [];
  m.estado("pensando");
  let final: EstadoGuia = "esperando";
  for await (const ev of eventos) {
    if (senal.aborted) break;
    if (ev.tipo === "buscando") {
      m.estado("buscando", ev.texto);
    } else if (ev.tipo === "paso" || ev.tipo === "bloqueo") {
      const bloqueo = ev.tipo === "bloqueo";
      m.estado(bloqueo ? "bloqueado" : "hablando");
      m.paso(ev.coreografia, bloqueo);
      dicho.push(ev.coreografia.dice);
      await m.decir(ev.coreografia.dice, senal);
      if (bloqueo) {
        final = "bloqueado";
        break; // después de un bloqueo no vienen más pasos
      }
    } else if (ev.tipo === "error") {
      m.estado("error", ev.mensaje);
      final = "error";
      break;
    } else {
      break; // fin
    }
  }
  if (!senal.aborted && final !== "error") m.estado(final);
  return dicho.length ? { rol: "experto", texto: dicho.join(" ") } : null;
}
