import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Clientes de Supabase. Si faltan las variables, devuelven null y la app sigue
 * andando sin guardar (el flujo vive en el navegador): Supabase nunca frena la demo.
 */

let servidor: SupabaseClient | null | undefined;
let navegador: SupabaseClient | null | undefined;

/** Solo en el servidor (rutas de API): usa la clave secreta y saltea RLS. */
export function supabaseServidor(): SupabaseClient | null {
  if (typeof window !== "undefined") throw new Error("supabaseServidor() solo se usa en el servidor");
  if (servidor === undefined) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    servidor = url && clave ? createClient(url, clave, { auth: { persistSession: false } }) : null;
  }
  return servidor;
}

/** En el navegador: clave pública, solo puede leer eventos (feed en vivo). */
export function supabaseNavegador(): SupabaseClient | null {
  if (navegador === undefined) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    navegador = url && clave ? createClient(url, clave) : null;
  }
  return navegador;
}
