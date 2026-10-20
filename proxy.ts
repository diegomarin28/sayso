import { NextResponse, type NextRequest } from "next/server";
import { supabaseAuth, tieneCookieDeSesion } from "./lib/supabase/sesion";

/**
 * Proxy de Next 16 (antes "middleware"): refresca la sesión de Supabase Auth y reescribe sus
 * cookies antes de las rutas que la usan (docs/login.md §3). No autoriza nada: cada ruta verifica
 * la sesión por su cuenta (`uidDeSesion`). Sin cookie de sesión no hace nada.
 */
export async function proxy(request: NextRequest) {
  if (!tieneCookieDeSesion(request.cookies.getAll().map((c) => c.name))) return NextResponse.next();
  let respuesta = NextResponse.next({ request });
  const auth = supabaseAuth({
    getAll: () => request.cookies.getAll(),
    setAll: (lista, headers) => {
      // La ruta ve las cookies nuevas en el pedido; el navegador las recibe en la respuesta.
      for (const { name, value } of lista) request.cookies.set(name, value);
      respuesta = NextResponse.next({ request });
      for (const { name, value, options } of lista) respuesta.cookies.set(name, value, options);
      for (const [clave, valor] of Object.entries(headers ?? {})) respuesta.headers.set(clave, valor);
    },
  });
  // Si Supabase falla, la ruta igual responde 401 al no poder verificar la sesión.
  if (auth) await auth.auth.getClaims().catch(() => null);
  return respuesta;
}

// Solo las rutas que leen la sesión: las páginas y los modelos 3D no pasan por acá.
export const config = { matcher: ["/api/casos/:path*", "/api/cuenta/:path*"] };
