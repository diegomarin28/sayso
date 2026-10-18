import { z } from "zod";
import { Ficha, KnowledgePack } from "../../../shared";
import { evento, ImagenSchema, manejar } from "../../../lib/intake/entrada";
import { supabaseServidor } from "../../../lib/supabase/cliente";
import { cachePlanosSupabase } from "../../../lib/planogenerator/cache";
import { MAX_IMAGENES_PLANO } from "../../../lib/planogenerator/generador";
import { obtenerPlano } from "../../../lib/planogenerator/obtener";
import { buscarFotosInterior } from "../../../lib/planogenerator/fotos";

/** Dueño: Diego (carril B). Leer el manual completo puede tardar ~1 minuto; con la vista interior, solo esas páginas. */
export const maxDuration = 300;

const EntradaPlano = z.object({
  casoId: z.string().min(1),
  knowledgePack: KnowledgePack,
  /** Ficha confirmada: marca + modelo son la clave de la caché. */
  ficha: Ficha.optional(),
  /** Tipo de equipo de la recepción (texto libre): si la IA no puede ubicar las piezas, elige la plantilla de ese tipo. */
  tipoEquipo: z.string().max(120).optional(),
  /** De /api/knowledge: el manual ya subido a la Files API y las páginas de la vista explosionada. */
  manualFileId: z.string().nullable().optional(),
  manualUrl: z.string().nullable().optional(),
  paginasVistaExplosionada: z.array(z.number().int().positive()).optional(),
  /** Con esta página (y `manualUrl`) la IA lee solo las vistas, no el manual entero: mucho más barato. */
  paginaVistaInterior: z.number().int().positive().nullable().optional(),
  /** Alternativa sin manual subido: imágenes de páginas (o, más adelante, fotos del interior). */
  imagenes: z.array(ImagenSchema).max(MAX_IMAGENES_PLANO).optional(),
  paginas: z.array(z.number().int().positive()).optional(),
  /** De /api/knowledge: URL del paso de la guía → foto. Sin manual, el cartógrafo mira primero estas (#235). */
  fotosPasos: z.record(z.string().url().max(500), z.string().url().max(500)).optional(),
});

/**
 * POST { casoId, knowledgePack, ficha?, tipoEquipo?, manualFileId?, manualUrl?, paginasVistaExplosionada?, paginaVistaInterior?, imagenes?, paginas? }
 * → { plano, origen: "ia" | "plantilla", desdeCache, paginasLeidas, avisos, eventos }
 * origen "plantilla" = esquema genérico: la pantalla tiene que decirlo.
 */
export function POST(req: Request) {
  return manejar(req, EntradaPlano, async (e) => {
    const db = supabaseServidor();
    const r = await obtenerPlano(
      {
        casoId: e.casoId,
        knowledgePack: e.knowledgePack,
        tipoEquipo: e.tipoEquipo,
        ficha: e.ficha,
        manualUrl: e.manualUrl,
        imagenes: e.imagenes,
        paginas: e.paginas,
        fotosPasos: e.fotosPasos,
        manual: e.manualFileId
          ? { fileId: e.manualFileId, paginasVistaExplosionada: e.paginasVistaExplosionada, paginaVistaInterior: e.paginaVistaInterior }
          : undefined,
      },
      // Sin manual con vistas, antes de estimar se buscan fotos del interior de ese modelo (#235).
      { ...(db ? { cache: cachePlanosSupabase(db) } : {}), buscarFotos: (equipo) => buscarFotosInterior(equipo) },
    );
    const conFotos = r.plano.piezas.some((p) => p.origen === "foto");
    const leido = conFotos
      ? "fotos del interior de este modelo"
      : r.paginasLeidas
      ? `${r.paginasLeidas.length === 1 ? "la página" : "las páginas"} ${r.paginasLeidas.join(", ")} del manual`
      : "el manual";
    // Un plano mixto no se anuncia como leído entero del manual.
    const cuantas = (o: string) => r.plano.piezas.filter((p) => p.origen === o).length;
    const desglose = r.plano.piezas.some((p) => p.origen)
      ? `: ${cuantas("manual")} del manual, ${cuantas("foto")} con fotos del interior, ${cuantas("estimada")} estimadas, ${cuantas("plantilla")} genéricas`
      : "";
    const mensaje = r.desdeCache
      ? `Reusé el plano 3D de este modelo (${r.plano.piezas.length} piezas${desglose}).`
      : r.origen === "ia"
        ? `Ubiqué ${r.plano.piezas.length} piezas leyendo ${leido}${desglose}${r.avisos.length ? ` (${r.avisos.length} correcciones)` : ""}.`
        : "No pude ubicar las piezas con el manual: muestro un esquema genérico, no es tu modelo exacto.";
    return { ...r, eventos: [evento(e.casoId, "cartografo", "plano_generado", mensaje, { origen: r.origen, desdeCache: r.desdeCache, paginasLeidas: r.paginasLeidas })] };
  });
}
