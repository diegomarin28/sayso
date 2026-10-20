import { z } from "zod";
import { KnowledgePack, PlanoDePiezas } from "../../shared";

/**
 * Guía de un caso: lo que la persona vio (pack, manual, páginas y plano 3D), para retomarlo sin
 * volver a gastar IA (docs/login.md §6). La guardan el celular (`mis-casos.ts`) y el servidor
 * (tabla `guias`, migración 012), donde una vez escrita no cambia. Es la misma forma en los dos:
 * no es un contrato de `shared/`, está armada con `KnowledgePack` y `PlanoDePiezas`.
 * Sin dependencias del servidor: la importa también el navegador.
 */

export const Preparado = z.object({
  pack: KnowledgePack,
  manualUrl: z.string().nullable(),
  manualFileId: z.string().nullable(),
  paginasVistaExplosionada: z.array(z.number()).default([]),
  paginaVistaInterior: z.number().nullable().default(null),
  /** Página del manual → URL del PNG (vista interior y páginas citadas; nunca fotos de la persona). */
  imagenesPaginas: z.record(z.string(), z.string()).default({}),
  fotosPasos: z.record(z.string(), z.string()).default({}),
  vistaInterior: z
    .object({ url: z.string(), pagina: z.number(), estado: z.enum(["VERIFICADO", "NO_VERIFICADO"]) })
    .nullable()
    .default(null),
  desdeCache: z.boolean(),
});

export const PlanoGuardado = z.object({
  plano: PlanoDePiezas,
  origen: z.enum(["ia", "plantilla"]),
  avisos: z.array(z.string()).default([]),
});

export const Guia = z.object({ preparado: Preparado, plano: PlanoGuardado });
export type Guia = z.infer<typeof Guia>;
