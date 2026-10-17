import { z } from "zod";
import { Ficha } from "../../../shared";
import { armarKnowledgePack } from "../../../lib/knowledge/armar";
import { manejar } from "../../../lib/intake/entrada";

/** Buscar y leer un manual puede tardar 1–2 minutos. */
export const maxDuration = 300;

const Entrada = z.object({ ficha: Ficha, sintoma: z.string().min(1).max(2000) });

/**
 * POST { ficha (con modelo confirmado), sintoma }
 *   → { pack: KnowledgePack, manualUrl, manualFileId (para /api/chat), vistas, desdeCache, eventos }
 * `vistas = { explosionada, interior }`: páginas físicas del PDF (1 = primera hoja) para /api/plano, o null.
 */
export function POST(req: Request) {
  return manejar(req, Entrada, async (entrada) => {
    const { pack, manual, vistas, desdeCache, eventos } = await armarKnowledgePack(entrada);
    return { pack, manualUrl: manual?.url ?? null, manualFileId: manual?.fileId ?? null, vistas, desdeCache, eventos };
  });
}
