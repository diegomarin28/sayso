import indice from "../../public/models/piezas/indice.json";
import { IndicePiezas, tipoDe } from "./biblioteca";

/**
 * Tipos de pieza que la biblioteca 3D sabe dibujar, como prefijos de id (`ventilador_evaporador` → `ventilador`).
 * Sale de `public/models/piezas/indice.json` (lo escribe el script de Blender), así que no se desactualiza.
 * Para sugerirle a la IA ids que el visor reconoce (ej. en `lib/knowledge/armar.ts`). Un id que no empiece
 * con ninguno igual funciona: se dibuja con la primitiva del plano.
 */
export type TipoDePieza = { tipo: string; familia: string; descripcion: string; variantes: string[] };

const INDICE = IndicePiezas.parse(indice);

export const TIPOS_DE_PIEZA: TipoDePieza[] = (() => {
  const porTipo = new Map<string, TipoDePieza>();
  for (const [nombre, t] of Object.entries(INDICE.tipos)) {
    const tipo = tipoDe(nombre);
    const actual = porTipo.get(tipo) ?? { tipo, familia: t.familia, descripcion: t.descripcion, variantes: [] };
    if (nombre === tipo) Object.assign(actual, { familia: t.familia, descripcion: t.descripcion });
    else actual.variantes.push(nombre.slice(tipo.length + 1));
    porTipo.set(tipo, actual);
  }
  return [...porTipo.values()];
})();

/** Una línea por tipo, para pegar en un prompt: "ventilador: Ventilador centrífugo… (variantes: axial, tangencial)". */
export function tiposParaPrompt(): string {
  return TIPOS_DE_PIEZA.filter((t) => !t.tipo.endsWith("_dato")).map((t) => `${t.tipo}: ${t.descripcion}${t.variantes.length ? ` (variantes: ${t.variantes.join(", ")})` : ""}`).join("\n");
}
