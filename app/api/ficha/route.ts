import { aplicarConfirmacion, EntradaFicha } from "../../../lib/ficha/ficha";
import { evento, manejar } from "../../../lib/intake/entrada";

/**
 * POST { ficha, confirmados?: campo[], correcciones?: { campo: valor|null } }
 *   → { ficha, listaParaPreparar, eventos }
 * Todavía no guarda en Supabase (lib/supabase es de Iaio); se conecta en la integración.
 */
export function POST(req: Request) {
  return manejar(req, EntradaFicha, async (entrada) => {
    const r = aplicarConfirmacion(entrada);
    const { casoId, modelo } = r.ficha;
    const eventos = [
      r.listaParaPreparar
        ? evento(casoId, "identificador", "modelo_confirmado", `Modelo confirmado: ${modelo.valor}.`, {
            cambiados: r.cambiados,
          })
        : evento(casoId, "identificador", "modelo_sin_confirmar", "No tenemos el modelo confirmado todavía.", {
            cambiados: r.cambiados,
          }),
    ];
    return { ...r, eventos };
  }, { ia: false });
}
