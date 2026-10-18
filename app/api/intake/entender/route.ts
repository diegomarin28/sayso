import { z } from "zod";
import { entender } from "../../../../lib/intake/entender";
import { evento, manejar } from "../../../../lib/intake/entrada";

const Entrada = z.object({ texto: z.string().trim().min(1).max(2000) });

/**
 * POST { texto } → { caso: Caso, tipoEquipo, claro, repregunta?, eventos, bloqueo? }
 * `claro: false`: no se entendió qué equipo es o qué le pasa; la pantalla vuelve a preguntar con `repregunta`.
 * `tipoEquipo`: el equipo en texto libre (ej. "heladera no frost"); pasalo a /api/intake/pedidos y /api/intake/chapa.
 * `bloqueo` aparece si lo que contó la persona es de riesgo alto (gas, 220 V, batería hinchada...):
 * mostrar `bloqueo.derivacion` antes de seguir.
 */
export function POST(req: Request) {
  return manejar(req, Entrada, async ({ texto }) => {
    const { caso, tipoEquipo, seguridad, porIA, claro, repregunta } = await entender(texto);
    const eventos = [
      evento(
        caso.id,
        "recepcion",
        "caso_creado",
        !porIA ? "No pude identificar el equipo; elegilo vos." : claro ? `Entendí: ${tipoEquipo}. ${caso.sintoma}` : `No entendí bien lo que contaste; vuelvo a preguntar: ${repregunta}`,
        { clase: caso.clase, tipoEquipo, porIA, claro },
      ),
    ];
    if (seguridad.bloqueado) {
      eventos.push(evento(caso.id, "seguridad", "paso_bloqueado", seguridad.derivacion ?? "Riesgo alto.", { clases: seguridad.clases }));
    }
    return {
      caso,
      tipoEquipo,
      claro,
      ...(repregunta ? { repregunta } : {}),
      eventos,
      ...(seguridad.bloqueado ? { bloqueo: { clases: seguridad.clases, derivacion: seguridad.derivacion } } : {}),
    };
  });
}
