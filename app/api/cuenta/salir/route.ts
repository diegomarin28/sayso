import { noDisponible } from "../../../../lib/supabase/cuenta";
import { authDelPedido, borrarCookiesDeSesion, sesionVerificada } from "../../../../lib/supabase/sesion";

/**
 * POST → { salido: true }
 * Cierra la sesión con email en este navegador (las demás siguen). Una sesión anónima no se cierra:
 * no tiene cómo volver a entrar y sus casos quedarían perdidos (para eso está borrar la cuenta).
 * La copia local de los casos se queda en el celular (decisión de Iaio, 20/10, hasta Login 3/3).
 */

export async function POST() {
  const pedido = await authDelPedido();
  if (!pedido) return noDisponible();
  const s = await sesionVerificada(pedido.auth);
  if (s?.anonima) {
    return Response.json({ error: "Guardá tus casos con tu email antes de salir.", codigo: "anonima" }, { status: 409 });
  }
  if (s) await pedido.auth.auth.signOut({ scope: "local" }).catch(() => null);
  borrarCookiesDeSesion(pedido.almacen);
  return Response.json({ salido: true });
}
