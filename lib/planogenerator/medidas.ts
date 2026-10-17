import type { ClaseEquipo } from "../../shared";
import { planoNotebookBase } from "./plantillas/notebook";

/**
 * Medidas de la carcasa en la planta (ancho × profundidad, en cm).
 * La IA las lee del manual o las estima para ese modelo; el código las valida con los límites
 * físicos de la CLASE de equipo (un celular de 7,4 cm es válido; una notebook de 7,4 cm no) y
 * marca como "estimada" la que no salió del manual.
 */

export type OrigenMedida = "manual" | "estimada";
export type Medida = { cm: number; origen: OrigenMedida };
export type MedidasBase = { ancho: Medida; prof: Medida };

/**
 * Lo que puede medir un lado de la planta en cada clase: fuera de esto es un error de lectura.
 * "otro" (celular, tablet, consola, heladera…) solo descarta lo absurdo.
 */
export const LIMITES_MEDIDA_CM: Record<ClaseEquipo, { min: number; max: number }> = {
  notebook: { min: 15, max: 60 },
  split: { min: 10, max: 130 },
  lavarropas: { min: 30, max: 90 },
  otro: { min: 1, max: 300 },
};

const basePlantilla = planoNotebookBase.piezas.find((p) => p.pieza === "base")!.dim;

/**
 * Medida típica de la clase, para cuando falta (siempre queda "estimada"). La de la plantilla de
 * notebook es solo para notebooks; "otro" no tiene: se deduce de la otra medida o de la escala.
 */
export const MEDIDA_TIPICA_CM: Record<ClaseEquipo, { ancho: number; prof: number } | null> = {
  notebook: { ancho: basePlantilla[0], prof: basePlantilla[2] },
  split: { ancho: 90, prof: 25 },
  lavarropas: { ancho: 60, prof: 60 },
  otro: null,
};

/** Sin ninguna medida ni típica de la clase: escala aproximada (el plano igual se ve proporcionado). */
const SIN_REFERENCIA_CM = 20;

export type MedidasPropuestas = { ancho: number | null; prof: number | null; fuente?: OrigenMedida | null };

export function resolverMedidas(clase: ClaseEquipo, propuesta: MedidasPropuestas, avisos: string[]): MedidasBase {
  const limites = LIMITES_MEDIDA_CM[clase];
  // Sin fuente declarada, no se presume que salió del manual.
  const origen: OrigenMedida = propuesta.fuente === "manual" ? "manual" : "estimada";
  const valida = (v: number | null, nombre: string): number | null => {
    if (v === null) return null;
    if (!Number.isFinite(v) || v <= 0 || v < limites.min || v > limites.max) {
      avisos.push(`La IA dio un ${nombre} de base de ${v} cm, imposible para ${nombreClase(clase)} (${limites.min}–${limites.max} cm): se descarta.`);
      return null;
    }
    return v;
  };
  const ancho = valida(propuesta.ancho, "ancho");
  const prof = valida(propuesta.prof, "profundidad");
  const tipica = MEDIDA_TIPICA_CM[clase];
  const dentro = (v: number) => Math.min(Math.max(v, limites.min), limites.max);

  if (ancho !== null && prof !== null) return { ancho: { cm: ancho, origen }, prof: { cm: prof, origen } };
  if (ancho !== null || prof !== null) {
    // Una sola: la otra sale de la proporción típica de la clase (o igual, si no hay típica).
    const proporcion = tipica ? tipica.prof / tipica.ancho : 1;
    const resultado =
      ancho !== null
        ? { ancho: { cm: ancho, origen }, prof: { cm: dentro(ancho * proporcion), origen: "estimada" as const } }
        : { ancho: { cm: dentro(prof! / proporcion), origen: "estimada" as const }, prof: { cm: prof!, origen } };
    avisos.push(`Falta ${ancho === null ? "el ancho" : "la profundidad"} de la carcasa: se estima en ${(ancho === null ? resultado.ancho : resultado.prof).cm.toFixed(1)} cm.`);
    return resultado;
  }
  const cm = tipica ?? { ancho: SIN_REFERENCIA_CM, prof: SIN_REFERENCIA_CM };
  avisos.push(
    tipica
      ? `No hay medidas de la carcasa: se usan las típicas de ${nombreClase(clase)} (${cm.ancho} × ${cm.prof} cm, estimadas).`
      : `No hay medidas de la carcasa: el 3D va a escala aproximada (${cm.ancho} × ${cm.prof} cm, estimadas).`,
  );
  return { ancho: { cm: cm.ancho, origen: "estimada" }, prof: { cm: cm.prof, origen: "estimada" } };
}

function nombreClase(clase: ClaseEquipo): string {
  return { notebook: "una notebook", split: "un split", lavarropas: "un lavarropas", otro: "este equipo" }[clase];
}
