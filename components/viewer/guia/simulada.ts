import { coreografiaEjemplo, type Coreografia } from "../../../shared";
import { evaluarPedido } from "../../../lib/safety/riesgos";
import type { EventoChat, FuenteChat } from "./eventos-chat";

/**
 * Fuente de respuestas SIMULADA para /lab y tests (sin IA, sin gastar créditos).
 * Usa los fixtures y el mismo bloqueo de seguridad que el servidor.
 */
const pausa = (ms: number, senal: AbortSignal) =>
  new Promise<void>((r) => {
    const t = setTimeout(r, ms);
    senal.addEventListener("abort", () => (clearTimeout(t), r()), { once: true });
  });

export const fuenteSimulada: FuenteChat = async function* (pedido, senal) {
  await pausa(900, senal);
  const evaluacion = evaluarPedido(pedido.pregunta);
  if (evaluacion.bloqueado) {
    yield {
      tipo: "bloqueo",
      clases: evaluacion.clases,
      coreografia: { paso: 1, dice: `Acá frenamos. ${evaluacion.derivacion}`, acciones: [{ t: "restaurar" }], riesgo: "alto" },
    };
    return;
  }
  const ids = new Set(pedido.plano.piezas.map((p) => p.pieza));
  const nombrada = pedido.pack.piezas.find((p) => ids.has(p.id) && pedido.pregunta.toLowerCase().includes(p.nombre.toLowerCase().split(" ").pop()!.toLowerCase()));
  let pasos: Coreografia[];
  if (nombrada) {
    pasos = [
      {
        paso: 1,
        dice: `${nombrada.nombre}: ${nombrada.ubicacion}. Te la marco en naranja.`,
        // Sin marcas, como suele responder la IA: la guía va a la pieza nombrada sola (B6, pieza-nombrada.ts).
        acciones: [{ t: "restaurar" }],
        riesgo: "bajo",
      },
    ];
  } else {
    yield { tipo: "buscando", texto: "Dejame buscarlo en el manual…" } satisfies EventoChat;
    await pausa(1500, senal);
    pasos = coreografiaEjemplo;
  }
  for (const c of pasos) {
    if (senal.aborted) return;
    yield { tipo: "paso", coreografia: c };
    await pausa(300, senal);
  }
  yield { tipo: "fin", pasos: pasos.length };
};
