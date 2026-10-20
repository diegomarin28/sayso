import { supabaseServidor } from "../../../../lib/supabase/cliente";
import { COOKIE_RECLAMO, noDisponible, pasarCasos } from "../../../../lib/supabase/cuenta";
import { respuestaSinSesion } from "../../../../lib/supabase/dueno";
import { ErrorSupabase } from "../../../../lib/supabase/repo";
import { authDelPedido, sesionVerificada } from "../../../../lib/supabase/sesion";

/**
 * POST → { reclamados }
 * Reclamo desde otra cuenta (docs/login.md §4): después de iniciar sesión con un email que ya tenía
 * cuenta, los casos de la sesión anónima de antes (cookie httpOnly de /codigo) pasan a esta cuenta,
 * y el usuario anónimo, ya vacío, se borra. Verifica las dos sesiones y que la vieja siga siendo
 * anónima: nunca se reclaman casos de una cuenta con email.
 */

export async function POST() {
  const pedido = await authDelPedido();
  const db = supabaseServidor();
  if (!pedido || !db) return noDisponible();
  const { auth, almacen } = pedido;

  const s = await sesionVerificada(auth);
  if (!s) return respuestaSinSesion();
  if (s.anonima) return Response.json({ error: "Primero verificá el código.", codigo: "sin_email" }, { status: 409 });

  const jwt = almacen.get(COOKIE_RECLAMO)?.value;
  if (!jwt) return Response.json({ reclamados: 0 });
  // Se usa una sola vez, pase lo que pase.
  almacen.delete(COOKIE_RECLAMO);
  const viejo = await sesionVerificada(auth, jwt);
  if (!viejo?.anonima || viejo.uid === s.uid) return Response.json({ reclamados: 0 });
  try {
    // El JWT puede ser de antes de que esa sesión sumara un email: se confirma con Auth.
    const { data, error } = await db.auth.admin.getUserById(viejo.uid);
    if (error || !data.user?.is_anonymous) return Response.json({ reclamados: 0 });
    const reclamados = await pasarCasos(db, viejo.uid, s.uid);
    const borrado = await db.auth.admin.deleteUser(viejo.uid);
    if (borrado.error) console.warn("[cuenta] no pude borrar la sesión anónima reclamada:", borrado.error.message);
    return Response.json({ reclamados });
  } catch (e) {
    console.error("[cuenta] reclamar:", e instanceof ErrorSupabase ? e.message : e);
    return Response.json({ error: "No se pudieron pasar los casos." }, { status: 500 });
  }
}
