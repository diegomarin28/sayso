import type { Cita } from "../../shared";
import { codigos, GENERACION, palabras } from "./ifixit";

/**
 * ¿El manual que encontró el bibliotecario es el oficial de ESTE modelo? Lo decide el código, sin IA, antes de
 * que una cita salga VERIFICADO:
 * - Tiene que ser del fabricante (`fuente` la declara el bibliotecario): una página de iFixit o una copia en otro
 *   sitio se leen igual, pero sus citas van NO VERIFICADO.
 * - Su título o su URL tienen que nombrar los códigos del modelo confirmado ("t480", "m4", "13"). Se acepta el código
 *   de la serie ("M404" para "M404dn") y que falte el de la etiqueta ("A2337" de "MacBook Air M1 A2337") si están
 *   los demás. Un modelo sin ningún código ("MacBook Air") solo cuenta si el título tampoco nombra una variante
 *   ("MacBook Air (13-inch, M5)" es una variante que la persona no confirmó).
 * Si no se confirma, el flujo y el costo no cambian: solo baja el estado de las citas. Nada de un modelo ni de una
 * marca escrito acá.
 */

export type Fuente = "fabricante" | "ifixit" | "otro";
export type MotivoSinConfirmar = "tercero" | "sin_modelo" | "otro_modelo";
export type Confirmacion = { oficial: true } | { oficial: false; motivo: MotivoSinConfirmar };

export const TEXTO_SIN_CONFIRMAR: Record<MotivoSinConfirmar, string> = {
  tercero: "no es del sitio del fabricante",
  sin_modelo: "el modelo confirmado no alcanza para saber a qué variante corresponde",
  otro_modelo: "no nombra el modelo confirmado",
};

/** Código de etiqueta o de serie: 1 a 3 letras y 3 o más números ("a2337", "t480", "m404dn", "r860"). */
const ETIQUETA = /^[a-z]{1,3}\d{3,}[a-z0-9]*$/;

const codigosDe = (t: string) => codigos(t.replace(GENERACION, " $1 "));

export function manualDelModelo(modelo: string, manual: { titulo: string; url: string; fuente?: Fuente }): Confirmacion {
  if (manual.fuente !== undefined && manual.fuente !== "fabricante") return { oficial: false, motivo: "tercero" };
  const pedidos = codigosDe(modelo);
  if (!pedidos.length) {
    const titulo = palabras(manual.titulo);
    const todas = palabras(modelo).every((p) => titulo.includes(p));
    return todas && !codigosDe(manual.titulo).length ? { oficial: true } : { oficial: false, motivo: "sin_modelo" };
  }
  const texto = palabras(`${manual.titulo.replace(GENERACION, " $1 ")} ${manual.url}`);
  // "m404" en el texto vale para "m404dn": el manual es de la serie. Solo con letras y números (un "13" suelto no).
  const nombra = (k: string) => texto.includes(k) || texto.some((x) => x.length >= 3 && /\d/.test(x) && /[a-z]/.test(x) && k.startsWith(x));
  const comunes = pedidos.filter((k) => !ETIQUETA.test(k));
  const etiquetas = pedidos.filter((k) => ETIQUETA.test(k));
  const ok = comunes.every(nombra) && (comunes.length > 0 || etiquetas.some(nombra));
  return ok ? { oficial: true } : { oficial: false, motivo: "otro_modelo" };
}

/** Las citas VERIFICADO pasan a NO_VERIFICABLE (se siguen mostrando con su página o su URL). */
export function sinVerificar<T extends { cita?: Cita }>(items: T[]): T[] {
  return items.map((x) => (x.cita?.estado === "VERIFICADO" ? { ...x, cita: { ...x.cita, estado: "NO_VERIFICABLE" as const } } : x));
}
