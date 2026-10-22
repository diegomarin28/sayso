import { z } from "zod";
import { supabaseServidor } from "../../../../lib/supabase/cliente";
import { Contrasena, Email, Nombre, VERSION_LEGALES } from "../../../../lib/supabase/credenciales";
import { noDisponible, reclamarAnonima, respuestaAuth } from "../../../../lib/supabase/cuenta";
import { respuestaSinSesion } from "../../../../lib/supabase/dueno";
import { respuestaLimite, revisarCuenta } from "../../../../lib/supabase/limite";
import { authDelPedido, sesionVerificada } from "../../../../lib/supabase/sesion";

/**
 * POST { motivo: "crear" | "recuperar" | "cambiar", email, codigo, contrasena } → { verificado: true, reclamados }
 * Confirma el código del email y recién ahí guarda la contraseña (docs/login.md §2):
 * - "crear": código de /crear (`email_change`); la misma sesión anónima queda con email, contraseña,
 *   nombre y apellido (`user_metadata`, para el saludo), y qué versión de los Términos y la Política
 *   de privacidad aceptó y cuándo.
 * - "recuperar": código de /recuperar (`recovery`); entra a esa cuenta con la contraseña nueva, y si
 *   antes había una sesión anónima, sus casos pasan a la cuenta (§4).
 * - "cambiar": el mismo código (`recovery`), con la sesión ya iniciada ("Cambiar contraseña" en
 *   Seguridad); solo para el email de esa sesión.
 */

const Entrada = z.object({
  motivo: z.enum(["crear", "recuperar", "cambiar"]),
  email: Email,
  codigo: z.string().trim().regex(/^\d{6,10}$/),
  contrasena: Contrasena,
  // Solo al crear la cuenta.
  nombre: Nombre.optional(),
  apellido: Nombre.optional(),
  acepta: z.literal(true).optional(),
});

export async function POST(req: Request) {
  const r = Entrada.safeParse(await req.json().catch(() => null));
  if (!r.success) {
    const contrasena = r.error.issues[0]?.path[0] === "contrasena";
    return Response.json(
      contrasena
        ? { error: "La contraseña tiene que tener 8 o más caracteres, con letras y números.", codigo: "contrasena" }
        : { error: "Revisá el código.", codigo: "codigo" },
      { status: 400 },
    );
  }
  const { motivo, email, codigo, contrasena, nombre, apellido, acepta } = r.data;
  if (motivo === "crear" && (!nombre || !apellido)) {
    return Response.json({ error: "Falta tu nombre y apellido.", codigo: "nombre" }, { status: 400 });
  }
  if (motivo === "crear" && !acepta) {
    return Response.json(
      { error: "Para crear la cuenta tenés que aceptar los Términos y la Política de privacidad.", codigo: "acepta" },
      { status: 400 },
    );
  }
  const pedido = await authDelPedido();
  const db = supabaseServidor();
  if (!pedido || !db) return noDisponible();
  const { auth } = pedido;

  const antes = await sesionVerificada(auth);
  if (motivo === "cambiar") {
    if (!antes || antes.anonima) return respuestaSinSesion();
    if (antes.email !== email) {
      return Response.json({ error: "Solo podés cambiar la contraseña de tu cuenta.", codigo: "email" }, { status: 400 });
    }
  } else {
    if (motivo === "crear" && !antes) return respuestaSinSesion();
    if (antes && !antes.anonima) {
      return Response.json({ error: "Ya iniciaste sesión con tu email.", codigo: "con_cuenta" }, { status: 409 });
    }
  }
  const excedido = await revisarCuenta(req, "verificar", email);
  if (excedido) return respuestaLimite(excedido);

  const type = motivo === "crear" ? "email_change" : "recovery";
  const verificado = await auth.auth.verifyOtp({ email, token: codigo, type });
  if (verificado.error) {
    // Supabase responde 403 a un código equivocado; para la persona es lo mismo que uno vencido.
    const e = verificado.error;
    return respuestaAuth(e.status === 403 ? { ...e, code: "otp_expired" } : e);
  }
  const { error } = await auth.auth.updateUser(
    motivo === "crear"
      ? {
          password: contrasena,
          data: { nombre, apellido, legales: { version: VERSION_LEGALES, aceptadoEn: new Date().toISOString() } },
        }
      : { password: contrasena },
  );
  if (error) return respuestaAuth(error);
  // El JWT nuevo ya dice que la sesión tiene email (is_anonymous: false).
  await auth.auth.refreshSession();
  const nuevo = verificado.data.user?.id;
  const reclamados = motivo === "recuperar" && nuevo ? await reclamarAnonima(db, antes, nuevo) : 0;
  return Response.json({ verificado: true, reclamados });
}
