import { z } from "zod";
import { COOKIE_RECLAMO, noDisponible, respuestaAuth } from "../../../../lib/supabase/cuenta";
import { respuestaLimite, revisarCuenta } from "../../../../lib/supabase/limite";
import { authDelPedido, sesionVerificada } from "../../../../lib/supabase/sesion";

/**
 * POST { email, codigo } → { verificado: true, email, reclamoPendiente }
 * Verifica el código de /api/cuenta/codigo. El tipo lo decide el servidor: con sesión anónima y sin
 * reclamo pendiente es `email_change` (la misma sesión pasa a tener email); si no, `email` (inicio
 * de sesión en la cuenta que ya existía). Con `reclamoPendiente`, la pantalla llama a /reclamar.
 */

const Entrada = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  codigo: z.string().trim().regex(/^\d{6,10}$/),
});

export async function POST(req: Request) {
  const r = Entrada.safeParse(await req.json().catch(() => null));
  if (!r.success) return Response.json({ error: "Revisá el código.", codigo: "codigo" }, { status: 400 });
  const { email, codigo } = r.data;
  const pedido = await authDelPedido();
  if (!pedido) return noDisponible();
  const { auth, almacen } = pedido;

  const s = await sesionVerificada(auth);
  if (s && !s.anonima) {
    return Response.json({ error: "Ya iniciaste sesión con tu email.", codigo: "con_cuenta" }, { status: 409 });
  }
  const excedido = await revisarCuenta(req, "verificar", email);
  if (excedido) return respuestaLimite(excedido);

  const conReclamo = almacen.has(COOKIE_RECLAMO);
  const type = s?.anonima && !conReclamo ? "email_change" : "email";
  const { error } = await auth.auth.verifyOtp({ email, token: codigo, type });
  if (error) {
    // Supabase responde 403 a un código equivocado; para la persona es lo mismo que uno vencido.
    return respuestaAuth(error.status === 403 ? { ...error, code: "otp_expired" } : error);
  }
  // El JWT nuevo ya dice que la sesión tiene email (is_anonymous: false).
  if (type === "email_change") await auth.auth.refreshSession();
  return Response.json({ verificado: true, email, reclamoPendiente: type === "email" && conReclamo });
}
