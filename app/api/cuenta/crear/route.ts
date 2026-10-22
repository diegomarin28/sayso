import { z } from "zod";
import { Contrasena, Email } from "../../../../lib/supabase/credenciales";
import { noDisponible, respuestaAuth } from "../../../../lib/supabase/cuenta";
import { respuestaSinSesion } from "../../../../lib/supabase/dueno";
import { respuestaLimite, revisarCuenta } from "../../../../lib/supabase/limite";
import { authDelPedido, sesionVerificada } from "../../../../lib/supabase/sesion";

/**
 * POST { email, contrasena, acepta: true } → { enviado: true }
 * Crear cuenta (docs/login.md §2): la sesión anónima pasa a tener email con `updateUser({ email })`,
 * que manda un código para confirmar que el email es de la persona. El uid no cambia: sus casos
 * siguen siendo suyos. La contraseña se valida acá pero se guarda recién en /verificar, porque
 * Supabase no deja ponerle contraseña a una sesión anónima antes de verificar el email.
 * Si el email ya tiene cuenta responde 409: hay que iniciar sesión. Sin aceptar los Términos y la
 * Política de privacidad no se crea (lo que se aceptó se guarda en /verificar).
 */

const Entrada = z.object({ email: Email, contrasena: Contrasena, acepta: z.literal(true) });

export async function POST(req: Request) {
  const r = Entrada.safeParse(await req.json().catch(() => null));
  if (!r.success) {
    const p = r.error.issues[0]?.path[0];
    const campo = p === "contrasena" ? "contrasena" : p === "acepta" ? "acepta" : "email";
    const mensaje = {
      email: "Revisá el email.",
      contrasena: "La contraseña tiene que tener 8 o más caracteres, con letras y números.",
      acepta: "Para crear la cuenta tenés que aceptar los Términos y la Política de privacidad.",
    }[campo];
    return Response.json({ error: mensaje, codigo: campo }, { status: 400 });
  }
  const pedido = await authDelPedido();
  if (!pedido) return noDisponible();
  const s = await sesionVerificada(pedido.auth);
  if (!s) return respuestaSinSesion();
  if (!s.anonima) {
    return Response.json({ error: "Ya iniciaste sesión con tu email.", codigo: "con_cuenta" }, { status: 409 });
  }
  const excedido = await revisarCuenta(req, "codigo", r.data.email);
  if (excedido) return respuestaLimite(excedido);

  const { error } = await pedido.auth.auth.updateUser({ email: r.data.email });
  if (error) return respuestaAuth(error);
  return Response.json({ enviado: true });
}
