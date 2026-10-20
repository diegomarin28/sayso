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

/**
 * POST { caso?, fotos?: [{ foto, imagen? }], ficha?, eventos? } → { guardado, fotos: [{ id, url }] }
 * Guarda el avance del caso en Supabase (dueño: Iaio). Las fotos van al bucket privado y `url`
 * es su referencia (`fotos-usuarios/…`), no una URL pública. Si Supabase no está configurado
 * responde `guardado: false` y la app sigue igual. Pasado un tope de uso (lib/supabase/limite.ts)
 * responde 429 sin guardar nada.
 */

const Entrada = ExtraCaso.extend({
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
    // El caso primero: fotos, ficha y eventos lo referencian.
    if (caso) await guardarCaso(db, caso, { dispositivo, tipoEquipo, cierre });
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
