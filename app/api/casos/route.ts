import { z } from "zod";
import { Caso, Evento, Ficha, Foto } from "../../../shared";
import { LIMITES } from "../../../lib/ia/claude";
import { supabaseServidor } from "../../../lib/supabase/cliente";
import {
  ErrorSupabase,
  ExtraCaso,
  guardarCaso,
  guardarEventos,
  guardarFicha,
  guardarFoto,
  subirFotoUsuario,
} from "../../../lib/supabase/repo";
import { respuestaLimite, revisarFotosPorCaso, revisarPorIp, TOPES } from "../../../lib/supabase/limite";
import { esDelDispositivo, respuestaAjeno } from "../../../lib/supabase/dueno";

/**
 * POST { dispositivo, caso?, fotos?: [{ foto, imagen? }], ficha?, eventos? } → { guardado, fotos: [{ id, url }] }
 * Guarda el avance del caso en Supabase (dueño: Iaio). Las fotos van al bucket privado y `url`
 * es su referencia (`fotos-usuarios/…`), no una URL pública. Si Supabase no está configurado
 * responde `guardado: false` y la app sigue igual. Pasado un tope de uso (lib/supabase/limite.ts)
 * responde 429 sin guardar nada. Si algo del pedido es de un caso de otro dispositivo (o de un caso
 * sin dueño, de antes de la 007), responde 403 sin guardar nada (lib/supabase/dueno.ts, #331).
 */

const Entrada = ExtraCaso.extend({
  // Obligatorio: sin dueño no se puede saber de quién es el caso.
  dispositivo: z.string().uuid(),
  caso: Caso.optional(),
  fotos: z
    .array(
      z.object({
        foto: Foto,
        imagen: z.object({ base64: z.string().min(1).max(LIMITES.foto.maxBase64), mediaType: z.string() }).optional(),
      }),
    )
    .max(TOPES.fotosPorPedido)
    .default([]),
  ficha: Ficha.optional(),
  eventos: z.array(Evento).max(50).default([]),
});

export async function POST(req: Request) {
  const r = Entrada.safeParse(await req.json().catch(() => null));
  if (!r.success) {
    return Response.json({ error: "Entrada inválida", detalle: z.treeifyError(r.error) }, { status: 400 });
  }
  const db = supabaseServidor();
  if (!db) return Response.json({ guardado: false, fotos: [] });

  const { caso, fotos, ficha, eventos, dispositivo, tipoEquipo, cierre } = r.data;
  try {
    // Los topes antes de escribir nada.
    const excedido =
      (await revisarPorIp(req, fotos.filter((f) => f.imagen).length)) ??
      (fotos.length > 0 ? await revisarFotosPorCaso(db, fotos.map((f) => f.foto)) : null);
    if (excedido) return respuestaLimite(excedido);
    // Todo lo del pedido tiene que ser de este dispositivo, antes de escribir nada.
    const propio = await esDelDispositivo(db, dispositivo, {
      casoId: caso?.id,
      referenciados: [...fotos.map((f) => f.foto.casoId), ...(ficha ? [ficha.casoId] : []), ...eventos.map((e) => e.casoId)],
      fotos: fotos.map((f) => ({ id: f.foto.id, casoId: f.foto.casoId })),
      eventos: eventos.map((e) => ({ id: e.id, casoId: e.casoId })),
    });
    if (!propio) return respuestaAjeno();
    // El caso primero: fotos, ficha y eventos lo referencian. guardarCaso vuelve a revisar el dueño al escribir.
    if (caso && !(await guardarCaso(db, caso, { dispositivo, tipoEquipo, cierre }))) return respuestaAjeno();
    const urls: { id: string; url: string }[] = [];
    for (const { foto, imagen } of fotos) {
      const url = imagen
        ? await subirFotoUsuario(db, foto.casoId, foto.id, imagen.base64, imagen.mediaType)
        : null;
      await guardarFoto(db, url ? { ...foto, url } : foto);
      if (url) urls.push({ id: foto.id, url });
    }
    if (ficha) await guardarFicha(db, ficha);
    await guardarEventos(db, eventos);
    return Response.json({ guardado: true, fotos: urls });
  } catch (e) {
    console.error("[casos]", e instanceof ErrorSupabase ? e.message : e);
    return Response.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}
