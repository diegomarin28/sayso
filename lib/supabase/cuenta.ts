import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET_FOTOS_USUARIOS, ErrorSupabase, urlFirmadaFoto } from "./repo";
import type { Sesion } from "./sesion";

/**
 * Cuenta de la persona (docs/login.md §4 y §5), para las rutas de `app/api/cuenta`. Todo con la
 * clave secreta y siempre sobre el uid de la sesión verificada, nunca sobre uno del cuerpo.
 */

/** Casos de una sesión anónima que pasan a la cuenta con email. Devuelve cuántos pasaron. */
export async function pasarCasos(db: SupabaseClient, de: string, a: string): Promise<number> {
  const { data, error } = await db.from("casos").update({ dueno: a }).eq("dueno", de).select("id");
  if (error) throw new ErrorSupabase(`pasar casos: ${error.message}`);
  return data?.length ?? 0;
}

/**
 * Reclamo desde otra cuenta (docs/login.md §4): al entrar a una cuenta que ya existía, los casos de
 * la sesión anónima de antes (verificada en el mismo pedido, antes de cambiar de sesión) pasan a la
 * cuenta, y ese usuario anónimo, ya vacío, se borra. Nunca reclama de una sesión con email: lo
 * confirma con Auth, porque el JWT puede ser de antes de que esa sesión sumara un email.
 * Si algo falla no frena el inicio de sesión: los casos quedan donde estaban y se registra.
 */
export async function reclamarAnonima(db: SupabaseClient, viejo: Sesion | null, nuevo: string): Promise<number> {
  if (!viejo?.anonima || viejo.uid === nuevo) return 0;
  try {
    const { data, error } = await db.auth.admin.getUserById(viejo.uid);
    if (error || !data.user?.is_anonymous) return 0;
    const reclamados = await pasarCasos(db, viejo.uid, nuevo);
    const borrado = await db.auth.admin.deleteUser(viejo.uid);
    if (borrado.error) console.warn("[cuenta] no pude borrar la sesión anónima reclamada:", borrado.error.message);
    return reclamados;
  } catch (e) {
    console.error("[cuenta] reclamar:", e instanceof ErrorSupabase ? e.message : e);
    return 0;
  }
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
 * "Exportar mis casos": la cuenta (email, nombre y apellido) y los casos con su ficha, fotos (URL firmadas de 5 minutos), eventos y guía.
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
  const usuario = await db.auth.admin.getUserById(uid).catch(() => null);
  const u = usuario?.data?.user;
  const meta = (u?.user_metadata ?? {}) as { nombre?: unknown; apellido?: unknown };
  return {
    exportadoEn: new Date().toISOString(),
    cuenta: {
      email: u?.email ?? null,
      nombre: typeof meta.nombre === "string" ? meta.nombre : null,
      apellido: typeof meta.apellido === "string" ? meta.apellido : null,
    },
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
    case "invalid_credentials":
      return r(400, "credenciales", "El email o la contraseña no son correctos.");
    case "weak_password":
      return r(400, "contrasena", "La contraseña tiene que tener 8 o más caracteres, con letras y números.");
    case "email_exists":
    case "user_already_exists":
      return r(409, "existe", "Ese email ya tiene cuenta. Iniciá sesión.");
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
