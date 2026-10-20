import { z } from "zod";
import { supabaseServidor } from "../../../lib/supabase/cliente";
import { borrarCuenta, COOKIE_RECLAMO, noDisponible } from "../../../lib/supabase/cuenta";
import { respuestaSinSesion } from "../../../lib/supabase/dueno";
import { ErrorSupabase } from "../../../lib/supabase/repo";
import { authDelPedido, borrarCookiesDeSesion, sesionVerificada, tieneCookieDeSesion } from "../../../lib/supabase/sesion";

/**
 * GET → { configurado, sesion, anonima, email }: la sesión de este navegador (cookie httpOnly).
 * DELETE { confirmar: "borrar" } → { borrado, casos }: borra la cuenta, sus casos, fotos (también
 * los archivos) y el usuario de Auth, y las cookies (docs/login.md §5). Sirve también para una
 * sesión anónima. El uid sale siempre de la sesión verificada.
 */

const SIN_CACHE = { "Cache-Control": "no-store" };

export async function GET() {
  const pedido = await authDelPedido();
  if (!pedido) return Response.json({ configurado: false, sesion: false, anonima: false, email: null }, { headers: SIN_CACHE });
  const conCookie = tieneCookieDeSesion(pedido.almacen.getAll().map((c) => c.name));
  const s = conCookie ? await sesionVerificada(pedido.auth) : null;
  return Response.json(
    { configurado: true, sesion: !!s, anonima: s?.anonima ?? false, email: s?.email ?? null },
    { headers: SIN_CACHE },
  );
}

const Borrar = z.object({ confirmar: z.literal("borrar") });

export async function DELETE(req: Request) {
  if (!Borrar.safeParse(await req.json().catch(() => null)).success) {
    return Response.json({ error: "Falta confirmar el borrado." }, { status: 400 });
  }
  const pedido = await authDelPedido();
  const db = supabaseServidor();
  if (!pedido || !db) return noDisponible();
  const s = await sesionVerificada(pedido.auth);
  if (!s) return respuestaSinSesion();
  try {
    const { casos } = await borrarCuenta(db, s.uid);
    borrarCookiesDeSesion(pedido.almacen, [COOKIE_RECLAMO]);
    return Response.json({ borrado: true, casos });
  } catch (e) {
    console.error("[cuenta] borrar:", e instanceof ErrorSupabase ? e.message : e);
    return Response.json({ error: "No se pudo borrar. Probá de nuevo." }, { status: 500 });
  }
}
