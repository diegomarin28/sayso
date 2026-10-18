import type { Coreografia, PlanoDePiezas } from "../../shared";

/**
 * Ejemplos del lab (/lab/visor, /lab/galeria) y tests: los planos son las plantillas por tipo de
 * `lib/planogenerator/plantillas/equipos.ts` (también la red de seguridad de /api/plano); acá
 * están las coreografías de ejemplo.
 */
import {
  conRaizVisible,
  planoAuriculares,
  planoAuricularesVincha,
  raizVisibleVincha,
  planoCargador,
  planoControlRemoto,
  planoPowerBank,
  planoCamaraAccion,
  planoAfeitadora,
  planoPlanchita,
  planoCepilloElectrico,
  planoMando,
  planoMouse,
  planoParlanteBluetooth,
  planoReloj,
  planoRelojRedondo,
  planoTablet,
  planoTeclado,
  planoAire,
  planoAspiradora,
  planoCafetera,
  planoCelular,
  planoConsola,
  planoHeladera,
  planoImpresora,
  planoImpresoraLaser,
  planoLavarropas,
  planoMicroondas,
  planoRouter,
  planoSecador,
  planoTelevisor,
} from "../../lib/planogenerator/plantillas/equipos";
import { planoNotebookBase } from "../../lib/planogenerator/plantillas/notebook";
import { PLANTILLAS_POR_TIPO } from "../../lib/planogenerator/plantillas/por-tipo";

export {
  planoAuriculares,
  planoCargador,
  planoControlRemoto,
  planoPowerBank,
  planoCamaraAccion,
  planoAfeitadora,
  planoPlanchita,
  planoCepilloElectrico,
  planoMando,
  planoMouse,
  planoParlanteBluetooth,
  planoReloj,
  planoTablet,
  planoTeclado,
  planoAire,
  planoAspiradora,
  planoCafetera,
  planoCelular,
  planoConsola,
  planoHeladera,
  planoImpresora,
  planoLavarropas,
  planoMicroondas,
  planoRouter,
  planoSecador,
  planoTelevisor,
};

const paso = (n: number, dice: string, acciones: Coreografia["acciones"]): Coreografia => ({ paso: n, dice, acciones, riesgo: "bajo" });

/**
 * Mostrar el compresor: se ocultan las puertas, se gira la heladera (la carcasa es la madre de todas las
 * piezas, así que giran con ella) y la cámara va al compresor, que queda atrás, abajo.
 * El paso 3 nombra el compresor: la tabla de seguridad (lib/safety) hoy lo bloquea aunque solo lo muestre.
 */
export const coreografiaHeladera: Coreografia[] = [
  paso(1, "Saco las puertas para ver adentro.", [
    { t: "ocultar", pieza: "puerta_freezer" },
    { t: "ocultar", pieza: "puerta_heladera" },
    { t: "camara", objetivo: "general" },
  ]),
  paso(2, "Giro la heladera para ver la parte de atrás.", [
    { t: "rotar", pieza: "carcasa_heladera", eje: "y", grados: 180 },
    { t: "camara", objetivo: "general" },
  ]),
  paso(3, "Abajo, atrás, está el compresor. No lo abras ni toques los caños: tienen gas a presión.", [
    { t: "camara", objetivo: "compresor", zoom: 1.2 },
    { t: "resaltar", pieza: "compresor" },
  ]),
];

/**
 * Cambiar el tóner de una láser: se abre la tapa de adelante, el cartucho sale derecho hacia el frente
 * (z) y la cámara termina en la unidad fusora, que queda atrás y es lo que quema.
 */
