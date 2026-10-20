import { supabaseServidor } from "../../../../lib/supabase/cliente";
import { respuestaSinSesion } from "../../../../lib/supabase/dueno";
import { ErrorSupabase, leerCasoDeDueno } from "../../../../lib/supabase/repo";
import { uidDeSesion } from "../../../../lib/supabase/sesion";

/**
 * GET → { caso, tipoEquipo, ficha, cierre, actualizadoEn, fotos, guia }
 * El caso de la sesión con su ficha, sus fotos (`url` firmada por 5 minutos, o null; nunca una URL
 * pública) y su guía tal como se guardó (docs/login.md §6). No llama a la IA ni regenera nada.
 * Sin sesión, 401. Si el caso no existe o es de otro, el mismo 404: no cuenta cuál de las dos.
 */

/** Sin cachés: son datos de una persona y las URL firmadas vencen. */
const PRIVADO = { "Cache-Control": "private, no-store" };

const noEncontrado = () => Response.json({ error: "No encontramos ese caso." }, { status: 404, headers: PRIVADO });

export async function GET(_req: Request, ctx: RouteContext<"/api/casos/[id]">) {
  const { id } = await ctx.params;
  const db = supabaseServidor();
  if (!db) return noEncontrado();
  const uid = await uidDeSesion();
  if (!uid) return respuestaSinSesion();
  if (id.length > 200) return noEncontrado();
  try {
    const caso = await leerCasoDeDueno(db, uid, id);
    return caso ? Response.json(caso, { headers: PRIVADO }) : noEncontrado();
  } catch (e) {
    console.error("[casos/id]", e instanceof ErrorSupabase ? e.message : e);
    return Response.json({ error: "No se pudo leer el caso" }, { status: 500 });
  }
}
