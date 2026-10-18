import type { Accion, Coreografia, Pieza, PiezaPlano, PlanoDePiezas, Vec3 } from "../../../shared";
import { ES_TAPA } from "../../../lib/planogenerator/cubiertas";
import { ladosDelPlano, type Lado } from "../lados";
import { resolverPieza } from "../reproductor";

/**
 * Desarme en vivo con el mismo modelo (#233): cuando un paso dice que se saca una tapa ("sacá la tapa
 * trasera", "despegá la pantalla", "levantá la cubierta") o sus tornillos, y la guía no movió nada, el 3D lo
 * hace: la tapa (o la pantalla de una tablet) se levanta y queda al costado del equipo, y los tornillos se
 * desvanecen. Mover la tapa abre el equipo y lleva la cámara a ese lado (ver `ladosDelPlano`).
 * Solo equipos acostados (celular, tablet, notebook, reloj), solo piezas del plano, nunca en un paso
 * bloqueado. Sin IA: compara el texto del paso con las piezas del plano, por tipo y nunca por modelo.
 */

/** "Sacá", "levantá", "despegá", "quitá", "retirá", "separá", "abrí" (y "sacar", "levantando"...). */
const SACAR = "(?:sac|saq|levant|despeg|quit|retir|separ|abr)\\w*";
/** Lo que puede ir entre el verbo y la pieza: "sacá con cuidado la tapa", "levantá y despegá la pantalla". */
const ENTRE = "(?:(?:el|la|los|las|con|cuidado|suavemente|despacio|toda|todo|completamente|y|de|a|poco)\\s+){0,4}";
/** Lo que nombra cualquier tapa (si el plano tiene una sola): "la tapa", "la cubierta", "la carcasa trasera". */
const NOMBRES_DE_TAPA = ["tapa", "cubierta", "carcasa trasera", "carcasa inferior", "panel trasero", "panel posterior"];
/** La tapa queda al costado del equipo, separada por esta parte de su ancho. */
const SEPARACION = 0.12;

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const dice = (t: string, nombre: string) => new RegExp(`(?:^| )${SACAR} ${ENTRE}${escapar(nombre)}s?(?: |$)`).test(t);

/** La tapa (o la pantalla) que el paso dice que se saca, con el nombre más largo que aparezca. */
function tapaQueSaca(texto: string, plano: PlanoDePiezas, candidatas: string[], piezas: Pick<Pieza, "id" | "nombre">[]): PiezaPlano | undefined {
  const tapas = candidatas.filter((id) => ES_TAPA.test(id));
  let mejor: { id: string; largo: number } | undefined;
  for (const id of candidatas) {
    const nombres = [normalizar(id.replace(/_/g, " ")), ...piezas.filter((p) => p.id === id).map((p) => normalizar(p.nombre))];
    // La pantalla de una tablet se nombra "pantalla" aunque su id sea "pantalla_lcd"; una tapa sola, "la tapa".
    nombres.push(normalizar(id.split("_")[0]));
    if (tapas.length === 1 && tapas[0] === id) nombres.push(...NOMBRES_DE_TAPA);
    for (const n of nombres) if (n.length >= 4 && dice(texto, n) && (!mejor || n.length > mejor.largo)) mejor = { id, largo: n.length };
  }
  return mejor && plano.piezas.find((p) => p.pieza === mejor.id);
}

/** Hacia dónde se corre la tapa: un poco hacia afuera (su lado) y al costado del equipo, para que no tape lo de adentro. */
function aUnCostado(tapa: PiezaPlano, plano: PlanoDePiezas, lado: Lado): Vec3 {
  const ancho = Math.max(...plano.piezas.map((p) => p.pos[0] + p.dim[0] / 2)) - Math.min(...plano.piezas.map((p) => p.pos[0] - p.dim[0] / 2));
  const afuera = Math.max(tapa.dim[1] * 3, 0.5) * (lado === "arriba" ? 1 : -1);
  return [ancho * (1 + SEPARACION), afuera, 0];
}

/** Si el paso dice que se saca una tapa o sus tornillos y no mueve nada, le suma moverla y desvanecerlos. */
export function conDesarme(c: Coreografia, plano: PlanoDePiezas, piezas: Pick<Pieza, "id" | "nombre">[] = []): Coreografia {
  if (c.riesgo === "alto" || c.acciones.some((a) => a.t === "ocultar" || a.t === "desplazar" || a.t === "rotar" || a.t === "despiezar")) return c;
  const lados = ladosDelPlano(plano);
  if (!lados) return c;
  const texto = normalizar(c.dice);
  const ids = plano.piezas.map((p) => p.pieza);
  const extra: Accion[] = [];

  if (dice(texto, "tornillo")) {
    const resaltados = c.acciones.flatMap((a) => (a.t === "resaltar" ? [resolverPieza(a.pieza, ids)] : [])).filter((id) => id?.startsWith("tornillo"));
    const tornillos = resaltados.length ? resaltados : ids.filter((id) => id.startsWith("tornillo"));
    for (const pieza of new Set(tornillos)) extra.push({ t: "ocultar", pieza: pieza! });
  }
  const tapa = tapaQueSaca(texto, plano, Object.keys(lados.piezas), piezas);
  if (tapa) extra.push({ t: "desplazar", pieza: tapa.pieza, vec: aUnCostado(tapa, plano, lados.piezas[tapa.pieza]) });

  return extra.length ? { ...c, acciones: [...c.acciones, ...extra] } : c;
}
