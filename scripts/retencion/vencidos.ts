import type { SupabaseClient, User } from "@supabase/supabase-js";
import { borrarCasos, borrarUsuario } from "../../lib/supabase/borrar";

/**
 * Retención de 90 días (docs/login.md §5, issue #347):
 * - las sesiones anónimas sin actividad en 90 días se borran con sus casos y fotos;
 * - los casos huérfanos (sin `dueno` ni `dispositivo`) de más de 90 días, con sus fotos.
 * Las cuentas con email nunca se borran. Actividad = `last_sign_in_at` del usuario (o su alta, si
 * nunca inició sesión) y `actualizado_en` de sus casos.
 * Sin `aplicar` solo cuenta: no borra nada. Nunca devuelve emails ni contenido de los casos.
 */

export const DIAS = 90;
const POR_PAGINA = 1000;

export function limiteDe(ahora: Date, dias = DIAS): string {
  return new Date(ahora.getTime() - dias * 86_400_000).toISOString();
}

/** Anónima de verdad: Supabase la marca así y no tiene email (si lo tiene, nunca se borra). */
function esAnonima(u: User): boolean {
  return u.is_anonymous === true && !u.email;
}

/** Vencida si su último ingreso (o su alta) es anterior al límite. Una fecha ilegible no vence. */
function ingresoVencido(u: User, limite: string): boolean {
  const t = Date.parse(u.last_sign_in_at ?? u.created_at);
  return Number.isFinite(t) && t < Date.parse(limite);
}

async function anonimas(db: SupabaseClient): Promise<User[]> {
  const todas: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: POR_PAGINA });
    if (error) throw new Error(`listar usuarios: ${error.message}`);
    const users = data?.users ?? [];
    todas.push(...users.filter(esAnonima));
    if (users.length < POR_PAGINA) return todas;
  }
}

/** Dueños con algún caso tocado desde el límite. */
async function duenosActivos(db: SupabaseClient, limite: string): Promise<Set<string>> {
  const activos = new Set<string>();
  for (let desde = 0; ; desde += POR_PAGINA) {
    const { data, error } = await db
      .from("casos")
      .select("id, dueno")
      .not("dueno", "is", null)
      .gte("actualizado_en", limite)
      .order("id")
      .range(desde, desde + POR_PAGINA - 1);
    if (error) throw new Error(`casos recientes: ${error.message}`);
    for (const c of (data ?? []) as { dueno: string }[]) activos.add(c.dueno);
    if (!data || data.length < POR_PAGINA) return activos;
  }
}

async function huerfanos(db: SupabaseClient, limite: string): Promise<string[]> {
  const ids: string[] = [];
  for (let desde = 0; ; desde += POR_PAGINA) {
    const { data, error } = await db
      .from("casos")
      .select("id")
      .is("dueno", null)
      .is("dispositivo", null)
      .lt("actualizado_en", limite)
      .order("id")
      .range(desde, desde + POR_PAGINA - 1);
    if (error) throw new Error(`casos huérfanos: ${error.message}`);
    ids.push(...(data ?? []).map((c: { id: string }) => c.id));
    if (!data || data.length < POR_PAGINA) return ids;
  }
}

/**
 * Justo antes de borrar se vuelve a mirar el usuario: entre la lista y el borrado pudo haber guardado
 * sus casos con un email o vuelto a usar la app.
 */
async function sigueVencida(db: SupabaseClient, uid: string, limite: string): Promise<boolean> {
  const { data, error } = await db.auth.admin.getUserById(uid);
  if (error) throw new Error(`releer usuario: ${error.message}`);
  if (!data?.user || !esAnonima(data.user) || !ingresoVencido(data.user, limite)) return false;
  const reciente = await db.from("casos").select("id").eq("dueno", uid).gte("actualizado_en", limite).limit(1);
  if (reciente.error) throw new Error(`releer casos: ${reciente.error.message}`);
  return (reciente.data ?? []).length === 0;
}

export type Resumen = {
  aplicado: boolean;
  sesiones: number;
  casosDeSesiones: number;
  casosHuerfanos: number;
  /** Solo con `aplicar`: archivos de `fotos-usuarios` borrados. */
  archivos: number;
  /** Sesiones que volvieron a estar activas entre la lista y el borrado. */
  salteadas: number;
  errores: string[];
};

export async function retencion(db: SupabaseClient, { aplicar, ahora = new Date() }: { aplicar: boolean; ahora?: Date }): Promise<Resumen> {
  const limite = limiteDe(ahora);
  const activos = await duenosActivos(db, limite);
  const vencidas = (await anonimas(db)).filter((u) => ingresoVencido(u, limite) && !activos.has(u.id));
  const sinDueno = await huerfanos(db, limite);
  const r: Resumen = { aplicado: aplicar, sesiones: vencidas.length, casosDeSesiones: 0, casosHuerfanos: sinDueno.length, archivos: 0, salteadas: 0, errores: [] };

  if (!aplicar) {
    // Sin `aplicar` solo se cuentan sus casos: nada de borrar.
    for (const u of vencidas) {
      const { count, error } = await db.from("casos").select("id", { count: "exact", head: true }).eq("dueno", u.id);
      if (error) throw new Error(`contar casos: ${error.message}`);
      r.casosDeSesiones += count ?? 0;
    }
    return r;
  }

  r.sesiones = 0;
  for (const u of vencidas) {
    try {
      if (!(await sigueVencida(db, u.id, limite))) {
        r.salteadas++;
        continue;
      }
      const b = await borrarUsuario(db, u.id);
      r.sesiones++;
      r.casosDeSesiones += b.casos;
      r.archivos += b.archivos;
    } catch (e) {
      r.errores.push(e instanceof Error ? e.message : String(e));
    }
  }
  try {
    r.archivos += (await borrarCasos(db, sinDueno)).archivos;
  } catch (e) {
    r.casosHuerfanos = 0;
    r.errores.push(e instanceof Error ? e.message : String(e));
  }
  return r;
}
