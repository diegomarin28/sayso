import { z } from "zod";
import { supabaseServidor } from "../../../../lib/supabase/cliente";
import { Email } from "../../../../lib/supabase/credenciales";
import { noDisponible, reclamarAnonima, respuestaAuth } from "../../../../lib/supabase/cuenta";
import { respuestaLimite, revisarCuenta } from "../../../../lib/supabase/limite";
import { authDelPedido, sesionVerificada } from "../../../../lib/supabase/sesion";

/**
 * POST { email, contrasena, captchaToken? } → { entrado: true, reclamados }
 * Iniciar sesión con email y contraseña (docs/login.md §2), con CAPTCHA. Si antes había una sesión
 * anónima, sus casos pasan a la cuenta en este mismo pedido (reclamo, §4). La contraseña no se
 * revisa contra la regla acá: una cuenta vieja puede tener otra, y la decide Supabase.
 */

const Entrada = z.object({
  email: Email,
  contrasena: z.string().min(1).max(72),
  captchaToken: z.string().min(1).max(4096).optional(),
});

export async function POST(req: Request) {
  const r = Entrada.safeParse(await req.json().catch(() => null));
  if (!r.success) return Response.json({ error: "Revisá el email y la contraseña.", codigo: "credenciales" }, { status: 400 });
  const { email, contrasena, captchaToken } = r.data;
  const pedido = await authDelPedido();
  const db = supabaseServidor();
  if (!pedido || !db) return noDisponible();

  const antes = await sesionVerificada(pedido.auth);
  if (antes && !antes.anonima) {
    return Response.json({ error: "Ya iniciaste sesión con tu email.", codigo: "con_cuenta" }, { status: 409 });
  }
  const excedido = await revisarCuenta(req, "entrar", email);
  if (excedido) return respuestaLimite(excedido);

  const { data, error } = await pedido.auth.auth.signInWithPassword({ email, password: contrasena, options: { captchaToken } });
  if (error || !data.user) return respuestaAuth(error);
  const reclamados = await reclamarAnonima(db, antes, data.user.id);
  return Response.json({ entrado: true, reclamados });
}
