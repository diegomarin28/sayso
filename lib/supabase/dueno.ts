import type { SupabaseClient } from "@supabase/supabase-js";
import type { Caso, Evento, Ficha, Foto } from "../../shared";
import { ErrorSupabase } from "./repo";

/**
 * Dueño de cada caso en POST /api/casos (docs/login.md §3 y §4). El dueño es el uid de la sesión
 * verificada (`uidDeSesion`), nunca un campo del cuerpo; la ruta responde 401 antes si no hay sesión.
 * - Un caso que no existe solo se crea con el caso en el mismo pedido, y queda de ese uid.
 * - Un caso que ya existe solo lo escribe su dueño; los que no tienen dueño (sin reclamar, o viejos
 *   de antes de la 007) no los escribe nadie.
 * - Una foto o un evento que ya existe no se reescribe desde otro caso.
 * Al revés que los topes, si la consulta falla no deja seguir: lanza y la ruta responde 500.
 */

export type MotivoDueno = "caso_ajeno" | "caso_inexistente" | "id_ajeno";

export type Pedido = { caso?: Caso; fotos: Foto[]; ficha?: Ficha; eventos: Evento[] };

/** Filas `{ id, caso_id }` de esa tabla con esos ids. */
async function casoDeCadaId(db: SupabaseClient, tabla: "fotos" | "eventos", ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const { data, error } = await db.from(tabla).select("id, caso_id").in("id", ids);
  if (error) throw new ErrorSupabase(`dueño (${tabla}): ${error.message}`);
  return new Map((data ?? []).map((f: { id: string; caso_id: string }) => [f.id, f.caso_id]));
}

/** null = el pedido puede escribir todo lo que trae. */
export async function revisarDueno(
  db: SupabaseClient,
  uid: string,
  { caso, fotos, ficha, eventos }: Pedido,
): Promise<MotivoDueno | null> {
  const casoIds = new Set([
    ...(caso ? [caso.id] : []),
    ...fotos.map((f) => f.casoId),
    ...(ficha ? [ficha.casoId] : []),
    ...eventos.map((e) => e.casoId),
  ]);
  if (casoIds.size === 0) return null;

  const { data, error } = await db.from("casos").select("id, dueno").in("id", [...casoIds]);
  if (error) throw new ErrorSupabase(`dueño (casos): ${error.message}`);
  const duenos = new Map((data ?? []).map((c: { id: string; dueno: string | null }) => [c.id, c.dueno]));
  for (const id of casoIds) {
    if (!duenos.has(id)) {
      if (id !== caso?.id) return "caso_inexistente";
    } else if (duenos.get(id) !== uid) {
      return "caso_ajeno";
    }
  }

  const [deFotos, deEventos] = await Promise.all([
    casoDeCadaId(db, "fotos", fotos.map((f) => f.id)),
    casoDeCadaId(db, "eventos", eventos.map((e) => e.id)),
  ]);
  const ajeno = (filas: Map<string, string>, x: { id: string; casoId: string }) =>
    filas.has(x.id) && filas.get(x.id) !== x.casoId;
  if (fotos.some((f) => ajeno(deFotos, f)) || eventos.some((e) => ajeno(deEventos, e))) return "id_ajeno";
  return null;
}

/**
 * Reclamo del dispositivo (una sola vez por celular): los casos de ese `dispositivo` que todavía no
 * tienen dueño pasan al uid, y pierden el `dispositivo`, así que desde ahí no da permiso sobre nada.
 * Devuelve cuántos casos pasó. Riesgo aceptado en el diseño: quien tenga el UUID antes del reclamo
 * puede reclamar esos casos, el mismo poder que tenía antes del login.
 */
export async function reclamarDispositivo(db: SupabaseClient, uid: string, dispositivo: string): Promise<number> {
  const { data, error } = await db
    .from("casos")
    .update({ dueno: uid, dispositivo: null })
    .eq("dispositivo", dispositivo)
    .is("dueno", null)
    .select("id");
  if (error) throw new ErrorSupabase(`reclamar dispositivo: ${error.message}`);
  return data?.length ?? 0;
}

/** Un solo mensaje para todos los motivos: la respuesta no cuenta si un caso existe o de quién es. */
export function respuestaDueno(): Response {
  return Response.json({ error: "Este caso no es tuyo.", codigo: "dueno" }, { status: 403 });
}

/** Sin sesión válida no se guarda nada; la app sigue en el celular. */
export function respuestaSinSesion(): Response {
  return Response.json({ error: "Falta iniciar la sesión.", codigo: "sesion" }, { status: 401 });
}
