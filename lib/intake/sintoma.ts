/** Reglas sobre el síntoma que cuenta la persona. Sin dependencias: lo usa también la pantalla. */

/** "No prende", "no enciende", "no arranca", "no da imagen", "está muerto"… (sobre el texto sin tildes). */
const NO_PRENDE = /\bno\s+(me\s+)?(prende|enciende|arranca|inicia|bootea|da\s+(imagen|senales))\b|\b(muert[oa]|no\s+hace\s+nada)\b/;

const sinTildes = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** ¿El síntoma dice que el equipo no prende? Entonces no se pide nada con el equipo prendido (#229). */
export function noPrende(sintoma: string | null | undefined): boolean {
  return !!sintoma && NO_PRENDE.test(sinTildes(sintoma));
}
