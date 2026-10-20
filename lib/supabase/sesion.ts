import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Sesión de Supabase Auth en el servidor (docs/login.md §3). La sesión vive en cookies httpOnly:
 * el navegador nunca ve el token y no habla con Supabase; iniciar sesión pasa por las rutas de API
 * (`app/api/cuenta`). El proxy (`proxy.ts`) la refresca antes de cada ruta que la usa.
 * Usa la clave pública (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) solo para Auth: las tablas siguen con
 * `supabaseServidor()`. Sin variables devuelve null, como cliente.ts.
 */

/** httpOnly: el JavaScript de la página no puede leer ni robar la sesión. */
export const OPCIONES_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

/** Las cookies de Supabase Auth empiezan así (`sb-<proyecto>-auth-token`, partida en `.0`, `.1`…). */
export const tieneCookieDeSesion = (nombres: string[]) => nombres.some((n) => n.startsWith("sb-"));

/** Cliente de Auth sobre unas cookies. Uno nuevo por pedido, nunca compartido. */
export function supabaseAuth(cookiesDelPedido: CookieMethodsServer): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !/^https?:\/\/\S+$/.test(url) || !clave) return null;
  return createServerClient(url, clave, { cookies: cookiesDelPedido, cookieOptions: OPCIONES_COOKIE });
}

/** Cliente de Auth sobre las cookies del pedido (solo en rutas de API): lo que escribe va a la respuesta. */
export async function authDelPedido() {
  const almacen = await cookies();
  const auth = supabaseAuth({
    getAll: () => almacen.getAll(),
    setAll: (lista) => {
      for (const { name, value, options } of lista) almacen.set(name, value, options);
    },
  });
  return auth ? { auth, almacen } : null;
}

export type Sesion = { uid: string; anonima: boolean; email: string | null };

/**
 * La sesión verificada (`getClaims()` valida la firma del JWT), o null sin sesión válida.
 * Nunca `getSession()` sin verificar ni un campo del cuerpo. Solo en rutas de API.
 */
export async function sesionVerificada(auth: SupabaseClient, jwt?: string): Promise<Sesion | null> {
  const { data, error } = await auth.auth.getClaims(jwt);
  const c = data?.claims;
  if (error || !c?.sub) return null;
  return { uid: c.sub, anonima: c.is_anonymous === true, email: c.email || null };
}

/** uid de la sesión verificada del pedido, o null. */
export async function uidDeSesion(): Promise<string | null> {
  const almacen = await cookies();
  if (!tieneCookieDeSesion(almacen.getAll().map((c) => c.name))) return null;
  const pedido = await authDelPedido();
  if (!pedido) return null;
  return (await sesionVerificada(pedido.auth))?.uid ?? null;
}

type Almacen = Awaited<ReturnType<typeof cookies>>;

/** Borra las cookies de la sesión (después de borrar la cuenta, cuando `signOut` ya no puede). */
export function borrarCookiesDeSesion(almacen: Almacen, otras: string[] = []) {
  for (const { name } of almacen.getAll()) {
    if (name.startsWith("sb-") || otras.includes(name)) almacen.delete(name);
  }
}
