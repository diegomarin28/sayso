import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Caso, Evento, Ficha, Foto } from "../../shared";
import { Guia } from "./guia";

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
  /** Id anónimo del dispositivo de antes del login: solo sirve para reclamar sus casos (dueno.ts). */
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

/** Postgres 42703 / PostgREST PGRST204: la columna no existe (falta correr una migración). */
function esColumnaFaltante(error: { message: string; code?: string }) {
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /column .* (does not exist|not find)/i.test(error.message)
  );
}

/** `dueno`: uid de la sesión verificada (migración 012); lo revisó antes dueno.ts. */
export async function guardarCaso(
  db: SupabaseClient | null,
  caso: Caso,
  extra: Omit<ExtraCaso, "dispositivo"> = {},
  dueno?: string,
): Promise<void> {
  if (!db) return;
  const c = Caso.parse(caso);
  const e = ExtraCaso.omit({ dispositivo: true }).parse(extra);
  const base = {
    id: c.id,
    ...(dueno ? { dueno } : {}),
    clase: c.clase,
    sintoma: c.sintoma,
    estado: c.estado,
    creado_en: c.creadoEn,
    datos: c,
  };
  // Solo se escriben las columnas que vinieron (un upsert sin ellas no las borra).
  const extras = {
    actualizado_en: new Date().toISOString(),
    ...(e.tipoEquipo !== undefined ? { tipo_equipo: e.tipoEquipo } : {}),
    ...(e.cierre ? { cierre: e.cierre } : {}),
  };
  let { error } = await db.from("casos").upsert({ ...base, ...extras });
  if (error && esColumnaFaltante(error)) {
    // Sin la migración 007 todavía: se guarda el caso igual, sin los datos de "Mis casos".
    console.warn("[supabase] falta la migración 007_mis_casos: guardo el caso sin tipo de equipo ni cierre");
    ({ error } = await db.from("casos").upsert(base));
  }
  revisar(error, "guardar caso");
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

// ---------- Guías y lectura de casos por dueño (docs/login.md §6) ----------

/** Lo que manda el flujo para la tabla `guias`: el caso y lo que vio la persona. */
export const GuiaDeCaso = Guia.extend({ casoId: z.string() });
export type GuiaDeCaso = z.infer<typeof GuiaDeCaso>;

/**
 * Escribe la guía del caso una sola vez: si ya hay una, no la pisa (`on conflict do nothing`), así
 * retomar muestra lo que la persona vio aunque los cachés de `planos` o `knowledge_packs` cambien.
 */
export async function guardarGuia(db: SupabaseClient | null, guia: GuiaDeCaso): Promise<void> {
  if (!db) return;
  const g = GuiaDeCaso.parse(guia);
  const { error } = await db
    .from("guias")
    .upsert({ caso_id: g.casoId, preparado: g.preparado, plano: g.plano }, { onConflict: "caso_id", ignoreDuplicates: true });
  revisar(error, "guardar guía");
}

/** Un caso de la lista de su dueño, sin la guía (solo si tiene una). */
export type ResumenCaso = {
  caso: Caso;
  tipoEquipo: string | null;
  ficha: Ficha | null;
  cierre: NonNullable<ExtraCaso["cierre"]> | null;
  tieneGuia: boolean;
  actualizadoEn: string;
};

/** La foto con `url` firmada por 5 minutos, o null si no tiene imagen en el bucket privado. */
export type FotoFirmada = Omit<Foto, "url"> & { url: string | null };

export type CasoCompleto = Omit<ResumenCaso, "tieneGuia"> & { fotos: FotoFirmada[]; guia: Guia | null };

const COLUMNAS_CASO = "id, datos, tipo_equipo, cierre, actualizado_en";
type FilaCaso = { id: string; datos: unknown; tipo_equipo: string | null; cierre: unknown; actualizado_en: string | null };

const iso = (ts: unknown) => (typeof ts === "string" ? new Date(ts).toISOString() : null);

/** null si `datos` no valida (una fila vieja o rota no rompe la lista). */
function filaAResumen(fila: FilaCaso, ficha: unknown, tieneGuia: boolean): ResumenCaso | null {
  const caso = Caso.safeParse(fila.datos);
  if (!caso.success) return null;
  const cierre = ExtraCaso.shape.cierre.safeParse(fila.cierre ?? undefined);
  const f = ficha ? Ficha.safeParse(ficha) : null;
  return {
    caso: caso.data,
    tipoEquipo: fila.tipo_equipo ?? null,
    ficha: f?.success ? f.data : null,
    cierre: (cierre.success && cierre.data) || null,
    tieneGuia,
    actualizadoEn: iso(fila.actualizado_en) ?? caso.data.creadoEn,
  };
}

/** Los casos de ese dueño, el actualizado más reciente primero. No lee las guías, solo si existen. */
export async function listarCasosDeDueno(db: SupabaseClient | null, dueno: string, max = 50): Promise<ResumenCaso[]> {
  if (!db) return [];
  const { data, error } = await db
    .from("casos")
    .select(COLUMNAS_CASO)
    .eq("dueno", dueno)
    .order("actualizado_en", { ascending: false, nullsFirst: false })
    .limit(max);
  revisar(error, "listar casos");
  const filas = (data ?? []) as FilaCaso[];
  if (filas.length === 0) return [];
  const ids = filas.map((f) => f.id);
  const [fichas, guias] = await Promise.all([
    db.from("fichas").select("caso_id, datos").in("caso_id", ids),
    db.from("guias").select("caso_id").in("caso_id", ids),
  ]);
  revisar(fichas.error, "listar fichas");
  revisar(guias.error, "listar guías");
  const fichaDe = new Map((fichas.data ?? []).map((f: { caso_id: string; datos: unknown }) => [f.caso_id, f.datos]));
  const conGuia = new Set((guias.data ?? []).map((g: { caso_id: string }) => g.caso_id));
  return filas.flatMap((f) => filaAResumen(f, fichaDe.get(f.id), conGuia.has(f.id)) ?? []);
}

/**
 * El caso con su ficha, sus fotos firmadas y su guía, solo si es de ese dueño: null tanto si no
 * existe como si es de otro, para que la ruta responda lo mismo. No llama a la IA ni regenera nada.
 */
export async function leerCasoDeDueno(db: SupabaseClient | null, dueno: string, id: string): Promise<CasoCompleto | null> {
  if (!db) return null;
  const { data, error } = await db.from("casos").select(COLUMNAS_CASO).eq("id", id).eq("dueno", dueno).maybeSingle();
  revisar(error, "leer caso");
  if (!data) return null;
  const [ficha, fotos, guia] = await Promise.all([
    db.from("fichas").select("datos").eq("caso_id", id).maybeSingle(),
    db.from("fotos").select("datos").eq("caso_id", id),
    db.from("guias").select("preparado, plano").eq("caso_id", id).maybeSingle(),
  ]);
  revisar(ficha.error, "leer ficha");
  revisar(fotos.error, "leer fotos");
  revisar(guia.error, "leer guía");
  const resumen = filaAResumen(data as FilaCaso, ficha.data?.datos, false);
  if (!resumen) return null;
  const { caso, tipoEquipo, ficha: f, cierre, actualizadoEn } = resumen;

  const validas = (fotos.data ?? []).flatMap((f: { datos: unknown }) => {
    const r = Foto.safeParse(f.datos);
    return r.success ? [r.data] : [];
  });
  // Nunca la URL guardada: solo una firmada del bucket privado, o null (foto sin imagen o vieja).
  const firmadas = await Promise.all(
    validas.map(async (f): Promise<FotoFirmada> => {
      const url = await urlFirmadaFoto(db, f.url).catch((e: Error) => {
        console.warn("[supabase] no pude firmar la foto", f.id, e.message);
        return null;
      });
      return { ...f, url };
    }),
  );
  const g = guia.data ? Guia.safeParse(guia.data) : null;
  if (g && !g.success) console.warn("[supabase] la guía guardada no valida", id, g.error.issues[0]);
  return { caso, tipoEquipo, ficha: f, cierre, actualizadoEn, fotos: firmadas, guia: g?.success ? g.data : null };
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
