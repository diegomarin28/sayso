import type { Accion, Coreografia } from "../../shared";
import { resolverPieza, type Lados } from "./reproductor";

/**
 * Desarme en vivo con el mismo modelo (#233): si un paso dice que se saca algo ("sacá", "despegá",
 * "levantá"…) y nombra una cara del equipo (la tapa trasera, la pantalla de una tablet) o sus tornillos,
 * la coreografía suma lo que se ve hacer: los tornillos de esa cara desaparecen y la cara se levanta y se
 * desvanece. Mover la cara abre el equipo y lo da vuelta para que quede arriba (ver `aplicarAccion`).
 * Por TIPO (las caras salen de la forma del equipo, ver `ladosDe`), nunca por marca ni modelo. Si la guía
 * ya mueve o esconde la cara, no se suma nada.
 */

/** Sacar, despegar, levantar, quitar, retirar, separar, extraer, desatornillar (con o sin pronombre). */
const SACA = /\b(sac[aá]|saque|levant[aá]|despeg[aá]|quit[aá]|retir[aá]|separ[aá]|extra[eé]|desatornill[aá])/i;
const NOMBRA_TORNILLOS = /tornillo/i;
/** Cuánto se levanta la cara antes de desvanecerse: esta parte del lado mayor del equipo. */
export const LEVANTAR = 0.2;

const normal = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** `largo`: el lado mayor del equipo en cm (cuánto se levanta la cara). */
export function conDesarme(coreografia: Coreografia, lados: Lados | undefined, ids: Iterable<string>, largo: number): Coreografia {
  if (!lados || !SACA.test(coreografia.dice)) return coreografia;
  const lista = [...ids];
  const nombradas = coreografia.acciones.flatMap((a) => {
    const id = "pieza" in a ? a.pieza : a.t === "camara" ? a.objetivo : undefined;
    const pieza = id === undefined ? undefined : resolverPieza(id, lista);
    return pieza ? [pieza] : [];
  });
  // La cara que nombra el paso: en sus acciones o en el texto ("despegá la pantalla", "la tapa trasera").
  const texto = ` ${normal(coreografia.dice)} `;
  const cara =
    nombradas.find((id) => id in lados.caras) ?? Object.keys(lados.caras).find((id) => texto.includes(` ${normal(id)} `));
  const tornillosNombrados = nombradas.filter((id) => id in lados.tornillos);
  const tornillosDeCara = cara ? Object.keys(lados.tornillos).filter((id) => lados.tornillos[id] === lados.caras[cara]) : [];
  const yaLaMueve = (id: string) => coreografia.acciones.some((a) => "pieza" in a && a.t !== "resaltar" && resolverPieza(a.pieza, lista) === id);

  const extra: Accion[] = [];
  if (NOMBRA_TORNILLOS.test(coreografia.dice)) {
    // "Sacá los tornillos de la tapa": solo los tornillos (la tapa sale en otro paso).
    const tornillos = tornillosNombrados.length ? tornillosNombrados : tornillosDeCara;
    for (const pieza of tornillos) if (!yaLaMueve(pieza)) extra.push({ t: "ocultar", pieza });
  } else if (cara && !yaLaMueve(cara)) {
    for (const pieza of tornillosDeCara) extra.push({ t: "ocultar", pieza });
    // Se levanta hacia afuera (su lado, en ejes del plano) y se desvanece.
    extra.push({ t: "desplazar", pieza: cara, vec: [0, lados.caras[cara] * LEVANTAR * largo, 0] });
    extra.push({ t: "ocultar", pieza: cara });
  }
  return extra.length ? { ...coreografia, acciones: [...coreografia.acciones, ...extra] } : coreografia;
}