export const coreografiaImpresoraLaser: Coreografia[] = [
  paso(1, "Abro la tapa de adelante, la que baja.", [
    { t: "ocultar", pieza: "puerta_frontal" },
    { t: "camara", objetivo: "general" },
  ]),
  paso(2, "Saco el cartucho de tóner tirando derecho hacia vos.", [
    { t: "desplazar", pieza: "cartucho_toner", vec: [0, 0, 26] },
    { t: "camara", objetivo: "cartucho_toner" },
    { t: "resaltar", pieza: "cartucho_toner" },
  ]),
  {
    ...paso(3, "Atrás queda la unidad fusora. Quema: con la impresora recién usada, esperá media hora antes de meter la mano.", [
      { t: "camara", objetivo: "unidad_fusora", zoom: 1.2 },
      { t: "resaltar", pieza: "unidad_fusora" },
    ]),
    riesgo: "medio",
  },
];

/**
 * TV: se da vuelta (girar la carcasa no lo abre), se saca la tapa de atrás (la carcasa es la tapa: al
 * ocultarla quedan las placas) y se muestran la placa principal y la fuente.
 */
export const coreografiaTelevisor: Coreografia[] = [
  paso(1, "Doy vuelta el televisor para verlo desde atrás.", [
    { t: "rotar", pieza: "carcasa_televisor", eje: "y", grados: 180 },
    { t: "camara", objetivo: "general" },
  ]),
  paso(2, "Saco la tapa de atrás: abajo quedan las dos placas.", [
    { t: "ocultar", pieza: "carcasa_televisor" },
    { t: "camara", objetivo: "general" },
  ]),
  paso(3, "Esta es la placa principal, la de las entradas HDMI.", [
    { t: "camara", objetivo: "placa_control", zoom: 1.3 },
    { t: "resaltar", pieza: "placa_control" },
  ]),
  {
    ...paso(4, "Y esta es la fuente. Aunque el televisor esté desenchufado, no la toques: puede guardar carga.", [
      { t: "camara", objetivo: "fuente", zoom: 1.3 },
      { t: "resaltar", pieza: "fuente" },
    ]),
    riesgo: "medio",
  },
];

/** Celular boca abajo: se saca la tapa trasera y se muestran la batería y el conector de carga. */
export const coreografiaCelular: Coreografia[] = [
  paso(1, "Saco la tapa de atrás.", [
    { t: "ocultar", pieza: "tapa_trasera" },
    { t: "camara", objetivo: "general" },
  ]),
  {
    ...paso(2, "La batería ocupa el medio. Está pegada: no la dobles ni hagas palanca con nada de metal.", [
      { t: "camara", objetivo: "bateria", zoom: 1.2 },
      { t: "resaltar", pieza: "bateria" },
    ]),
    riesgo: "medio",
  },
  paso(3, "Abajo está el conector de carga, en su plaquita.", [
    { t: "camara", objetivo: "conector_carga", zoom: 1.5 },
    { t: "resaltar", pieza: "conector_carga" },
  ]),
];

/** Notebook dada vuelta: se levanta la tapa de abajo, primero la batería y después el ventilador. */
export const coreografiaNotebook: Coreografia[] = [
  paso(1, "Saco la tapa de abajo.", [
    { t: "rotar", pieza: "tapa_inferior", eje: "x", grados: -100 },
    { t: "camara", objetivo: "general" },
  ]),
  paso(2, "Lo primero es desconectar la batería de la placa.", [
    { t: "camara", objetivo: "bateria", zoom: 1.2 },
    { t: "resaltar", pieza: "bateria" },
  ]),
  paso(3, "El ventilador está sobre la placa: ahí se junta el polvo.", [
    { t: "camara", objetivo: "ventilador", zoom: 1.3 },
    { t: "resaltar", pieza: "ventilador" },
  ]),
];

const sinOpcionales = (plano: PlanoDePiezas, tipo: string): PlanoDePiezas => {
  const opcionales = PLANTILLAS_POR_TIPO.find((p) => p.id === tipo)?.opcionales ?? [];
  return { ...plano, piezas: plano.piezas.filter((p) => !opcionales.includes(p.pieza)) };
};

/**
 * Tablet en la mano (la pantalla hacia la cámara): se abre por adelante. Los pasos solo dicen qué hacer; el
 * desarme en vivo (`conDesarme`) despega la pantalla y desvanece los tornillos, como en la guía (#233).
 */
