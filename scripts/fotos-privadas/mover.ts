import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET_FOTOS_USUARIOS } from "../../lib/supabase/repo";

/**
 * Mueve las fotos viejas de las personas del bucket público `fotos` (`<casoId>/<fotoId>.<ext>`) al
 * privado `fotos-usuarios` (migración 010, issue #330) y cambia `datos.url` de su fila en `fotos` por
 * la referencia privada. `manuales/` (páginas del manual, carril A) se queda en el público.
 * Sin `aplicar` solo arma la lista: no mueve ni cambia nada.
 */

export const BUCKET_PUBLICO = "fotos";
/** Carpeta del bucket público que NO es de personas (lib/knowledge/imagen.ts). */
export const CARPETA_MANUALES = "manuales";
const POR_PAGINA = 1000;

type Entrada = { name: string; id: string | null };

async function listarTodo(db: SupabaseClient, carpeta: string): Promise<Entrada[]> {
  const todo: Entrada[] = [];
  for (let offset = 0; ; offset += POR_PAGINA) {
    const { data, error } = await db.storage
      .from(BUCKET_PUBLICO)
      .list(carpeta, { limit: POR_PAGINA, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`listar ${carpeta || "/"}: ${error.message}`);
    todo.push(...(data ?? []));
    if (!data || data.length < POR_PAGINA) return todo;
  }
}

/** Rutas de fotos de personas en el bucket público (todo lo que no está en `manuales/`). */
export async function fotosDePersonas(db: SupabaseClient): Promise<string[]> {
  const rutas: string[] = [];
  for (const e of await listarTodo(db, "")) {
    // Carpeta = id null. Un archivo suelto en la raíz no tiene la forma <casoId>/<fotoId>: no se toca.
    if (e.id !== null || e.name === CARPETA_MANUALES) continue;
    for (const f of await listarTodo(db, e.name)) {
      if (f.id !== null) rutas.push(`${e.name}/${f.name}`);
    }
  }
  return rutas;
}

/** `<casoId>/<fotoId>.<ext>` → id de la fila en la tabla `fotos`. */
export function fotoIdDeRuta(ruta: string): string {
  const archivo = ruta.slice(ruta.lastIndexOf("/") + 1);
  const punto = archivo.lastIndexOf(".");
  return punto > 0 ? archivo.slice(0, punto) : archivo;
}

export type ResultadoMover = { ruta: string; estado: "pendiente" | "movida" | "error"; fila?: "actualizada" | "sin fila" | "ya estaba"; error?: string };

export async function moverFotos(db: SupabaseClient, rutas: string[], aplicar: boolean): Promise<ResultadoMover[]> {
  const resultados: ResultadoMover[] = [];
  for (const ruta of rutas) {
    if (!aplicar) {
      resultados.push({ ruta, estado: "pendiente" });
      continue;
    }
    const movida = await db.storage.from(BUCKET_PUBLICO).move(ruta, ruta, { destinationBucket: BUCKET_FOTOS_USUARIOS });
    if (movida.error) {
      resultados.push({ ruta, estado: "error", error: movida.error.message });
      continue;
    }
    try {
      resultados.push({ ruta, estado: "movida", fila: await actualizarFila(db, ruta) });
    } catch (e) {
      resultados.push({ ruta, estado: "error", error: `movida, pero la fila no: ${e instanceof Error ? e.message : e}` });
    }
  }
  return resultados;
}

async function actualizarFila(db: SupabaseClient, ruta: string): Promise<"actualizada" | "sin fila" | "ya estaba"> {
  const id = fotoIdDeRuta(ruta);
  const referencia = `${BUCKET_FOTOS_USUARIOS}/${ruta}`;
  const { data, error } = await db.from("fotos").select("datos").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return "sin fila";
  const datos = (data.datos ?? {}) as Record<string, unknown>;
  if (datos.url === referencia) return "ya estaba";
  const { error: e } = await db.from("fotos").update({ datos: { ...datos, url: referencia } }).eq("id", id);
  if (e) throw new Error(e.message);
  return "actualizada";
}
