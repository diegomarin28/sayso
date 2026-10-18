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

/** Una palabra que puede decir algo (tiene vocal y al menos 2 letras): "dddd" no cuenta. */
const PALABRA = /[a-záéíóúü]*[aeiouáéíóúü][a-záéíóúü]*/gi;

/**
 * Como la recepción real (#249): `claro` es false si no se sabe qué equipo es o qué le pasa
 * ("notebook dddd"); `repregunta` pide lo que falta.
 */
export function entenderSimulado(texto: string): {
  clase: Caso["clase"];
  tipoEquipo: string;
  claro: boolean;
  repregunta?: string;
} {
  const hallado = EQUIPOS.find((e) => e.palabras.test(texto));
  if (!hallado) return { clase: "otro", tipoEquipo: "equipo", claro: false, repregunta: "¿Qué equipo es y qué le pasa?" };
  // Lo que queda sin el nombre del equipo y sin palabras de relleno: ¿dice algún problema?
  const resto = texto.replace(hallado.palabras, " ").toLowerCase();
  const palabras = (resto.match(PALABRA) ?? []).filter((p) => p.length >= 2 && !RELLENO.has(p));
  return palabras.length
    ? { clase: hallado.clase, tipoEquipo: hallado.tipo, claro: true }
    : { clase: hallado.clase, tipoEquipo: hallado.tipo, claro: false, repregunta: `¿Qué le pasa a tu ${hallado.tipo}?` };
}

const RELLENO = new Set(["mi", "el", "la", "los", "las", "un", "una", "de", "del", "tengo", "es"]);

/** La IA (o la simulada) no supo qué equipo es: hay que volver a preguntar. */
export function sinEntender(clase: Caso["clase"], tipoEquipo: string | null | undefined): boolean {
  return clase === "otro" && (!tipoEquipo?.trim() || tipoEquipo.trim().toLowerCase() === "equipo");
}

/**
 * El síntoma para citarlo en «Entendí: es tu … y “…”»: sin la puntuación del final (si no, «“se apaga sola.”.»)
 * y con minúscula solo en la primera letra (un «HDMI» o un modelo quedan como los escribió la persona).
 */
export function sintomaParaCitar(sintoma: string): string {
  const s = sintoma.trim().replace(/[\s.,;:!?…]+$/u, "");
  return s.charAt(0).toLocaleLowerCase("es") + s.slice(1);
}
