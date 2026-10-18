import type { Accion, Coreografia, Evento, Vec3 } from "../../shared";
import { ES_TAPA } from "../../lib/planogenerator/cubiertas";

/**
 * Lógica pura del reproductor de coreografía: recibe acciones validadas por Zod
 * y calcula el estado OBJETIVO de la escena. La animación (suavizado cuadro a
 * cuadro) la hace el visor; acá no hay three.js.
 *
 * Semántica de las acciones (todas idempotentes: repetir un paso no acumula):
 * - `rotar`: deja la pieza girada `grados` en ese eje respecto de su posición de reposo.
 * - `desplazar`: deja la pieza corrida `vec` cm respecto de su reposo (ejes del padre).
 * - `resaltar`: se suma a los resaltados del paso actual. Cada paso nuevo limpia los anteriores.
 * - `ocultar`: la pieza se desvanece. `restaurar` vuelve todo al reposo.
 * - `despiezar`: separa todas las piezas; `cantidad` 0 = armado, 1 = despiece completo.
 * - `camara`: encuadra una pieza (o "general" para ver todo) con un `zoom` opcional.
 *
 * Cerrado / abierto: el equipo arranca CERRADO (tapas y carcasas opacas, sin rayos X). Se abre cuando
 * un paso saca o mueve una tapa (`ocultar`, `desplazar` o `rotar` una cubierta; la carcasa raíz no se
 * abre al girarla: girar el TV no es abrirlo) o despieza. Se cierra con `restaurar`, al armar
 * (`despiezar` 0) o con un paso que solo vuelve a la vista general (las tapas vuelven a su lugar).
 *
 * En la mano / dado vuelta (#233): un equipo acostado con caras que se sacan (`Lados`: la pantalla y las tapas
 * de un celular o una tablet) arranca con la pantalla hacia arriba, como se ve en la mano. Al sacar o mover
 * una cara, el equipo se da vuelta para que esa cara quede arriba; al cerrarse, vuelve a la pantalla.
 */

export const OBJETIVO_GENERAL = "general";

export type EstadoPieza = {
  rot: Vec3; // radianes
  desp: Vec3; // cm
  visible: boolean;
  resaltada: boolean;
};

/** Qué piezas tapan el equipo: "tapa" (tapas, puertas, carcasas hijas) o "raiz" (la carcasa de la que cuelga todo). */
export type Cubiertas = Record<string, "tapa" | "raiz">;

/** Lado del plano (eje y) de cada cara: 1 arriba, -1 abajo. */
export type Lado = 1 | -1;

/**
 * Las caras de un equipo acostado (#233): lo que se saca para abrirlo desde arriba o desde abajo (la pantalla,
 * la tapa trasera), con su lado; `frente`, el lado de la pantalla (el que se ve en la mano); y los tornillos que
 * sujetan cada cara (los de ese lado).
 */
export type Lados = {
  frente: Lado;
  caras: Record<string, Lado>;
  tornillos: Record<string, Lado>;
  /** De qué lado de la carcasa está lo de adentro (en un celular, del lado de la tapa trasera). */
  adentro: Lado;
};

export type EstadoEscena = {
  piezas: Record<string, EstadoPieza>;
  despiece: number;
  camara: { objetivo: string; zoom: number };
  /** Abierto: las cubiertas se ven translúcidas (rayos X). Cerrado (o sin dato): opacas. */
  abierto?: boolean;
  cubiertas?: Cubiertas;
  lados?: Lados;
  /** Dado vuelta: arriba queda el lado de abajo del plano (la pantalla de un celular, que se modela abajo). */
  volteado?: boolean;
};

export type ContextoEventos = { casoId: string };

const reposo = (): EstadoPieza => ({ rot: [0, 0, 0], desp: [0, 0, 0], visible: true, resaltada: false });

export function estadoInicial(piezas: Iterable<string>, cubiertas: Cubiertas = {}, lados?: Lados): EstadoEscena {
  const estado: EstadoEscena = {
    piezas: {},
    despiece: 0,
    camara: { objetivo: OBJETIVO_GENERAL, zoom: 1 },
    abierto: false,
    cubiertas,
    ...(lados ? { lados, volteado: lados.frente === -1 } : {}),
  };
  for (const id of piezas) estado.piezas[id] = reposo();
  return estado;
}

const EJE = { x: 0, y: 1, z: 2 } as const;

