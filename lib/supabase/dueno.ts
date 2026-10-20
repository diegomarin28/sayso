import type { SupabaseClient } from "@supabase/supabase-js";
import { ErrorSupabase } from "./repo";

/**
 * Dueño de un caso (#331): sin login, el id anónimo del dispositivo (`casos.dispositivo`).
 * Ninguna ruta lo devuelve, así que funciona como la llave de ese celular. Cuando entre el
 * login, este es el lugar donde se cambia por `auth.uid()`.
 *
 * Se revisa con lecturas antes de escribir nada. `guardarCaso` vuelve a comprobarlo al escribir
 * (por si otro pedido creó el caso en el medio). Si una lectura falla, no se deja seguir.
 */

export type PedidoAEscribir = {
  /** Caso que viene en el pedido: si no existe todavía, lo crea este dispositivo. */
  casoId?: string;
  /** Casos que referencian fotos, ficha y eventos del pedido. */
  referenciados: string[];
  fotos: { id: string; casoId: string }[];
  eventos: { id: string; casoId: string }[];
};

function revisar(error: { message: string } | null, que: string) {
  if (error) throw new ErrorSupabase(`${que}: ${error.message}`);
}

/** true = todo lo del pedido es de este dispositivo (o nuevo). Los casos sin dueño (antes de la 007) no se tocan. */
export async function esDelDispositivo(
  db: SupabaseClient,
  dispositivo: string,
  p: PedidoAEscribir,
): Promise<boolean> {
  const casos = [...new Set([...(p.casoId ? [p.casoId] : []), ...p.referenciados])];
  if (casos.length > 0) {
    const { data, error } = await db.from("casos").select("id, dispositivo").in("id", casos);
    revisar(error, "revisar dueño del caso");
    const dueno = new Map((data ?? []).map((f: { id: string; dispositivo: string | null }) => [f.id, f.dispositivo]));
    for (const id of casos) {
      // Un caso que no existe solo vale si es el que crea este mismo pedido.
      if (!dueno.has(id) ? id !== p.casoId : dueno.get(id) !== dispositivo) return false;
    }
  }
  // Un id de foto o evento que ya existe no puede pasar de otro caso a uno propio.
  for (const [tabla, filas] of [["fotos", p.fotos], ["eventos", p.eventos]] as const) {
    if (filas.length === 0) continue;
    const { data, error } = await db.from(tabla).select("id, caso_id").in("id", filas.map((f) => f.id));
    revisar(error, `revisar dueño de ${tabla}`);
    const caso = new Map((data ?? []).map((f: { id: string; caso_id: string }) => [f.id, f.caso_id]));
    if (filas.some((f) => caso.has(f.id) && caso.get(f.id) !== f.casoId)) return false;
  }
  return true;
}

export function respuestaAjeno(): Response {
  return Response.json({ error: "Este caso es de otro dispositivo", codigo: "ajeno" }, { status: 403 });
}
