import { z } from "zod";
import { Ficha } from "../../../shared";
import { armarKnowledgePack, type Armado } from "../../../lib/knowledge/armar";
import { supabaseServidor } from "../../../lib/supabase/cliente";
import { cachePacksSupabase } from "../../../lib/supabase/repo";
import { manejar } from "../../../lib/intake/entrada";

/** Buscar y leer un manual puede tardar 1–2 minutos. */
export const maxDuration = 300;

const Entrada = z.object({ ficha: Ficha, sintoma: z.string().min(1).max(2000) });

/**
 * POST { ficha (con modelo confirmado), sintoma }
 *   → { pack, manualUrl, manualFileId, paginasVistaExplosionada, paginaVistaInterior, desdeCache, eventos }
 * `manualFileId` va a /api/chat y /api/plano. `paginasVistaExplosionada` (lista) y `paginaVistaInterior`
 * (número o null) van a /api/plano: páginas físicas del PDF (1 = primera hoja), como `gs -dFirstPage`.
 */
export function POST(req: Request) {
  return manejar(req, Entrada, async (entrada) => {
    // Caché de packs en Supabase (por marca + modelo + síntoma); sin Supabase, memoria.
    const db = supabaseServidor();
    const { pack, manual, vistas, desdeCache, eventos } = await armarKnowledgePack(entrada, db ? { cache: cachePacksSupabase<Armado>(db) } : {});
    return {
      pack,
      manualUrl: manual?.url ?? null,
      manualFileId: manual?.fileId ?? null,
      paginasVistaExplosionada: vistas.explosionada ? [vistas.explosionada] : [],
      paginaVistaInterior: vistas.interior,
      desdeCache,
      eventos,
    };
  });
}
