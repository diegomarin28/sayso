import { vistaEnImagen, type PiezaPlano, type PlanoDePiezas, type Vec3 } from "../../shared";
import { ES_CUBIERTA } from "./cubiertas";
import { ENVOLTURA_EN_FOTOS } from "./fotos-guia";

/**
 * Lo que no se vio no pisa lo que se vio (#235). Una pieza que no salió del manual ni de una foto (estimada o
 * del esqueleto del tipo) puede caer encima de una que sí se vio (la placa genérica de una tablet sobre la
 * batería que se ve en la foto). Esa se corre al lugar libre más cercano dentro del equipo, con lo que lleva
 * encima. Sin IA y por geometría: la planta es la cara grande de la carcasa (sirve acostado o parado), nunca
 * por marca ni modelo. Lo visto no se mueve nunca.
 */

/** Cuántos lugares se prueban por eje de la planta. */
const PASOS = 40;
/** Un solape menor que esto (cm) es roce de bordes, no "encima". */
const ROCE_CM = 0.05;
/** Una pieza que ocupa al menos esta parte de la planta es una capa (retroiluminación, chasis): no se corre. */
const CAPA = 0.5;

/** La envoltura (carcasa, marco, pantalla, tapas) no es una pieza que pise ni que se corra. */
const esEnvoltura = (p: PiezaPlano) => !p.padre || ES_CUBIERTA.test(p.pieza) || ENVOLTURA_EN_FOTOS.test(p.pieza);

type Rect = { min: [number, number]; max: [number, number] };

export function sinPisarLoVisto(plano: PlanoDePiezas): { plano: PlanoDePiezas; avisos: string[] } {
  const raiz = plano.piezas.find((p) => !p.padre);
  if (!raiz) return { plano, avisos: [] };
  // La planta: los dos lados más grandes de la carcasa (x-z si está acostado, x-y si está parado).
  const [a, b] = [0, 1, 2].sort((i, j) => raiz.dim[j] - raiz.dim[i]).slice(0, 2).sort();
  const rect = (pos: Vec3, dim: Vec3): Rect => ({
    min: [pos[a] - dim[a] / 2, pos[b] - dim[b] / 2],
    max: [pos[a] + dim[a] / 2, pos[b] + dim[b] / 2],
  });
  const pisa = (r: Rect, s: Rect) => Math.min(r.max[0], s.max[0]) - Math.max(r.min[0], s.min[0]) > ROCE_CM && Math.min(r.max[1], s.max[1]) - Math.max(r.min[1], s.min[1]) > ROCE_CM;
  const equipo = rect(raiz.pos, raiz.dim);
  const areaEquipo = (equipo.max[0] - equipo.min[0]) * (equipo.max[1] - equipo.min[1]);

  const porId = new Map(plano.piezas.map((p) => [p.pieza, p]));
  const ancestros = (p: PiezaPlano) => {
    const lista: string[] = [];
    for (let q = p.padre ? porId.get(p.padre) : undefined; q && !lista.includes(q.pieza); q = q.padre ? porId.get(q.padre) : undefined) lista.push(q.pieza);
    return lista;
  };
  const vistas = plano.piezas.filter((p) => vistaEnImagen(p.origen) && !esEnvoltura(p));
  if (!vistas.length) return { plano, avisos: [] };
  // Lo que va montado sobre una vista (o lleva una vista encima) se queda con ella.
  const conVista = new Set(vistas.flatMap((v) => [v.pieza, ...ancestros(v)]));
  const sobreVista = (p: PiezaPlano) => ancestros(p).some((id) => vistas.some((v) => v.pieza === id));
  const movibles = plano.piezas.filter(
    (p) => !vistaEnImagen(p.origen) && !esEnvoltura(p) && !conVista.has(p.pieza) && !sobreVista(p) && p.dim[a] * p.dim[b] < CAPA * areaEquipo,
  );

  const desplazo = new Map<string, [number, number]>();
  const lugar = new Map(plano.piezas.map((p) => [p.pieza, rect(p.pos, p.dim)]));
  const avisos: string[] = [];
  for (const p of [...movibles].sort((x, y) => y.dim[a] * y.dim[b] - x.dim[a] * x.dim[b])) {
    const actual = lugar.get(p.pieza)!;
    const pisadas = vistas.filter((v) => pisa(actual, lugar.get(v.pieza)!));
    if (!pisadas.length) continue;
    const [w, h] = [actual.max[0] - actual.min[0], actual.max[1] - actual.min[1]];
    // Primero un lugar que no pise nada del interior; si no hay, uno que al menos no pise lo visto.
    const otras = plano.piezas.filter((q) => q !== p && !esEnvoltura(q) && !ancestros(q).includes(p.pieza) && !ancestros(p).includes(q.pieza));
    const elegido = masCercano(actual, w, h, equipo, otras.map((q) => lugar.get(q.pieza)!), pisa) ?? masCercano(actual, w, h, equipo, vistas.map((v) => lugar.get(v.pieza)!), pisa);
    const nombres = pisadas.map((v) => `"${v.pieza}"`).join(", ");
    if (!elegido) {
      avisos.push(`"${p.pieza}" no se ve en el manual ni en las fotos y queda encima de ${nombres}: no hay lugar libre en el equipo.`);
      continue;
    }
    const d: [number, number] = [elegido.min[0] - actual.min[0], elegido.min[1] - actual.min[1]];
    lugar.set(p.pieza, elegido);
    desplazo.set(p.pieza, d);
    avisos.push(`"${p.pieza}" no se ve en el manual ni en las fotos y quedaba encima de ${nombres}: se corre al lugar libre más cercano.`);
  }
  if (!desplazo.size) return { plano, avisos };

  // Cada pieza corrida se lleva lo que tiene encima (sus hijas, nietas…).
  const mover = (p: PiezaPlano): PiezaPlano => {
    const d = [p.pieza, ...ancestros(p)].map((id) => desplazo.get(id)).find(Boolean);
    if (!d) return p;
    const pos = [...p.pos] as Vec3;
    pos[a] += d[0];
    pos[b] += d[1];
    return { ...p, pos };
  };
  return { plano: { ...plano, piezas: plano.piezas.map(mover) }, avisos };
}

/** El lugar más cercano (de su centro al de hoy) donde el rectángulo entra en el equipo sin pisar `obstaculos`. */
function masCercano(actual: Rect, w: number, h: number, equipo: Rect, obstaculos: Rect[], pisa: (r: Rect, s: Rect) => boolean): Rect | null {
  const [ancho, alto] = [equipo.max[0] - equipo.min[0], equipo.max[1] - equipo.min[1]];
  if (w > ancho || h > alto) return null;
  let mejor: { r: Rect; d: number } | null = null;
  for (let i = 0; i <= PASOS; i++) {
    for (let j = 0; j <= PASOS; j++) {
      const x = equipo.min[0] + ((ancho - w) * i) / PASOS;
      const y = equipo.min[1] + ((alto - h) * j) / PASOS;
      const r: Rect = { min: [x, y], max: [x + w, y + h] };
      if (obstaculos.some((o) => pisa(r, o))) continue;
      const d = (x - actual.min[0]) ** 2 + (y - actual.min[1]) ** 2;
      if (!mejor || d < mejor.d) mejor = { r, d };
    }
  }
  return mejor?.r ?? null;
}
