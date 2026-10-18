import type { PiezaPlano, PlanoDePiezas, Vec3 } from "../../shared";

/**
 * Suma a un plano guardado las piezas que la IA ubicó en una página del manual en un plano nuevo
 * (generado solo con las piezas que faltaban). Los dos planos son del mismo modelo, pero la carcasa
 * puede tener otras medidas: cada pieza se lleva de la carcasa nueva a la guardada, escalada por eje
 * (como `seguirPlantilla`). Solo entran las de origen "manual": lo estimado lo resuelve el esqueleto
 * del tipo en `terminarPlano`, igual que en el plano guardado. Si el guardado ya tenía esa pieza
 * (sumada del esqueleto o suelta), la del manual la reemplaza.
 */
export function sumarDelManual(guardado: PlanoDePiezas, nuevo: PlanoDePiezas, ids: string[]): { plano: PlanoDePiezas; sumadas: string[] } {
  const raiz = guardado.piezas.find((p) => !p.padre);
  const raizN = nuevo.piezas.find((p) => !p.padre);
  const pedidas = new Set(ids);
  const delManual = nuevo.piezas.filter((p) => p !== raizN && pedidas.has(p.pieza) && p.origen === "manual");
  if (!raiz || !raizN || !delManual.length) return { plano: guardado, sumadas: [] };

  const escala = raizN.dim.map((v, i) => raiz.dim[i] / Math.max(v, 1e-6));
  const cambian = new Set(delManual.map((p) => p.pieza));
  const quedan = guardado.piezas.filter((p) => !cambian.has(p.pieza));
  const existe = new Set([...quedan.map((p) => p.pieza), ...cambian]);
  const llevada = (p: PiezaPlano): PiezaPlano => ({
    ...p,
    pos: p.pos.map((v, i) => +(raiz.pos[i] + (v - raizN.pos[i]) * escala[i]).toFixed(2)) as Vec3,
    dim: p.dim.map((v, i) => +(v * escala[i]).toFixed(2)) as Vec3,
    padre: p.padre && p.padre !== raizN.pieza && existe.has(p.padre) ? p.padre : raiz.pieza,
  });
  return { plano: { ...guardado, piezas: [...quedan, ...delManual.map(llevada)] }, sumadas: [...cambian] };
}
