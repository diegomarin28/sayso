import { z } from "zod";
import { noDisponible, respuestaAuth } from "../../../../lib/supabase/cuenta";
import { respuestaLimite, revisarCuenta } from "../../../../lib/supabase/limite";
import { authDelPedido, sesionVerificada } from "../../../../lib/supabase/sesion";

/**
 * POST { captchaToken? } → { sesion: true, anonima }
 * Sesión anónima de Supabase Auth desde el primer uso (docs/login.md §1), en cookies httpOnly.
 * El token de Turnstile viene del widget de la página y Supabase lo verifica (`captchaToken`).
 * Si ya hay una sesión válida no crea otra.
 */

const Entrada = z.object({ captchaToken: z.string().min(1).max(4096).optional() });

export async function POST(req: Request) {
  const r = Entrada.safeParse(await req.json().catch(() => ({})));
  if (!r.success) return Response.json({ error: "Entrada inválida" }, { status: 400 });
  const pedido = await authDelPedido();
  if (!pedido) return noDisponible();

  const actual = await sesionVerificada(pedido.auth);
  if (actual) return Response.json({ sesion: true, anonima: actual.anonima });

  const excedido = await revisarCuenta(req, "sesion");
  if (excedido) return respuestaLimite(excedido);
  const { error } = await pedido.auth.auth.signInAnonymously({ options: { captchaToken: r.data.captchaToken } });
  if (error) return respuestaAuth(error);
  return Response.json({ sesion: true, anonima: true });
}
