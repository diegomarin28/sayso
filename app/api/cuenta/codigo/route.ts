import { z } from "zod";
import { COOKIE_RECLAMO, noDisponible, respuestaAuth, VIDA_RECLAMO_SEG } from "../../../../lib/supabase/cuenta";
import { respuestaLimite, revisarCuenta } from "../../../../lib/supabase/limite";
import { authDelPedido, OPCIONES_COOKIE, sesionVerificada } from "../../../../lib/supabase/sesion";

/**
 * POST { email, captchaToken? } → { enviado: true }
 * "Guardar mis casos" (docs/login.md §2 y §4): manda un código de 6 dígitos al email.
 * - Con sesión anónima: `updateUser({ email })`, que convierte esa sesión sin cambiar el uid.
 * - Si el email ya tiene cuenta: guarda el JWT anónimo en una cookie httpOnly de 15 minutos (para
 *   el reclamo) y manda el código de inicio de sesión (`signInWithOtp`, con captcha).
 * Responde lo mismo en los dos casos: no cuenta si un email tiene cuenta.
 */

const Entrada = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  captchaToken: z.string().min(1).max(4096).optional(),
});

export async function POST(req: Request) {
  const r = Entrada.safeParse(await req.json().catch(() => null));
  if (!r.success) return Response.json({ error: "Revisá el email.", codigo: "email" }, { status: 400 });
  const { email, captchaToken } = r.data;
  const pedido = await authDelPedido();
  if (!pedido) return noDisponible();
  const { auth, almacen } = pedido;

  const s = await sesionVerificada(auth);
  if (s && !s.anonima) {
    return Response.json({ error: "Ya iniciaste sesión con tu email.", codigo: "con_cuenta" }, { status: 409 });
  }
  const excedido = await revisarCuenta(req, "codigo", email);
  if (excedido) return respuestaLimite(excedido);

  if (s?.anonima) {
    const cambio = await auth.auth.updateUser({ email });
    if (!cambio.error) {
      almacen.delete(COOKIE_RECLAMO);
      return Response.json({ enviado: true });
    }
    if (cambio.error.code !== "email_exists") return respuestaAuth(cambio.error);
    // El email ya tiene cuenta: el JWT anónimo, recién refrescado, queda para el reclamo.
    const refresco = await auth.auth.refreshSession();
    if (refresco.error || !refresco.data.session) return respuestaAuth(refresco.error);
    almacen.set(COOKIE_RECLAMO, refresco.data.session.access_token, { ...OPCIONES_COOKIE, maxAge: VIDA_RECLAMO_SEG });
  }
  const { error } = await auth.auth.signInWithOtp({ email, options: { shouldCreateUser: !s, captchaToken } });
  if (error) return respuestaAuth(error);
  return Response.json({ enviado: true });
}
