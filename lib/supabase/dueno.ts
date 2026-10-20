import type { SupabaseClient } from "@supabase/supabase-js";
import type { Caso, Evento, Ficha, Foto } from "../../shared";
import { ErrorSupabase } from "./repo";

/**
 * Dueño de cada caso en POST /api/casos (#331). Sin login, el dueño es el `dispositivo`: un UUID al
 * azar que vive solo en el celular (desde la migración 009 nadie lo lee desde afuera). Con el login
 * se cambia por `auth.uid()`.
 * - Un caso que no existe solo se crea con el caso en el mismo pedido, y queda de ese dispositivo.
 * - Un caso que ya existe solo lo escribe su dispositivo; los viejos sin dispositivo (antes de la 007)
 *   no los escribe nadie.
 * - Una foto o un evento que ya existe no se reescribe desde otro caso.
 * Al revés que los topes, si la consulta falla no deja seguir: lanza y la ruta responde 500.
 */

export type MotivoDueno = "sin_dispositivo" | "caso_ajeno" | "caso_inexistente" | "id_ajeno";

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
  dispositivo: string | undefined,
  { caso, fotos, ficha, eventos }: Pedido,
): Promise<MotivoDueno | null> {
  const casoIds = new Set([
    ...(caso ? [caso.id] : []),
    ...fotos.map((f) => f.casoId),
    ...(ficha ? [ficha.casoId] : []),
    ...eventos.map((e) => e.casoId),
  ]);
  if (casoIds.size === 0) return null;
  if (!dispositivo) return "sin_dispositivo";

  const { data, error } = await db.from("casos").select("id, dispositivo").in("id", [...casoIds]);
  if (error) throw new ErrorSupabase(`dueño (casos): ${error.message}`);
  const duenos = new Map((data ?? []).map((c: { id: string; dispositivo: string | null }) => [c.id, c.dispositivo]));
  for (const id of casoIds) {
    if (!duenos.has(id)) {
      if (id !== caso?.id) return "caso_inexistente";
    } else if (duenos.get(id) !== dispositivo) {
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

/** Un solo mensaje para todos los motivos: la respuesta no cuenta si un caso existe o de quién es. */
export function respuestaDueno(): Response {
  return Response.json({ error: "Este caso no es de este dispositivo.", codigo: "dueno" }, { status: 403 });
}