/** Aplica una acción. Si nombra una pieza que no existe, no cambia nada y devuelve un evento. */
/** Para comparar ids: sin mayúsculas, tildes ni espacios ("Batería principal" ~ "bateria_principal"). */
const comparable = (id: string) => id.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim().replace(/[\s-]+/g, "_");

/**
 * La pieza del plano a la que se refiere la guía cuando no usa el id exacto (la IA escribe "bateria" y el
 * plano tiene "bateria_iphone13", o al revés): igual sin mayúsculas ni tildes; si no, la única del plano
 * que empieza con lo nombrado; si no, la más larga del plano con la que empieza lo nombrado; y una tapa
 * con el nombre del manual ("cubierta_trasera", "carcasa_inferior") es la tapa del plano, si hay una sola.
 * Si hay dudas (dos candidatas), ninguna: mejor no mover nada que mover la pieza equivocada.
 */
export function resolverPieza(nombrada: string, ids: Iterable<string>): string | undefined {
  const lista = [...ids];
  if (lista.includes(nombrada)) return nombrada;
  const n = comparable(nombrada);
  const iguales = lista.filter((id) => comparable(id) === n);
  if (iguales.length === 1) return iguales[0];
  const empiezan = lista.filter((id) => comparable(id).startsWith(`${n}_`));
  if (empiezan.length === 1) return empiezan[0];
  const prefijos = lista.filter((id) => n.startsWith(`${comparable(id)}_`)).sort((a, b) => b.length - a.length);
  if (prefijos.length && (prefijos.length === 1 || prefijos[0].length > prefijos[1].length)) return prefijos[0];
  const tapas = ES_TAPA.test(n) ? lista.filter((id) => ES_TAPA.test(comparable(id))) : [];
  return tapas.length === 1 ? tapas[0] : undefined;
}

export function aplicarAccion(
  estado: EstadoEscena,
  original: Accion,
  ctx: ContextoEventos,
): { estado: EstadoEscena; evento?: Evento } {
  const nombrada = "pieza" in original ? original.pieza : original.t === "camara" ? original.objetivo : undefined;
  const esGeneral = original.t === "camara" && nombrada === OBJETIVO_GENERAL;
  const pieza = nombrada === undefined || esGeneral ? nombrada : resolverPieza(nombrada, Object.keys(estado.piezas));
  if (nombrada !== undefined && pieza === undefined) {
    return { estado, evento: eventoPiezaDesconocida(nombrada, original, ctx) };
  }
  // Con el id del plano (si la guía lo nombró de otra forma).
  const accion: Accion =
    pieza === nombrada || pieza === undefined ? original : "pieza" in original ? { ...original, pieza } : original.t === "camara" ? { ...original, objetivo: pieza } : original;

  const piezas = { ...estado.piezas };
  const cambiar = (id: string, f: (p: EstadoPieza) => EstadoPieza) => (piezas[id] = f(piezas[id]));
  const cubierta = pieza !== undefined ? estado.cubiertas?.[pieza] : undefined;
  const cara = pieza !== undefined ? estado.lados?.caras[pieza] : undefined;
  // Sacar o mover una tapa (o una cara, como la pantalla de una tablet) abre el equipo (girar la carcasa raíz, no).
  const abre =
    (accion.t === "ocultar" || accion.t === "desplazar") && (!!cubierta || !!cara) ? true : accion.t === "rotar" && (cubierta === "tapa" || !!cara) ? true : undefined;
  // Y el equipo se da vuelta para que esa cara quede arriba.
  const volteo = abre && cara ? { volteado: cara === -1 } : {};

  switch (accion.t) {
    case "camara":
      return { estado: { ...estado, camara: { objetivo: accion.objetivo, zoom: accion.zoom ?? 1 } } };
    case "resaltar":
      cambiar(accion.pieza, (p) => ({ ...p, resaltada: true }));
      break;
    case "rotar":
      cambiar(accion.pieza, (p) => {
        const rot = [...p.rot] as Vec3;
        rot[EJE[accion.eje]] = (accion.grados * Math.PI) / 180;
        return { ...p, rot };
      });
      break;
    case "desplazar":
      cambiar(accion.pieza, (p) => ({ ...p, desp: [...accion.vec] as Vec3 }));
      break;
    case "ocultar":
      cambiar(accion.pieza, (p) => ({ ...p, visible: false, resaltada: false }));
      break;
    case "despiezar":
      return { estado: { ...estado, despiece: accion.cantidad, abierto: accion.cantidad > 0 } };
    case "restaurar":
      return { estado: estadoInicial(Object.keys(estado.piezas), estado.cubiertas, estado.lados) };
  }
  return { estado: { ...estado, piezas, ...(abre ? { abierto: true } : {}), ...volteo } };
}

