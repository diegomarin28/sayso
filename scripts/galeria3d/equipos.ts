import type { PlanoDePiezas } from "../../shared";

/** Un equipo a capturar: un ejemplo del lab (por id) o un plano suelto con su tipo de equipo. */
export type Equipo = { id: string; plano?: PlanoDePiezas; tipoEquipo?: string };

type CasoConPlano = { caso: { id: string }; tipoEquipo?: string | null; guia?: { plano?: { plano: PlanoDePiezas } | null } | null };

/** Los casos de "Mis casos" (scripts/bateria/mis-casos.ts): el plano terminado y el tipo de equipo. Sin plano, no van. */
export function equiposDeCasos(casos: CasoConPlano[]): Equipo[] {
  return casos.flatMap((c) => (c.guia?.plano ? [{ id: c.caso.id, plano: c.guia.plano.plano, tipoEquipo: c.tipoEquipo ?? undefined }] : []));
}
