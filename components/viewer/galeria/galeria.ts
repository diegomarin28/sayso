import type { Coreografia, PlanoDePiezas } from "../../../shared";
import { planoNotebookBase } from "../../../lib/planogenerator";
import indice from "../../../public/models/piezas/indice.json";
import { EJEMPLOS } from "../ejemplos";
import { OBJETIVO_GENERAL } from "../reproductor";

/**
 * /lab/galeria (para el pitch): los tipos de equipo que cubre la biblioteca 3D, cada uno con un
 * plano de ejemplo. Son planos del lab con medidas típicas, no de un modelo (regla "nada hardcodeado").
 */
export type EquipoGaleria = {
  id: string;
  titulo: string;
  detalle: string;
  grupo: "equipos" | "dispositivos" | "en_la_mano";
  plano: PlanoDePiezas;
  tipoEquipo: string;
  /**
   * Mostrarlo de atrás (la pieza raíz girada 180°): un televisor tiene todo detrás de la pantalla, y de
   * frente es casi todo negro (el vigía del visor lo tomaría como una falla).
   */
  verDeAtras?: boolean;
};

const de = (id: keyof typeof EJEMPLOS) => ({ plano: EJEMPLOS[id].plano, tipoEquipo: EJEMPLOS[id].tipoEquipo });

export const GALERIA: EquipoGaleria[] = [
  { id: "notebook", titulo: "Notebook", detalle: "Placa, ventilador, RAM, SSD, batería", grupo: "equipos", plano: planoNotebookBase, tipoEquipo: "notebook" },
  { id: "celular", titulo: "Celular", detalle: "Batería, placa, cámaras, conector de carga", grupo: "equipos", ...de("celular") },
  { id: "heladera", titulo: "Heladera", detalle: "Compresor, condensador, evaporador, termostato", grupo: "equipos", ...de("heladera") },
  { id: "aire", titulo: "Aire split", detalle: "Turbina, serpentín, motor, filtros", grupo: "equipos", ...de("aire") },
  { id: "televisor", titulo: "Televisor", detalle: "Panel, retroiluminación LED, fuente, placa", grupo: "equipos", ...de("televisor"), verDeAtras: true },
  { id: "lavarropas", titulo: "Lavarropas", detalle: "Tambor, motor y correa, bomba, válvula", grupo: "equipos", ...de("lavarropas") },
  { id: "microondas", titulo: "Microondas", detalle: "Transformador, capacitor, ventilador, plato", grupo: "equipos", ...de("microondas") },
  { id: "aspiradora", titulo: "Aspiradora", detalle: "Cepillo, ciclón, filtro HEPA, motor", grupo: "dispositivos", ...de("aspiradora") },
  { id: "secador", titulo: "Secador de pelo", detalle: "Motor, ventilador, resistencia en mica", grupo: "dispositivos", ...de("secador") },
  { id: "impresora", titulo: "Impresora", detalle: "Carro, cartuchos, riel, rodillo, encoder", grupo: "dispositivos", ...de("impresora") },
  { id: "consola", titulo: "Consola", detalle: "Placa, lectora, fuente, mandos", grupo: "dispositivos", ...de("consola") },
  { id: "router", titulo: "Router", detalle: "Placa, antenas, puertos RJ45, SFP", grupo: "dispositivos", ...de("router") },
  { id: "cafetera", titulo: "Cafetera", detalle: "Caldera, bomba, portafiltro, molino", grupo: "dispositivos", ...de("cafetera") },
  { id: "tablet", titulo: "Tablet", detalle: "Batería, placa, cámara, parlantes", grupo: "en_la_mano", ...de("tablet") },
  { id: "auriculares", titulo: "Auriculares", detalle: "Estuche, batería, contactos de carga", grupo: "en_la_mano", ...de("auriculares") },
  { id: "reloj", titulo: "Reloj inteligente", detalle: "Pantalla, batería, sensor, bobina de carga", grupo: "en_la_mano", ...de("reloj") },
  { id: "mouse", titulo: "Mouse", detalle: "Sensor, rueda, botones, pila", grupo: "en_la_mano", ...de("mouse") },
  { id: "teclado", titulo: "Teclado", detalle: "Teclas, membrana, controlador", grupo: "en_la_mano", ...de("teclado") },
  { id: "joystick", titulo: "Joystick", detalle: "Palancas, botones, gatillos, vibración", grupo: "en_la_mano", ...de("joystick") },
  { id: "parlante", titulo: "Parlante bluetooth", detalle: "Parlantes, radiadores pasivos, batería", grupo: "en_la_mano", ...de("parlante") },
  { id: "cargador", titulo: "Cargador", detalle: "Clavija, transformador, capacitor, USB", grupo: "en_la_mano", ...de("cargador") },
  { id: "control_remoto", titulo: "Control remoto", detalle: "Botones, LED infrarrojo, pilas", grupo: "en_la_mano", ...de("control_remoto") },
  { id: "powerbank", titulo: "Batería externa", detalle: "Celda, placa de carga, USB", grupo: "en_la_mano", ...de("powerbank") },
  { id: "camara", titulo: "Cámara de acción", detalle: "Lente, batería, pantalla", grupo: "en_la_mano", ...de("camara") },
  { id: "afeitadora", titulo: "Afeitadora", detalle: "Cabezal, motor, pila recargable", grupo: "en_la_mano", ...de("afeitadora") },
  { id: "planchita", titulo: "Planchita de pelo", detalle: "Placas, resistencias, termostato", grupo: "en_la_mano", ...de("planchita") },
  { id: "cepillo", titulo: "Cepillo eléctrico", detalle: "Motor, pila, bobina de carga", grupo: "en_la_mano", ...de("cepillo") },
];

/** Cuántas formas sabe dibujar la biblioteca, contando las variantes (sale del índice de Blender). */
export const FORMAS_EN_LA_BIBLIOTECA = Object.keys(indice.tipos).length;

let numero = 0;
type ParaPaso = Pick<EquipoGaleria, "plano" | "verDeAtras">;

/** Girar la raíz para verlo de atrás (si el equipo lo pide). Las acciones son idempotentes: se repite en cada paso. */
function deAtras(equipo?: ParaPaso): Coreografia["acciones"] {
  const raiz = equipo?.verDeAtras ? equipo.plano.piezas.find((p) => !p.padre)?.pieza : undefined;
  return raiz ? [{ t: "rotar", pieza: raiz, eje: "y", grados: 180 }] : [];
}

/** Lo que se reproduce al mostrar el equipo (en la tarjeta y al abrirlo): null si no hace falta nada. */
export function pasoInicial(equipo: ParaPaso): Coreografia | null {
  const acciones = deAtras(equipo);
  if (!acciones.length) return null;
  numero += 1;
  return { paso: numero, dice: "Lo muestro de atrás.", acciones: [...acciones, { t: "camara", objetivo: OBJETIVO_GENERAL }], riesgo: "bajo" };
}

/** Un paso nuevo cada vez (el visor reproduce cada objeto nuevo): despiezar o volver a armar, viendo todo. */
export function pasoDespiece(despiezado: boolean, equipo?: ParaPaso): Coreografia {
  numero += 1;
  return {
    paso: numero,
    dice: despiezado ? "Así se separan las piezas." : "Vuelvo a armar el equipo.",
    acciones: [...deAtras(equipo), { t: "despiezar", cantidad: despiezado ? 1 : 0 }, { t: "camara", objetivo: OBJETIVO_GENERAL }],
    riesgo: "bajo",
  };
}
