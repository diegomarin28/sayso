import type { OrigenDato3D, PiezaPlano, PlanoDePiezas } from "../../shared";

/**
 * Cuánto se puede confiar en cada ubicación del 3D (ver `OrigenDato3D` en shared/).
 * Un plano mixto no se muestra como verificado entero: el visor muestra el resumen y cada
 * etiqueta dice de dónde sale su pieza, con documento y página cuando hay.
 */

/**
 * Las piezas genéricas: las que el esqueleto del tipo suma y el pack del caso no nombra (origen "plantilla" y
 * fuera del pack, ver `seguirPlantilla`). El visor las pinta en gris. Sin pack (lab), ninguna.
 */
export function piezasGenericas(plano: PlanoDePiezas, piezasDelPack?: ReadonlyArray<{ id: string }>): Set<string> {
  if (!piezasDelPack?.length) return new Set();
  const delPack = new Set(piezasDelPack.map((p) => p.id));
  return new Set(plano.piezas.filter((p) => p.origen === "plantilla" && !delPack.has(p.pieza)).map((p) => p.pieza));
}

export type ResumenOrigen = Record<OrigenDato3D | "sinDato", number> & { medidasEstimadas: boolean };

export function resumenOrigen(plano: PlanoDePiezas): ResumenOrigen {
  const r: ResumenOrigen = { manual: 0, estimada: 0, plantilla: 0, sinDato: 0, medidasEstimadas: false };
  for (const p of plano.piezas) r[p.origen ?? "sinDato"]++;
  r.medidasEstimadas = !plano.medidas || plano.medidas.ancho !== "manual" || plano.medidas.prof !== "manual";
  return r;
}

/** Todas las piezas y las medidas salen del manual. */
export function todoDelManual(r: ResumenOrigen): boolean {
  return r.manual > 0 && r.estimada + r.plantilla + r.sinDato === 0 && !r.medidasEstimadas;
}

/** Ej. "3 del manual · 2 estimadas · 1 genérica". */
export function textoResumen(r: ResumenOrigen): string {
  if (todoDelManual(r)) return "Todo ubicado con el manual";
  if (r.manual + r.estimada + r.plantilla === 0) return "Ubicaciones sin verificar";
  const partes = [
    r.manual && `${r.manual} del manual`,
    r.estimada && `${r.estimada} ${r.estimada === 1 ? "estimada" : "estimadas"}`,
    r.plantilla && `${r.plantilla} ${r.plantilla === 1 ? "genérica" : "genéricas"}`,
    r.sinDato && `${r.sinDato} sin verificar`,
  ].filter(Boolean);
  return partes.join(" · ");
}

const NOMBRE: Record<OrigenDato3D, string> = { manual: "Manual", estimada: "Estimada", plantilla: "Genérica" };

/**
 * Lo que dice la etiqueta de una pieza en el 3D, debajo del nombre: solo si la ubicación sale del manual
 * ("Manual · HMM p. 54"); si es estimada o genérica, nada (#209: "sin verificar" se repetía hasta 5 veces
 * por pantalla). Esa incertidumbre se dice una vez: el punto y el panel del ícono del 3D (`textoResumen`)
 * y el contorno punteado de cada pieza.
 */
export function textoEtiquetaPieza(p: Pick<PiezaPlano, "origen" | "cita">): string | null {
  return p.origen === "manual" ? textoOrigenPieza(p) : null;
}

/** Ej. "Manual · HMM p. 54", "Estimada · p. 12", "Genérica", "Sin verificar". */
export function textoOrigenPieza(p: Pick<PiezaPlano, "origen" | "cita">): string {
  if (!p.origen) return "Sin verificar";
  const donde = p.cita?.pagina ? `${p.origen === "manual" ? `${p.cita.doc} ` : ""}p. ${p.cita.pagina}` : "";
  return donde ? `${NOMBRE[p.origen]} · ${donde}` : NOMBRE[p.origen];
}
