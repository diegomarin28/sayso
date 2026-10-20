import { supabaseServidor } from "../../../../lib/supabase/cliente";
import { exportarCuenta, noDisponible } from "../../../../lib/supabase/cuenta";
import { respuestaSinSesion } from "../../../../lib/supabase/dueno";
import { ErrorSupabase } from "../../../../lib/supabase/repo";
import { authDelPedido, sesionVerificada } from "../../../../lib/supabase/sesion";

/**
 * GET → archivo JSON con los casos de la sesión, sus fichas, eventos, guías y fotos (URL firmadas
 * de 5 minutos) (docs/login.md §5). No llama a la IA.
 */

export async function GET() {
  const pedido = await authDelPedido();
  const db = supabaseServidor();
  if (!pedido || !db) return noDisponible();
  const s = await sesionVerificada(pedido.auth);
  if (!s) return respuestaSinSesion();
  try {
    const datos = await exportarCuenta(db, s.uid);
    const dia = datos.exportadoEn.slice(0, 10);
    return new Response(JSON.stringify(datos, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="sayso-mis-casos-${dia}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[cuenta] exportar:", e instanceof ErrorSupabase ? e.message : e);
    return Response.json({ error: "No se pudo exportar. Probá de nuevo." }, { status: 500 });
  }
}
