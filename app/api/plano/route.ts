import { z } from "zod";
import { KnowledgePack } from "../../../shared";
import { evento, ImagenSchema, manejar } from "../../../lib/intake/entrada";
import { generarPlano } from "../../../lib/planogenerator/generador";

/** Dueño: Diego (carril B). Genera el plano 3D desde el manual (B4). */
const EntradaPlano = z.object({
  casoId: z.string().min(1),
  knowledgePack: KnowledgePack,
  /** Páginas del manual con la vista explosionada o inferior. */
  imagenes: z.array(ImagenSchema).max(4).optional(),
  paginas: z.array(z.number().int().positive()).max(4).optional(),
});

/** POST { casoId, knowledgePack, imagenes?, paginas? } → { plano, origen, avisos, eventos } */
export function POST(req: Request) {
  return manejar(req, EntradaPlano, async (entrada) => {
    const { plano, origen, avisos } = await generarPlano(entrada);
    const mensaje =
      origen === "ia"
        ? `Ubiqué ${plano.piezas.length} piezas a partir del manual${avisos.length ? ` (${avisos.length} correcciones)` : ""}.`
        : "No pude ubicar las piezas con el manual: muestro un modelo genérico de notebook.";
    return {
      plano,
      origen,
      avisos,
      eventos: [evento(entrada.casoId, "cartografo", "plano_generado", mensaje, { origen, avisos })],
    };
  });
}
