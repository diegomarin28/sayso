import { z } from "zod";
import { aplicarConfirmacion, EntradaFicha } from "../../../lib/ficha/ficha";
import { evento, manejar, TipoEquipo } from "../../../lib/intake/entrada";
import { precisarModelo } from "../../../lib/intake/precisar";

const Entrada = EntradaFicha.extend({
  /** El de /api/intake/entender (ej. "notebook"): ayuda a saber si el modelo es una familia. */
  tipoEquipo: TipoEquipo.optional(),
  /** Respuesta de la persona a `precisar.pregunta`. Vacío = "no sé" (se sigue sin volver a preguntar). */
  precision: z.string().max(200).nullable().optional(),
});

/**
 * POST { ficha, confirmados?: campo[], correcciones?: { campo: valor|null }, tipoEquipo?, precision? }
 *   → { ficha, listaParaPreparar, cambiados, precisar?, eventos }
 * `precisar: { pregunta, dondeMirar }`: el modelo es una familia ("MacBook Air") y conviene preguntar la versión
 * ANTES de buscar el manual. Con la respuesta se vuelve a llamar con `precision` (y la ficha que devolvió esta
 * llamada); "No sé" sigue a preparar con el modelo como está.
 * `ia: false`: la pregunta es una ayuda, no un paso obligatorio. Si la IA está en pausa o falla, la ficha se
 * confirma igual, sin `precisar` (no responde 503).
 * Todavía no guarda en Supabase (lib/supabase es de Iaio); se conecta en la integración.
 */
export function POST(req: Request) {
  return manejar(req, Entrada, async (entrada) => {
    const confirmada = aplicarConfirmacion(entrada);
    const p = await precisarModelo({ ficha: confirmada.ficha, tipoEquipo: entrada.tipoEquipo, respuesta: entrada.precision });
    const cambiados = p.precisado && !confirmada.cambiados.includes("modelo") ? [...confirmada.cambiados, "modelo" as const] : confirmada.cambiados;
    const r = { ...confirmada, ficha: p.ficha, cambiados };
    const { casoId, modelo } = r.ficha;
    const eventos = [
      r.listaParaPreparar
        ? evento(casoId, "identificador", "modelo_confirmado", `Modelo confirmado: ${modelo.valor}.`, {
            cambiados: r.cambiados,
          })
        : evento(casoId, "identificador", "modelo_sin_confirmar", "No tenemos el modelo confirmado todavía.", {
            cambiados: r.cambiados,
          }),
      ...(p.precisar
        ? [evento(casoId, "identificador", "modelo_ambiguo", `"${modelo.valor}" tiene varias versiones: te pregunto cuál es antes de buscar el manual.`, { ...p.precisar })]
        : []),
    ];
    return { ...r, ...(p.precisar ? { precisar: p.precisar } : {}), eventos };
  }, { ia: false });
}
