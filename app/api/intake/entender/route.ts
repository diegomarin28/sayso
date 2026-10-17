import { z } from "zod";
import { entender } from "../../../../lib/intake/entender";
import { evento, manejar } from "../../../../lib/intake/entrada";

const Entrada = z.object({ texto: z.string().trim().min(1).max(2000) });

/**
 * POST { texto } → { caso: Caso, tipoEquipo, eventos, bloqueo? }
 * `tipoEquipo`: el equipo en texto libre (ej. "heladera no frost"); pasalo a /api/intake/pedidos y /api/intake/chapa.
 * `bloqueo` aparece si lo que contó la persona es de riesgo alto (gas, 220 V, batería hinchada...):
 * mostrar `bloqueo.derivacion` antes de seguir.
 */
export function POST(req: Request) {
  return manejar(req, Entrada, async ({ texto }) => {
    const { caso, tipoEquipo, seguridad, porIA } = await entender(texto);
    const eventos = [
      evento(
        caso.id,
        "recepcion",
        "caso_creado",
        porIA ? `Entendí: ${tipoEquipo}. ${caso.sintoma}` : "No pude identificar el equipo; elegilo vos.",
        { clase: caso.clase, tipoEquipo, porIA },
      ),
    ];
    if (seguridad.bloqueado) {
      eventos.push(evento(caso.id, "seguridad", "paso_bloqueado", seguridad.derivacion ?? "Riesgo alto.", { clases: seguridad.clases }));
    }
    return {
      caso,
      tipoEquipo,
      eventos,
      ...(seguridad.bloqueado ? { bloqueo: { clases: seguridad.clases, derivacion: seguridad.derivacion } } : {}),
    };
  });
}
