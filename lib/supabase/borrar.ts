import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET_FOTOS_USUARIOS, ErrorSupabase } from "./repo";

/**
 * Borrado de casos y cuentas (docs/login.md §5): lo usan «Borrar cuenta» (`DELETE /api/cuenta`) y la
 * retención de 90 días (`scripts/retencion`). El orden deja todo consistente si algo falla a la mitad:
 * 1. los archivos de `fotos-usuarios/<casoId>/` (la cascada de Postgres no los toca);
 * 2. las filas de `casos` (la cascada se lleva fotos, ficha, eventos y guías);
 * 3. el usuario de Auth.
 * Si un paso falla, lanza y no sigue: lo que queda se puede volver a borrar con la misma llamada.
 */

const POR_PAGINA = 1000;
/** Ids por `in()`: que la URL del pedido no sea enorme. */
const POR_LOTE = 100;

function lotes<T>(xs: T[], n: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < xs.length; i += n) r.push(xs.slice(i, i + n));
  return r;
}

/** Rutas de los archivos de un caso en el bucket privado. */
async function archivosDeCaso(db: SupabaseClient, casoId: string): Promise<string[]> {
  const rutas: string[] = [];
  for (let offset = 0; ; offset += POR_PAGINA) {
    const { data, error } = await db.storage.from(BUCKET_FOTOS_USUARIOS).list(casoId, { limit: POR_PAGINA, offset });
    if (error) throw new ErrorSupabase(`listar fotos del caso: ${error.message}`);
    // Carpeta = id null: no hay subcarpetas en `<casoId>/`, y si apareciera una no se adivina qué es.
    for (const e of data ?? []) if (e.id !== null) rutas.push(`${casoId}/${e.name}`);
    if (!data || data.length < POR_PAGINA) return rutas;
  }
}

/** Borra los archivos de esos casos del bucket privado. Devuelve cuántos borró. */
export async function borrarArchivosDeCasos(db: SupabaseClient, casoIds: string[]): Promise<number> {
  let borrados = 0;
  for (const casoId of casoIds) {
    const rutas = await archivosDeCaso(db, casoId);
    for (const lote of lotes(rutas, POR_PAGINA)) {
      const { error } = await db.storage.from(BUCKET_FOTOS_USUARIOS).remove(lote);
      if (error) throw new ErrorSupabase(`borrar fotos del caso: ${error.message}`);
      borrados += lote.length;
    }
  }
  return borrados;
}

export type Borrado = { casos: number; archivos: number };

/** Borra esos casos: primero sus archivos, después las filas (con su cascada). */
export async function borrarCasos(db: SupabaseClient, casoIds: string[]): Promise<Borrado> {
  const archivos = await borrarArchivosDeCasos(db, casoIds);
  for (const lote of lotes(casoIds, POR_LOTE)) {
    const { error } = await db.from("casos").delete().in("id", lote);
    if (error) throw new ErrorSupabase(`borrar casos: ${error.message}`);
  }
  return { casos: casoIds.length, archivos };
}

/** Ids de los casos de ese uid. */
export async function casosDeUsuario(db: SupabaseClient, uid: string): Promise<string[]> {
  const ids: string[] = [];
  for (let desde = 0; ; desde += POR_PAGINA) {
    const { data, error } = await db
      .from("casos")
      .select("id")
      .eq("dueno", uid)
      .order("id")
      .range(desde, desde + POR_PAGINA - 1);
    if (error) throw new ErrorSupabase(`casos del usuario: ${error.message}`);
    ids.push(...(data ?? []).map((c: { id: string }) => c.id));
    if (!data || data.length < POR_PAGINA) return ids;
  }
}

/** «Borrar cuenta»: sus casos con sus archivos y, al final, el usuario de Auth. */
export async function borrarUsuario(db: SupabaseClient, uid: string): Promise<Borrado> {
  const borrado = await borrarCasos(db, await casosDeUsuario(db, uid));
  const { error } = await db.auth.admin.deleteUser(uid);
  if (error) throw new ErrorSupabase(`borrar usuario: ${error.message}`);
  return borrado;
}
