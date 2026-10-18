import type { Coreografia, PlanoDePiezas } from "../../shared";

/**
 * Ejemplos del lab (/lab/visor, /lab/galeria) y tests: los planos son las plantillas por tipo de
 * `lib/planogenerator/plantillas/equipos.ts` (también la red de seguridad de /api/plano); acá
 * están las coreografías de ejemplo.
 */
import {
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
} from "../../lib/planogenerator/plantillas/equipos";

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

/** Ejemplos del lab, con el tipo de equipo que diría la recepción y, si hay, una coreografía. */
export const EJEMPLOS: Record<string, { plano: PlanoDePiezas; tipoEquipo: string; coreografia?: Coreografia[] }> = {
  heladera: { plano: planoHeladera, tipoEquipo: "heladera", coreografia: coreografiaHeladera },
  aire: { plano: planoAire, tipoEquipo: "aire acondicionado split" },
  celular: { plano: planoCelular, tipoEquipo: "celular" },
  televisor: { plano: planoTelevisor, tipoEquipo: "televisor" },
  lavarropas: { plano: planoLavarropas, tipoEquipo: "lavarropas" },
  microondas: { plano: planoMicroondas, tipoEquipo: "microondas" },
  aspiradora: { plano: planoAspiradora, tipoEquipo: "aspiradora" },
  secador: { plano: planoSecador, tipoEquipo: "secador de pelo" },
  impresora: { plano: planoImpresora, tipoEquipo: "impresora" },
  consola: { plano: planoConsola, tipoEquipo: "consola de videojuegos" },
  router: { plano: planoRouter, tipoEquipo: "router" },
  cafetera: { plano: planoCafetera, tipoEquipo: "cafetera" },
  tablet: { plano: planoTablet, tipoEquipo: "tablet" },
  auriculares: { plano: planoAuriculares, tipoEquipo: "auriculares" },
  reloj: { plano: planoReloj, tipoEquipo: "reloj inteligente" },
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
