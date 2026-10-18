import type { KnowledgePack } from "@/shared";

/** Una pieza que se puede buscar para comprar. Sin número de parte se busca por el modelo del equipo. */
export type ItemCompra = { pieza: string; numeroParte: string | null; pagina?: number };

/** Tope de piezas del panel cuando no hay números de parte: las que aparecen en los pasos, primero. */
const MAX_SIN_NUMERO = 6;

/**
 * Qué piezas ofrecer para comprar:
 * 1. la que el experto dijo que hay que cambiar;
 * 2. las que tienen número de parte citado en el manual;
 * 3. si no hay ninguna con número (ej. un manual que no los trae), las piezas de la guía, para buscar
 *    por modelo. Así siempre hay un camino para comprar.
 */
export function piezasParaComprar(pack: KnowledgePack, piezaACambiar?: string | null): ItemCompra[] {
  const items: ItemCompra[] = pack.repuestos.map((r) => ({ pieza: r.pieza, numeroParte: r.numeroParte, pagina: r.cita.pagina }));
  if (items.length === 0) {
    const enPasos = new Set(pack.pasos.flatMap((p) => p.piezas));
    const piezas = [...pack.piezas].sort((a, b) => Number(enPasos.has(b.id)) - Number(enPasos.has(a.id)));
    items.push(...piezas.slice(0, MAX_SIN_NUMERO).map((p) => ({ pieza: p.id, numeroParte: null })));
  }
  if (piezaACambiar) {
    const i = items.findIndex((r) => r.pieza === piezaACambiar);
    const [elegida] = i >= 0 ? items.splice(i, 1) : [{ pieza: piezaACambiar, numeroParte: null }];
    items.unshift(elegida);
  }
  return items;
}
