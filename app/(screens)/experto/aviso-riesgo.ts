import type { KnowledgePack } from "../../../shared";

/** Largo máximo del texto corto del paso de riesgo alto. */
const MAX_CORTO = 70;

/** La primera oración del paso, recortada si es larga. */
function corto(texto: string): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  const oracion = limpio.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? limpio;
  const sinPunto = oracion.replace(/[.!?]+$/, "");
  return sinPunto.length > MAX_CORTO ? `${sinPunto.slice(0, MAX_CORTO - 1).trimEnd()}…` : sinPunto;
}

/**
 * Aviso antes del primer paso de la guía: si el pack tiene un paso de riesgo alto, hasta dónde llega la guía.
 * Lo arma el código con los datos del pack (sin IA). Sin pasos de riesgo alto, null: no se muestra nada.
 * No bloquea nada: el bloqueo de los pasos sigue en el visor (filtrarCoreografia) y en el cierre.
 */
export function avisoRiesgoAlto(pack: KnowledgePack): string | null {
  const alto = [...pack.pasos].sort((a, b) => a.orden - b.orden).find((p) => p.riesgo === "alto");
  if (!alto) return null;
  const n = alto.orden;
  return `Antes de empezar: esta guía te explica hasta el paso ${n}. El paso ${n} (riesgo alto: ${corto(alto.texto)}) no lo animamos: ahí te recomendamos llevarlo a un técnico.`;
}
