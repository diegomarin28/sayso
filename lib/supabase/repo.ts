import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Caso, Evento, Ficha, Foto } from "../../shared";

/**
 * Guardado y lectura de casos. Todo lo que entra o sale pasa por los esquemas de shared/.
 * Cada función recibe el cliente (null = Supabase no configurado: no guarda nada).
 */

export class ErrorSupabase extends Error {}

const BUCKET_FOTOS = "fotos";

function revisar(error: { message: string } | null, que: string) {
  if (error) throw new ErrorSupabase(`${que}: ${error.message}`);
}

export async function guardarCaso(db: SupabaseClient | null, caso: Caso): Promise<void> {
  if (!db) return;
  const c = Caso.parse(caso);
  const { error } = await db.from("casos").upsert({
    id: c.id,
    clase: c.clase,
    sintoma: c.sintoma,
    estado: c.estado,
    creado_en: c.creadoEn,
    datos: c,
  });
  revisar(error, "guardar caso");
}

/** Sube la imagen al bucket `fotos` y devuelve su URL pública. */
export async function subirImagen(
  db: SupabaseClient | null,
  casoId: string,
  fotoId: string,
  base64: string,
  mediaType: string,
): Promise<string | null> {
  if (!db) return null;
  const extension = mediaType.split("/")[1] ?? "jpg";
  const ruta = `${casoId}/${fotoId}.${extension}`;
  const { error } = await db.storage
    .from(BUCKET_FOTOS)
    .upload(ruta, Buffer.from(base64, "base64"), { contentType: mediaType, upsert: true });
  revisar(error, "subir foto");
  return db.storage.from(BUCKET_FOTOS).getPublicUrl(ruta).data.publicUrl;
}

export async function guardarFoto(db: SupabaseClient | null, foto: Foto): Promise<void> {
  if (!db) return;
  const f = Foto.parse(foto);
  const { error } = await db.from("fotos").upsert({
    id: f.id,
    caso_id: f.casoId,
    tipo_pedido: f.tipoPedido,
    aceptada: f.aceptada,
    datos: f,
  });
  revisar(error, "guardar foto");
}

export async function guardarFicha(db: SupabaseClient | null, ficha: Ficha): Promise<void> {
  if (!db) return;
  const f = Ficha.parse(ficha);
  const { error } = await db.from("fichas").upsert({
    caso_id: f.casoId,
    confirmada: f.confirmadaPorUsuario,
    actualizado_en: new Date().toISOString(),
    datos: f,
  });
  revisar(error, "guardar ficha");
}

export async function guardarEventos(db: SupabaseClient | null, eventos: Evento[]): Promise<void> {
  if (!db || eventos.length === 0) return;
  const filas = z
    .array(Evento)
    .parse(eventos)
    .map((e) => ({
      id: e.id,
      caso_id: e.casoId,
      agente: e.agente,
      tipo: e.tipo,
      mensaje: e.mensaje,
      ts: e.ts,
      datos: e.datos ?? null,
    }));
  const { error } = await db.from("eventos").upsert(filas);
  revisar(error, "guardar eventos");
}

/** Convierte una fila de `eventos` al contrato `Evento`; descarta las que no validan. */
export function filaAEvento(fila: Record<string, unknown>): Evento | null {
  const r = Evento.safeParse({
    id: fila.id,
    casoId: fila.caso_id,
    agente: fila.agente,
    tipo: fila.tipo,
    mensaje: fila.mensaje,
    ts: typeof fila.ts === "string" ? new Date(fila.ts).toISOString() : fila.ts,
    ...(fila.datos ? { datos: fila.datos } : {}),
  });
  return r.success ? r.data : null;
}

export async function listarEventos(db: SupabaseClient | null, casoId: string): Promise<Evento[]> {
  if (!db) return [];
  const { data, error } = await db.from("eventos").select("*").eq("caso_id", casoId).order("ts");
  revisar(error, "listar eventos");
  return (data ?? []).map(filaAEvento).filter((e): e is Evento => e !== null);
}

/**
 * Caché del knowledge pack en la tabla `knowledge_packs`. Cumple la interfaz `CachePacks`
 * de lib/knowledge/armar.ts (carril A): se pasa como `deps.cache`. El contenido lo valida
 * quien lo arma; acá solo se guarda y se devuelve.
 */
export function cachePacksSupabase<T>(db: SupabaseClient | null) {
  return {
    async get(clave: string): Promise<T | undefined> {
      if (!db) return undefined;
      const { data, error } = await db
        .from("knowledge_packs")
        .select("armado")
        .eq("clave", clave)
        .maybeSingle();
      if (error) {
        console.error("[supabase] leer caché", error.message);
        return undefined;
      }
      return (data?.armado as T | undefined) ?? undefined;
    },
    async set(clave: string, valor: T): Promise<void> {
      if (!db) return;
      const { error } = await db.from("knowledge_packs").upsert({ clave, armado: valor });
      if (error) console.error("[supabase] guardar caché", error.message);
    },
  };
}