/** ¿El paso solo vuelve a la vista general? (Entonces el equipo se cierra.) */
export function soloVuelveAGeneral(coreografia: Coreografia): boolean {
  return coreografia.acciones.length > 0 && coreografia.acciones.every((a) => a.t === "camara" && a.objetivo === OBJETIVO_GENERAL);
}

/**
 * Cierra el equipo: las tapas y las caras vuelven a su lugar (visibles, sin girar ni correr) con sus tornillos,
 * armado, opaco y con la pantalla hacia arriba.
 */
export function cerrar(estado: EstadoEscena): EstadoEscena {
  const piezas = { ...estado.piezas };
  const lados = estado.lados;
  const tapas: Array<[string, "tapa" | "raiz"]> = [...Object.entries(estado.cubiertas ?? {}), ...Object.keys(lados?.caras ?? {}).map((id) => [id, "tapa"] as [string, "tapa"])];
  for (const [id, tipo] of tapas) {
    const p = piezas[id];
    if (!p) continue;
    piezas[id] = { ...p, visible: true, desp: [0, 0, 0], rot: tipo === "tapa" ? [0, 0, 0] : p.rot };
  }
  for (const id of Object.keys(lados?.tornillos ?? {})) if (piezas[id]) piezas[id] = { ...piezas[id], visible: true };
  return { ...estado, piezas, despiece: 0, abierto: false, ...(lados ? { volteado: lados.frente === -1 } : {}) };
}

/** Empieza un paso nuevo: apaga los resaltados del paso anterior. */
export function comenzarPaso(estado: EstadoEscena): EstadoEscena {
  const piezas: Record<string, EstadoPieza> = {};
  for (const [id, p] of Object.entries(estado.piezas)) piezas[id] = p.resaltada ? { ...p, resaltada: false } : p;
  return { ...estado, piezas };
}

/** Aplica un paso completo de una vez (útil para tests, saltar pasos o reconstruir el estado). */
export function aplicarCoreografia(
  estado: EstadoEscena,
  coreografia: Coreografia,
  ctx: ContextoEventos,
): { estado: EstadoEscena; eventos: Evento[] } {
  const eventos: Evento[] = [];
  let actual = soloVuelveAGeneral(coreografia) ? cerrar(comenzarPaso(estado)) : comenzarPaso(estado);
  for (const accion of coreografia.acciones) {
    const r = aplicarAccion(actual, accion, ctx);
    actual = r.estado;
    if (r.evento) eventos.push(r.evento);
  }
  return { estado: actual, eventos };
}

/**
 * Desplazamiento de una pieza en el despiece, en ejes del padre: sube un escalón
 * respecto del padre y se aleja un poco de su centro en el plano horizontal.
 */
export function desplazamientoDespiece(centro: Vec3, centroPadre: Vec3 | null, cantidad: number): Vec3 {
  if (!centroPadre || cantidad <= 0) return [0, 0, 0];
  const SUBIDA_CM = 5;
  const SEPARACION = 0.6;
  return [
    (centro[0] - centroPadre[0]) * SEPARACION * cantidad,
    SUBIDA_CM * cantidad,
    (centro[2] - centroPadre[2]) * SEPARACION * cantidad,
  ];
}

let contadorEventos = 0;

function eventoPiezaDesconocida(pieza: string, accion: Accion, ctx: ContextoEventos): Evento {
  contadorEventos += 1;
  return {
    id: `ev-visor-${Date.now()}-${contadorEventos}`,
    casoId: ctx.casoId,
    agente: "cartografo",
    tipo: "pieza_desconocida",
    mensaje: `La coreografía nombró "${pieza}", que no está en el modelo 3D. Se ignoró la acción "${accion.t}".`,
    ts: new Date().toISOString(),
    datos: { pieza, accion },
  };
}

/** Una pieza para armar el despiece: su centro y su tamaño en los ejes del equipo (los del plano). */
export type PiezaDespiece = { id: string; centro: Vec3; dim: Vec3; padre: string | null };

