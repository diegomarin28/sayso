import type { Coreografia, Evento } from "../../shared";
import { filtrarCoreografia, type Evaluacion } from "../../lib/safety/riesgos";

/**
 * Puerta de entrada de toda coreografía al visor: ANTES de animar, pasa por el
 * filtro de seguridad (lib/safety). Si el paso es de riesgo alto, se anima la
 * versión filtrada (solo `restaurar`) y se emite un evento para el feed.
 */
export type PasoPreparado = {
  coreografia: Coreografia;
  evaluacion: Evaluacion;
  eventos: Evento[];
};

/** `tipoEquipo`: el aviso de seguridad depende del equipo (a batería: la batería de litio; enchufado: desenchufar), aunque el paso no lo nombre. */
export function prepararPaso(original: Coreografia, ctx: { casoId: string; tipoEquipo?: string }): PasoPreparado {
  const { coreografia, evaluacion } = filtrarCoreografia(original, { tipoEquipo: ctx.tipoEquipo });
  const eventos: Evento[] = evaluacion.bloqueado
    ? [
        {
          id: `ev-seguridad-${Date.now()}-${original.paso}`,
          casoId: ctx.casoId,
          agente: "seguridad",
          tipo: "paso_bloqueado",
          mensaje: `Se bloqueó el paso ${original.paso} (riesgo alto: ${evaluacion.clases.join(", ") || "propuesto por la IA"}). No se anima.`,
          ts: new Date().toISOString(),
          datos: { clases: evaluacion.clases, dicePropuesto: original.dice },
        },
      ]
    : [];
  return { coreografia, evaluacion, eventos };
}
