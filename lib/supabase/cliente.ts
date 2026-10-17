import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Clientes de Supabase. Si faltan las variables, devuelven null y la app sigue
 * andando sin guardar (el flujo vive en el navegador): Supabase nunca frena la demo.
 */

// Solo se recuerda el cliente ya creado: si faltaban variables, se vuelve a mirar en la próxima llamada.
let servidor: SupabaseClient | null = null;
let navegador: SupabaseClient | null = null;

/** Solo en el servidor (rutas de API): usa la clave secreta y saltea RLS. */
export function supabaseServidor(): SupabaseClient | null {
  if (typeof window !== "undefined") throw new Error("supabaseServidor() solo se usa en el servidor");
  if (!servidor) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    servidor = urlValida(url) && clave ? createClient(url, clave, { auth: { persistSession: false } }) : null;
  }
  return servidor;
}

/** En el navegador: clave pública, solo puede leer eventos (feed en vivo). */
export function supabaseNavegador(): SupabaseClient | null {
  if (!navegador) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    navegador = urlValida(url) && clave ? createClient(url, clave) : null;
  }
  return navegador;
}

/** Una URL mal cargada (ej. solo el código del proyecto) no debe romper la app. */
function urlValida(url: string | undefined): url is string {
  if (!url) return false;
  if (/^https?:\/\/\S+$/.test(url)) return true;
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL no es una URL (https://<proyecto>.supabase.co); no se guarda nada.",
  );
  return false;
}
