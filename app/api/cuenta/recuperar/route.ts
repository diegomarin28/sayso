import { z } from "zod";
import { Email } from "../../../../lib/supabase/credenciales";
import { noDisponible, respuestaAuth } from "../../../../lib/supabase/cuenta";
import { respuestaLimite, revisarCuenta } from "../../../../lib/supabase/limite";
import { authDelPedido, sesionVerificada } from "../../../../lib/supabase/sesion";

/**
 * POST { email, captchaToken? } → { enviado: true }
 * "Olvidé mi contraseña" (docs/login.md §2): manda un código al email, con CAPTCHA. Responde lo
 * mismo tenga o no cuenta ese email. La contraseña nueva se guarda en /verificar.
 * Con la sesión ya iniciada ("Cambiar contraseña" en Seguridad) solo manda al email de esa sesión.
 */

const Entrada = z.object({ email: Email, captchaToken: z.string().min(1).max(4096).optional() });

export async function POST(req: Request) {
  const r = Entrada.safeParse(await req.json().catch(() => null));
  if (!r.success) return Response.json({ error: "Revisá el email.", codigo: "email" }, { status: 400 });
  const pedido = await authDelPedido();
  if (!pedido) return noDisponible();
  const s = await sesionVerificada(pedido.auth);
  if (s && !s.anonima && s.email !== r.data.email) {
    return Response.json({ error: "Solo podés cambiar la contraseña de tu cuenta.", codigo: "email" }, { status: 400 });
  }
  const excedido = await revisarCuenta(req, "codigo", r.data.email);
  if (excedido) return respuestaLimite(excedido);

  const { error } = await pedido.auth.auth.resetPasswordForEmail(r.data.email, { captchaToken: r.data.captchaToken });
  if (error) return respuestaAuth(error);
  return Response.json({ enviado: true });
}
