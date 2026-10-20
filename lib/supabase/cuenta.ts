import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET_FOTOS_USUARIOS, ErrorSupabase, urlFirmadaFoto } from "./repo";

/**
 * Cuenta de la persona (docs/login.md §4 y §5), para las rutas de `app/api/cuenta`. Todo con la
 * clave secreta y siempre sobre el uid de la sesión verificada, nunca sobre uno del cuerpo.
 */

/**
 * Cookie httpOnly con el JWT de la sesión anónima mientras la persona inicia sesión con un email que
 * ya tiene cuenta (§4). Vive 15 minutos: menos que el JWT recién refrescado (1 hora).
 */
export const COOKIE_RECLAMO = "sayso-reclamo";
export const VIDA_RECLAMO_SEG = 15 * 60;

/** Casos de una sesión anónima que pasan a la cuenta con email. Devuelve cuántos pasaron. */
export async function pasarCasos(db: SupabaseClient, de: string, a: string): Promise<number> {
  const { data, error } = await db.from("casos").update({ dueno: a }).eq("dueno", de).select("id");
  if (error) throw new ErrorSupabase(`pasar casos: ${error.message}`);
  return data?.length ?? 0;
}

async function idsDeCasos(db: SupabaseClient, uid: string): Promise<string[]> {
  const { data, error } = await db.from("casos").select("id").eq("dueno", uid);
  if (error) throw new ErrorSupabase(`casos de la cuenta: ${error.message}`);
  return (data ?? []).map((c: { id: string }) => c.id);
}

/**
 * Borra la cuenta: primero los archivos de `fotos-usuarios/<casoId>/` (la cascada de Postgres no
 * toca Storage) y después el usuario de Auth, que en cascada se lleva casos, fotos, fichas, eventos
 * y guías. Si algo falla antes de borrar el usuario, lanza sin borrarlo: se puede reintentar.
 */
export async function borrarCuenta(db: SupabaseClient, uid: string): Promise<{ casos: number }> {
  const casos = await idsDeCasos(db, uid);
  const bucket = db.storage.from(BUCKET_FOTOS_USUARIOS);
  for (const casoId of casos) {
    const { data, error } = await bucket.list(casoId, { limit: 1000 });
    if (error) throw new ErrorSupabase(`listar fotos: ${error.message}`);
    const rutas = (data ?? []).map((f: { name: string }) => `${casoId}/${f.name}`);
    if (rutas.length === 0) continue;
    const borrado = await bucket.remove(rutas);
    if (borrado.error) throw new ErrorSupabase(`borrar fotos: ${borrado.error.message}`);
  }
  const { error } = await db.auth.admin.deleteUser(uid);
  if (error) throw new ErrorSupabase(`borrar usuario: ${error.message}`);
  return { casos: casos.length };
}

type Fila = Record<string, unknown> & { caso_id?: string; datos?: unknown };

async function filasDe(db: SupabaseClient, tabla: "fotos" | "fichas" | "eventos" | "guias", casos: string[]) {
  if (casos.length === 0) return [];
  const { data, error } = await db.from(tabla).select("*").in("caso_id", casos);
  if (error) throw new ErrorSupabase(`exportar ${tabla}: ${error.message}`);
  return (data ?? []) as Fila[];
}

/**
 * "Exportar mis casos": casos con su ficha, fotos (URL firmadas de 5 minutos), eventos y guía.
 * Sin las columnas internas (`dueno`, `dispositivo`).
 */
export async function exportarCuenta(db: SupabaseClient, uid: string) {
  const { data, error } = await db.from("casos").select("*").eq("dueno", uid).order("creado_en");
  if (error) throw new ErrorSupabase(`exportar casos: ${error.message}`);
  const casos = (data ?? []) as Fila[];
  const ids = casos.map((c) => String(c.id));
  const [fotos, fichas, eventos, guias] = await Promise.all(
    (["fotos", "fichas", "eventos", "guias"] as const).map((t) => filasDe(db, t, ids)),
  );
  const fotosFirmadas = await Promise.all(
    fotos.map(async (f) => {
      const datos = (f.datos ?? {}) as { url?: unknown };
      const url = typeof datos.url === "string" ? await urlFirmadaFoto(db, datos.url).catch(() => null) : null;
      return { ...f, datos: { ...datos, url } };
    }),
  );
  const de = (filas: Fila[], id: string) => filas.filter((f) => f.caso_id === id).map((f) => f.datos ?? f);
  return {
    exportadoEn: new Date().toISOString(),
    aviso: "Las URL de las fotos vencen a los 5 minutos: para bajarlas, volvé a exportar.",
    casos: casos.map((fila) => {
      const c = Object.fromEntries(Object.entries(fila).filter(([k]) => k !== "dueno" && k !== "dispositivo"));
      const id = String(c.id);
      const guia = guias.find((g) => g.caso_id === id);
      return {
        ...c,
        ficha: de(fichas, id)[0] ?? null,
        fotos: de(fotosFirmadas, id),
        eventos: de(eventos, id),
        guia: guia ? { preparado: guia.preparado, plano: guia.plano, creado_en: guia.creado_en } : null,
      };
    }),
  };
}

/** Errores de Supabase Auth → respuesta para la pantalla. Nunca se registra el email. */
export function respuestaAuth(error: { code?: string; status?: number; message: string } | null): Response {
  const r = (status: number, codigo: string, mensaje: string) => Response.json({ error: mensaje, codigo }, { status });
  switch (error?.code) {
    case "captcha_failed":
      return r(400, "captcha", "No pudimos comprobar que sos una persona. Probá de nuevo.");
    case "otp_expired":
      return r(400, "codigo", "El código no es válido o ya venció. Pedí uno nuevo.");
    case "email_address_invalid":
    case "validation_failed":
      return r(400, "email", "Revisá el email.");
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return r(429, "limite", "Mandamos muchos códigos seguidos. Esperá un rato y probá de nuevo.");
    case "anonymous_provider_disabled":
    case "email_provider_disabled":
    case "signup_disabled":
      return noDisponible();
  }
  console.error("[cuenta] Supabase Auth:", error?.code ?? error?.status ?? "sin código", error?.message);
  return r(500, "error", "No se pudo. Probá de nuevo en un rato.");
}

/** Supabase Auth sin configurar (faltan variables o el proveedor está apagado). */
export function noDisponible(): Response {
  return Response.json(
    { error: "Guardar casos con tu email todavía no está disponible.", codigo: "no_disponible" },
    { status: 503 },
  );
}
