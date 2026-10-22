import type { KnowledgePack } from "../../../shared";

export type SospechaParaMostrar = {
  nombre: string;
  porque: string;
  chequeo: string;
  /** Solo la primera (la más probable) va destacada. */
  destacada: boolean;
};

/** "ventilador_trasero" → "Ventilador trasero". */
function idLegible(id: string): string {
  const texto = id.replace(/_+/g, " ").trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Las piezas sospechosas del pack (diagnóstico previo de la IA), de la más probable a la menos, listas para
 * mostrar en «Tu guía». El nombre sale de la pieza del pack cuyo id empieza con `pieza` (la exacta primero);
 * si no hay, el id legible. Sin el campo (packs viejos) o vacío: [] y no se muestra nada. Sin IA.
 */
export function sospechasParaMostrar(pack: KnowledgePack): SospechaParaMostrar[] {
  return (pack.sospechosas ?? []).map((s, i) => {
    const delPack =
      pack.piezas.find((p) => p.id === s.pieza) ?? pack.piezas.find((p) => p.id.startsWith(s.pieza));
    return {
      nombre: delPack?.nombre.trim() || idLegible(s.pieza),
      porque: s.porque.trim(),
      chequeo: s.chequeo.trim(),
      destacada: i === 0,
    };
  });
}
