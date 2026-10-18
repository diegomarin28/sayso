import type { Caso } from "../../../shared";

/**
 * Recepción SIMULADA para el modo fixture (sin IA): reconoce el equipo por palabras clave, como
 * haría la IA con un texto claro. Si no nombra ningún equipo, devuelve "equipo" (lo mismo que
 * la IA cuando no queda claro) y la pantalla vuelve a preguntar.
 */

const EQUIPOS: { palabras: RegExp; clase: Caso["clase"]; tipo: string }[] = [
  { palabras: /\b(notebook|laptop|netbook|macbook|port[aá]til)\b/i, clase: "notebook", tipo: "notebook" },
  { palabras: /\b(aire|split)\b/i, clase: "split", tipo: "aire acondicionado split" },
  { palabras: /\b(lavarropas|lavasecarropas|lavadora)\b/i, clase: "lavarropas", tipo: "lavarropas" },
  { palabras: /\b(celular|tel[eé]fono|iphone|smartphone)\b/i, clase: "otro", tipo: "celular" },
  { palabras: /\b(tablet|ipad)\b/i, clase: "otro", tipo: "tablet" },
  { palabras: /\b(heladera|freezer)\b/i, clase: "otro", tipo: "heladera" },
  { palabras: /\b(microondas)\b/i, clase: "otro", tipo: "microondas" },
  { palabras: /\b(tele|televisor|tv|smart tv)\b/i, clase: "otro", tipo: "televisor" },
  { palabras: /\b(impresora)\b/i, clase: "otro", tipo: "impresora" },
];

export function entenderSimulado(texto: string): { clase: Caso["clase"]; tipoEquipo: string } {
  const hallado = EQUIPOS.find((e) => e.palabras.test(texto));
  return hallado ? { clase: hallado.clase, tipoEquipo: hallado.tipo } : { clase: "otro", tipoEquipo: "equipo" };
}

/** La IA (o la simulada) no supo qué equipo es: hay que volver a preguntar. */
export function sinEntender(clase: Caso["clase"], tipoEquipo: string | null | undefined): boolean {
  return clase === "otro" && (!tipoEquipo?.trim() || tipoEquipo.trim().toLowerCase() === "equipo");
}
