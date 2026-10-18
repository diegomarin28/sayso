import { z } from "zod";
import { Ficha } from "../../../shared";
import { armarKnowledgePack, type Armado } from "../../../lib/knowledge/armar";
import { supabaseServidor } from "../../../lib/supabase/cliente";
import { cachePacksSupabase } from "../../../lib/supabase/repo";
import { manejar } from "../../../lib/intake/entrada";

/** Buscar y leer un manual puede tardar 1–2 minutos. */
export const maxDuration = 300;

const Entrada = z.object({ ficha: Ficha, sintoma: z.string().min(1).max(2000), tipoEquipo: z.string().trim().min(1).max(60).optional() });

/**
 * POST { ficha (con modelo confirmado), sintoma, tipoEquipo? }
 *   → { pack, manualUrl, manualFileId, paginasVistaExplosionada, paginaVistaInterior, desdeCache, eventos }
 * `manualFileId` va a /api/chat y /api/plano. `paginasVistaExplosionada` (lista) y `paginaVistaInterior`
 * (número o null) van a /api/plano: páginas físicas del PDF (1 = primera hoja), como `gs -dFirstPage`.
 */
export function POST(req: Request) {
  return manejar(req, Entrada, async (entrada) => {
    // Caché de packs en Supabase (por marca + modelo + síntoma); sin Supabase, memoria.
    const db = supabaseServidor();
    const { pack, manual, vistas, vistaInterior, imagenesPaginas, fotosPasos, desdeCache, eventos } = await armarKnowledgePack(entrada, db ? { cache: cachePacksSupabase<Armado>(db) } : {});
    return {
      pack,
      manualUrl: manual?.url ?? null,
      manualFileId: manual?.fileId ?? null,
      paginasVistaExplosionada: vistas.explosionada ? [vistas.explosionada] : [],
      paginaVistaInterior: vistas.interior,
      /** PNG de la vista interior del manual para mostrar al lado del 3D: { url, pagina, estado } o null. */
      vistaInterior: vistaInterior ?? null,
      /** PNG de páginas del manual (vista interior y páginas citadas): { número de página del manual: URL }. */
      imagenesPaginas: imagenesPaginas ?? {},
      /** Guía de iFixit: { URL del paso (la de su cita): foto }. Vacío si no hubo iFixit (#175). */
      fotosPasos: fotosPasos ?? {},
      desdeCache,
      eventos,
    };
  });
}
