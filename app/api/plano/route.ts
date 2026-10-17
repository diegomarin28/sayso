import { z } from "zod";
import { Ficha, KnowledgePack } from "../../../shared";
import { evento, ImagenSchema, manejar } from "../../../lib/intake/entrada";
import { supabaseServidor } from "../../../lib/supabase/cliente";
import { cachePlanosSupabase } from "../../../lib/planogenerator/cache";
import { MAX_IMAGENES_PLANO } from "../../../lib/planogenerator/generador";
import { obtenerPlano } from "../../../lib/planogenerator/obtener";

/** Dueño: Diego (carril B). Leer el manual completo puede tardar ~1 minuto. */
export const maxDuration = 300;

const EntradaPlano = z.object({
  casoId: z.string().min(1),
  knowledgePack: KnowledgePack,
  /** Ficha confirmada: marca + modelo son la clave de la caché. */
  ficha: Ficha.optional(),
  /** De /api/knowledge: el manual ya subido a la Files API y las páginas de la vista explosionada. */
  manualFileId: z.string().nullable().optional(),
  manualUrl: z.string().nullable().optional(),
  paginasVistaExplosionada: z.array(z.number().int().positive()).optional(),
  /** Alternativa sin manual subido: imágenes de páginas (o, más adelante, fotos del interior). */
  imagenes: z.array(ImagenSchema).max(MAX_IMAGENES_PLANO).optional(),
  paginas: z.array(z.number().int().positive()).optional(),
});

/**
 * POST { casoId, knowledgePack, ficha?, manualFileId?, manualUrl?, paginasVistaExplosionada?, imagenes?, paginas? }
 * → { plano, origen: "ia" | "plantilla", desdeCache, avisos, eventos }
 * origen "plantilla" = esquema genérico: la pantalla tiene que decirlo.
 */
export function POST(req: Request) {
  return manejar(req, EntradaPlano, async (e) => {
    const db = supabaseServidor();
    const r = await obtenerPlano(
      {
        casoId: e.casoId,
        knowledgePack: e.knowledgePack,
        ficha: e.ficha,
        manualUrl: e.manualUrl,
        imagenes: e.imagenes,
        paginas: e.paginas,
        manual: e.manualFileId ? { fileId: e.manualFileId, paginasVistaExplosionada: e.paginasVistaExplosionada } : undefined,
      },
      db ? { cache: cachePlanosSupabase(db) } : {},
    );
    const mensaje = r.desdeCache
      ? `Reusé el plano 3D de este modelo (${r.plano.piezas.length} piezas).`
      : r.origen === "ia"
        ? `Ubiqué ${r.plano.piezas.length} piezas leyendo el manual${r.avisos.length ? ` (${r.avisos.length} correcciones)` : ""}.`
        : "No pude ubicar las piezas con el manual: muestro un esquema genérico, no es tu modelo exacto.";
    return { ...r, eventos: [evento(e.casoId, "cartografo", "plano_generado", mensaje, { origen: r.origen, desdeCache: r.desdeCache })] };
  });
}