/** Un equipo es plano si su lado más chico mide menos que esto del siguiente (celular, tablet, notebook, TV). */
const PLANO_SI = 0.3;
/** Piezas cuya altura (sobre el eje fino) difiere menos que esto del grosor del equipo van en la misma capa. */
const TOLERANCIA_CAPA = 0.12;
/** Escalón de cada capa sobre el eje fino: el grosor de la carcasa, o esto del lado mayor si es más. */
const ESCALON_MIN = 0.06;
/** Cada capa también se corre esto de su lado (en el eje que la cámara ve vertical): abiertas como cartas. */
const ABANICO = 0.28;

/**
 * Cuánto se mueve cada pieza en el despiece completo (`cantidad` 1), en ejes de su padre.
 *
 * - Equipo PLANO (por su forma, no por modelo): las piezas se agrupan en capas por su altura sobre el eje
 *   fino (pantalla, carcasa, placa y batería, tapa trasera), en orden físico, con el mismo escalón entre
 *   capas; y cada capa se corre de costado en el eje que la cámara ve vertical, así mirando de arriba (o de
 *   frente, un TV) no quedan una tapando a la otra (#188). La carcasa raíz no se mueve.
 * - Los demás: `desplazamientoDespiece` (suben un escalón y se alejan del centro del padre).
 */
export function despiezado(piezas: PiezaDespiece[]): Map<string, Vec3> {
  const raiz = piezas.find((p) => !p.padre);
  const porId = new Map(piezas.map((p) => [p.id, p]));
  const res = new Map<string, Vec3>();
  if (!raiz) return res;
  const orden = [0, 1, 2].sort((a, b) => raiz.dim[a] - raiz.dim[b]);
  const fino = orden[0];
  if (raiz.dim[fino] >= PLANO_SI * raiz.dim[orden[1]]) {
    for (const p of piezas) res.set(p.id, desplazamientoDespiece(p.centro, p.padre ? (porId.get(p.padre)?.centro ?? null) : null, 1));
    return res;
  }
  // El eje del abanico: si el equipo está acostado (fino = y), la profundidad; si está parado, la altura.
  const abanico = fino === 1 ? 2 : 1;
  const grosor = Math.max(...piezas.map((p) => p.centro[fino] + p.dim[fino] / 2)) - Math.min(...piezas.map((p) => p.centro[fino] - p.dim[fino] / 2));
  const tolerancia = Math.max(grosor * TOLERANCIA_CAPA, 1e-3);
  // Capas: alturas ordenadas, cortadas donde hay un salto mayor que la tolerancia.
  const otras = piezas.filter((p) => p !== raiz).sort((a, b) => a.centro[fino] - b.centro[fino]);
  const capaDe = new Map<string, number>();
  const capas: number[][] = [];
  for (const p of otras) {
    const ultima = capas.at(-1);
    if (ultima && p.centro[fino] - ultima.at(-1)! <= tolerancia) ultima.push(p.centro[fino]);
    else capas.push([p.centro[fino]]);
    capaDe.set(p.id, capas.length - 1);
  }
  // Rango de cada capa respecto de la carcasa: las de abajo, negativas; las de arriba, positivas.
  const centroCapa = capas.map((c) => c.reduce((a, b) => a + b, 0) / c.length);
  const debajo = centroCapa.filter((c) => c < raiz.centro[fino]).length;
  const rango = (i: number) => (i < debajo ? i - debajo : i - debajo + 1);
  const escalon = Math.max(raiz.dim[fino], ESCALON_MIN * Math.max(...raiz.dim));
  const corrimiento = ABANICO * raiz.dim[abanico];
  const enMundo = new Map<string, Vec3>([[raiz.id, [0, 0, 0]]]);
  for (const p of otras) {
    const r = rango(capaDe.get(p.id)!);
    const v: Vec3 = [0, 0, 0];
    v[fino] = r * escalon;
    v[abanico] = -r * corrimiento; // la de arriba (o la de atrás) se va hacia el fondo: en pantalla, más arriba
    enMundo.set(p.id, v);
  }
  // En ejes del padre: lo que se mueve la pieza menos lo que ya se movió su padre.
  for (const p of piezas) {
    const propio = enMundo.get(p.id)!;
    const delPadre = (p.padre && enMundo.get(p.padre)) || [0, 0, 0];
    res.set(p.id, propio.map((v, i) => v - delPadre[i]) as Vec3);
  }
  return res;
}
