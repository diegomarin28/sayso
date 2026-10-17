import type { Accion, Coreografia, Evento, Vec3 } from "../../shared";

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
 */

export const OBJETIVO_GENERAL = "general";

export type EstadoPieza = {
  rot: Vec3; // radianes
  desp: Vec3; // cm
  visible: boolean;
  resaltada: boolean;
};

export type EstadoEscena = {
  piezas: Record<string, EstadoPieza>;
  despiece: number;
  camara: { objetivo: string; zoom: number };
};

export type ContextoEventos = { casoId: string };

const reposo = (): EstadoPieza => ({ rot: [0, 0, 0], desp: [0, 0, 0], visible: true, resaltada: false });

export function estadoInicial(piezas: Iterable<string>): EstadoEscena {
  const estado: EstadoEscena = { piezas: {}, despiece: 0, camara: { objetivo: OBJETIVO_GENERAL, zoom: 1 } };
  for (const id of piezas) estado.piezas[id] = reposo();
  return estado;
}

const EJE = { x: 0, y: 1, z: 2 } as const;

/** Aplica una acción. Si nombra una pieza que no existe, no cambia nada y devuelve un evento. */
export function aplicarAccion(
  estado: EstadoEscena,
  accion: Accion,
  ctx: ContextoEventos,
): { estado: EstadoEscena; evento?: Evento } {
  const pieza = "pieza" in accion ? accion.pieza : accion.t === "camara" ? accion.objetivo : undefined;
  const esGeneral = accion.t === "camara" && pieza === OBJETIVO_GENERAL;
  if (pieza !== undefined && !esGeneral && !(pieza in estado.piezas)) {
    return { estado, evento: eventoPiezaDesconocida(pieza, accion, ctx) };
  }

  const piezas = { ...estado.piezas };
  const cambiar = (id: string, f: (p: EstadoPieza) => EstadoPieza) => (piezas[id] = f(piezas[id]));

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
      return { estado: { ...estado, despiece: accion.cantidad } };
    case "restaurar":
      return { estado: estadoInicial(Object.keys(estado.piezas)) };
  }
  return { estado: { ...estado, piezas } };
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
  let actual = comenzarPaso(estado);
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
