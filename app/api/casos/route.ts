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
import { reclamarDispositivo, respuestaDueno, respuestaSinSesion, revisarDueno } from "../../../lib/supabase/dueno";
import { respuestaLimite, revisarFotosPorCaso, revisarPorIp, TOPES } from "../../../lib/supabase/limite";
import { uidDeSesion } from "../../../lib/supabase/sesion";
import { ErrorImagen, sinMetadatos, TIPOS_IMAGEN } from "../../../lib/supabase/sin-metadatos";

/**
 * POST { caso?, fotos?: [{ foto, imagen? }], ficha?, eventos?, dispositivo? }
 *   → { guardado, fotos: [{ id, url }], dispositivoReclamado? }
 * Guarda el avance del caso en Supabase (dueño: Iaio). Las fotos van al bucket privado y `url`
 * es su referencia (`fotos-usuarios/…`), no una URL pública. Si Supabase no está configurado
 * responde `guardado: false` y la app sigue igual. Pasado un tope de uso (lib/supabase/limite.ts)
 * responde 429 sin guardar nada. El dueño es el uid de la sesión (lib/supabase/sesion.ts), nunca el
 * cuerpo: sin sesión válida responde 401, y si algún caso es de otro responde 403, sin guardar nada.
 * `dispositivo` (el id anónimo de antes del login) solo sirve para reclamar sus casos una vez; con
 * `dispositivoReclamado: true` el celular lo borra. Las imágenes se suben sin EXIF ni otros metadatos.
 */

const Entrada = ExtraCaso.extend({
  caso: Caso.optional(),
  fotos: z
    .array(
      z.object({
        foto: Foto,
        imagen: z
          .object({ base64: z.string().min(1).max(LIMITES.foto.maxBase64), mediaType: z.enum(TIPOS_IMAGEN) })
          .optional(),
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

  const uid = await uidDeSesion();
  if (!uid) return respuestaSinSesion();

  const { caso, fotos, ficha, eventos, dispositivo, tipoEquipo, cierre } = r.data;
  // Las fotos sin metadatos (GPS) antes de escribir nada: una que no se puede limpiar frena el pedido.
  let limpias: (string | undefined)[];
  try {
    limpias = fotos.map(
      ({ imagen }) => imagen && sinMetadatos(Buffer.from(imagen.base64, "base64"), imagen.mediaType).toString("base64"),
    );
  } catch (e) {
    if (!(e instanceof ErrorImagen)) throw e;
    return Response.json({ error: "Imagen inválida", detalle: e.message }, { status: 400 });
  }
  try {
    // Los topes antes de escribir nada.
    const excedido =
      (await revisarPorIp(req, fotos.filter((f) => f.imagen).length)) ??
      (fotos.length > 0 ? await revisarFotosPorCaso(db, fotos.map((f) => f.foto)) : null);
    if (excedido) return respuestaLimite(excedido);
    // El reclamo antes del dueño: los casos del dispositivo ya son de este uid. También bajo el tope.
    if (dispositivo) await reclamarDispositivo(db, uid, dispositivo);
    const ajeno = await revisarDueno(db, uid, { caso, fotos: fotos.map((f) => f.foto), ficha, eventos });
    if (ajeno) {
      console.warn("[casos] rechazado por dueño:", ajeno);
      return respuestaDueno();
    }
    // El caso primero: fotos, ficha y eventos lo referencian.
    if (caso) await guardarCaso(db, caso, { tipoEquipo, cierre }, uid);
    const urls: { id: string; url: string }[] = [];
    for (const [i, { foto, imagen }] of fotos.entries()) {
      const base64 = limpias[i];
      const url = imagen && base64 ? await subirFotoUsuario(db, foto.casoId, foto.id, base64, imagen.mediaType) : null;
      await guardarFoto(db, url ? { ...foto, url } : foto);
      if (url) urls.push({ id: foto.id, url });
    }
    if (ficha) await guardarFicha(db, ficha);
    await guardarEventos(db, eventos);
    return Response.json({ guardado: true, fotos: urls, ...(dispositivo ? { dispositivoReclamado: true } : {}) });
  } catch (e) {
    console.error("[casos]", e instanceof ErrorSupabase ? e.message : e);
    return Response.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}