export const coreografiaTablet: Coreografia[] = [
  paso(1, "Despegá la pantalla con la púa, de a poco, empezando por un costado.", [
    { t: "camara", objetivo: "pantalla", zoom: 1.1 },
    { t: "resaltar", pieza: "pantalla" },
  ]),
  paso(2, "Adentro, la batería ocupa casi todo: está pegada, no la dobles.", [
    { t: "camara", objetivo: "bateria", zoom: 1.2 },
    { t: "resaltar", pieza: "bateria" },
  ]),
  paso(3, "Abajo está el conector de carga.", [
    { t: "camara", objetivo: "conector_carga", zoom: 1.5 },
    { t: "resaltar", pieza: "conector_carga" },
  ]),
];

/** Ejemplos del lab, con el tipo de equipo que diría la recepción y, si hay, una coreografía. */
export const EJEMPLOS: Record<string, { plano: PlanoDePiezas; tipoEquipo: string; coreografia?: Coreografia[] }> = {
  heladera: { plano: planoHeladera, tipoEquipo: "heladera", coreografia: coreografiaHeladera },
  aire: { plano: planoAire, tipoEquipo: "aire acondicionado split" },
  celular: { plano: planoCelular, tipoEquipo: "celular", coreografia: coreografiaCelular },
  televisor: { plano: planoTelevisor, tipoEquipo: "televisor", coreografia: coreografiaTelevisor },
  notebook: { plano: planoNotebookBase, tipoEquipo: "notebook", coreografia: coreografiaNotebook },
  lavarropas: { plano: planoLavarropas, tipoEquipo: "lavarropas" },
  microondas: { plano: planoMicroondas, tipoEquipo: "microondas" },
  aspiradora: { plano: planoAspiradora, tipoEquipo: "aspiradora" },
  secador: { plano: planoSecador, tipoEquipo: "secador de pelo" },
  impresora: { plano: planoImpresora, tipoEquipo: "impresora" },
  impresora_laser: { plano: planoImpresoraLaser, tipoEquipo: "impresora láser", coreografia: coreografiaImpresoraLaser },
  // Como la arma la app con un pack que no nombra el mando: sin las piezas opcionales (los joysticks al costado).
  consola: { plano: sinOpcionales(planoConsola, "consola"), tipoEquipo: "consola de videojuegos" },
  router: { plano: planoRouter, tipoEquipo: "router" },
  cafetera: { plano: planoCafetera, tipoEquipo: "cafetera" },
  tablet: { plano: planoTablet, tipoEquipo: "tablet", coreografia: coreografiaTablet },
  auriculares: { plano: planoAuriculares, tipoEquipo: "auriculares" },
  auriculares_vincha: { plano: conRaizVisible(planoAuricularesVincha, raizVisibleVincha), tipoEquipo: "auriculares de vincha" },
  reloj: { plano: planoReloj, tipoEquipo: "reloj inteligente" },
  reloj_redondo: { plano: planoRelojRedondo, tipoEquipo: "reloj inteligente" },
  mouse: { plano: planoMouse, tipoEquipo: "mouse" },
  teclado: { plano: planoTeclado, tipoEquipo: "teclado" },
  joystick: { plano: planoMando, tipoEquipo: "joystick" },
  parlante: { plano: planoParlanteBluetooth, tipoEquipo: "parlante bluetooth" },
  cargador: { plano: planoCargador, tipoEquipo: "cargador" },
  control_remoto: { plano: planoControlRemoto, tipoEquipo: "control remoto" },
  powerbank: { plano: planoPowerBank, tipoEquipo: "batería externa power bank" },
  camara: { plano: planoCamaraAccion, tipoEquipo: "cámara de acción" },
  afeitadora: { plano: planoAfeitadora, tipoEquipo: "afeitadora" },
  planchita: { plano: planoPlanchita, tipoEquipo: "planchita de pelo" },
  cepillo: { plano: planoCepilloElectrico, tipoEquipo: "cepillo de dientes eléctrico" },
};
