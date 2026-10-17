import { z } from "zod";
import { Caso, Evento, Ficha, Foto } from "../../../shared";
import { supabaseServidor } from "../../../lib/supabase/cliente";
import {
  ErrorSupabase,
  ExtraCaso,
  guardarCaso,
  guardarEventos,
  guardarFicha,
  guardarFoto,
  subirImagen,
} from "../../../lib/supabase/repo";

/**
 * POST { caso?, fotos?: [{ foto, imagen? }], ficha?, eventos? } → { guardado, fotos: [{ id, url }] }
 * Guarda el avance del caso en Supabase (dueño: Iaio). Si Supabase no está configurado
 * responde `guardado: false` y la app sigue igual.
 */

const Entrada = ExtraCaso.extend({
  caso: Caso.optional(),
  fotos: z
    .array(
      z.object({
        foto: Foto,
        imagen: z.object({ base64: z.string().min(1).max(7_000_000), mediaType: z.string() }).optional(),
      }),
    )
    .max(10)
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
    // El caso primero: fotos, ficha y eventos lo referencian.
    if (caso) await guardarCaso(db, caso, { dispositivo, tipoEquipo, cierre });
    const urls: { id: string; url: string }[] = [];
    for (const { foto, imagen } of fotos) {
      const url = imagen
        ? await subirImagen(db, foto.casoId, foto.id, imagen.base64, imagen.mediaType)
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
