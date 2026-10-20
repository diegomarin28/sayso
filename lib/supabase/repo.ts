import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Caso, Evento, Ficha, Foto } from "../../shared";

/**
 * Guardado y lectura de casos. Todo lo que entra o sale pasa por los esquemas de shared/.
 * Cada función recibe el cliente (null = Supabase no configurado: no guarda nada).
 */

export class ErrorSupabase extends Error {}

/** Público: solo páginas del manual (lib/knowledge/imagen.ts, en `manuales/`). */
const BUCKET_FOTOS = "fotos";
/** Privado (migración 010): fotos de las personas. Solo el servidor lo lee. */
export const BUCKET_FOTOS_USUARIOS = "fotos-usuarios";

function revisar(error: { message: string } | null, que: string) {
  if (error) throw new ErrorSupabase(`${que}: ${error.message}`);
}

/** Datos de "Mis casos" que viajan con el caso (columnas de la migración 007). */
export const ExtraCaso = z.object({
  /** Id anónimo del dispositivo: agrupa los casos sin login ni datos personales. */
  dispositivo: z.string().uuid().optional(),
  tipoEquipo: z.string().max(60).nullable().optional(),
  cierre: z
    .object({
      estado: z.enum(["resuelto", "esperando_repuesto", "derivado"]),
      pieza: z.string().max(80).optional(),
      compraUrl: z.string().url().max(500).optional(),
      ts: z.string(),
    })
    .optional(),
});
export type ExtraCaso = z.infer<typeof ExtraCaso>;

/**
 * Guarda el caso solo si es de `dispositivo` (#331): si es nuevo lo crea con ese dueño, y si ya
 * existe lo actualiza solo cuando el dueño coincide. Los casos sin dueño (antes de la 007) no se
 * tocan. Devuelve false si el caso es de otro (no escribe nada).
 */
export async function guardarCaso(
  db: SupabaseClient | null,
  caso: Caso,
  extra: ExtraCaso & { dispositivo: string },
): Promise<boolean> {
  if (!db) return false;
  const c = Caso.parse(caso);
  const e = ExtraCaso.required({ dispositivo: true }).parse(extra);
  // Solo se escriben las columnas que vinieron (un update sin ellas no las borra).
  const fila = {
    id: c.id,
    clase: c.clase,
    sintoma: c.sintoma,
    estado: c.estado,
    creado_en: c.creadoEn,
    datos: c,
    dispositivo: e.dispositivo,
    actualizado_en: new Date().toISOString(),
    ...(e.tipoEquipo !== undefined ? { tipo_equipo: e.tipoEquipo } : {}),
    ...(e.cierre ? { cierre: e.cierre } : {}),
  };
  // Nuevo: se crea con este dueño. Si ya existe, no se toca (on conflict do nothing).
  const { error } = await db.from("casos").upsert(fila, { onConflict: "id", ignoreDuplicates: true });
  revisar(error, "guardar caso");
  // Existente: se actualiza solo si es de este dispositivo. En una sola sentencia, así dos pedidos a la vez no se pisan.
  const { data, error: errorUpdate } = await db
    .from("casos")
    .update(fila)
    .eq("id", c.id)
    .eq("dispositivo", e.dispositivo)
    .select("id");
  revisar(errorUpdate, "guardar caso");
  return (data ?? []).length > 0;
}

/** Sube la imagen al bucket público `fotos` y devuelve su URL. Solo para páginas del manual, nunca fotos de personas. */
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

/** Supabase responde así cuando el bucket no existe (falta correr una migración). */
function esBucketFaltante(error: { message: string; statusCode?: string | number }) {
  return String(error.statusCode) === "404" || /bucket not found/i.test(error.message);
}

/**
 * Sube la foto de una persona al bucket privado `fotos-usuarios` y devuelve su referencia
 * (`fotos-usuarios/<casoId>/<fotoId>.<ext>`), nunca una URL pública: para verla, `urlFirmadaFoto`.
 * Sin la migración 010 todavía, no sube nada y devuelve null (Supabase no frena la app).
 */
export async function subirFotoUsuario(
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
    .from(BUCKET_FOTOS_USUARIOS)
    .upload(ruta, Buffer.from(base64, "base64"), { contentType: mediaType, upsert: true });
  if (error && esBucketFaltante(error)) {
    console.warn("[supabase] falta la migración 010_fotos_privadas: guardo la foto sin imagen");
    return null;
  }
  revisar(error, "subir foto");
  return `${BUCKET_FOTOS_USUARIOS}/${ruta}`;
}

/** URL firmada de vencimiento corto para una referencia de `subirFotoUsuario` (null si no es una). */
export async function urlFirmadaFoto(
  db: SupabaseClient | null,
  referencia: string,
  segundos = 300,
): Promise<string | null> {
  const prefijo = `${BUCKET_FOTOS_USUARIOS}/`;
  if (!db || !referencia.startsWith(prefijo)) return null;
  const { data, error } = await db.storage
    .from(BUCKET_FOTOS_USUARIOS)
    .createSignedUrl(referencia.slice(prefijo.length), segundos);
  revisar(error, "firmar foto");
  return data?.signedUrl ?? null;
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
