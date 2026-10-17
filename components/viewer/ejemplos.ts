import type { Coreografia, PlanoDePiezas } from "../../shared";

/**
 * Ejemplos del lab (/lab/visor, /lab/galeria) y tests: los planos son las plantillas por tipo de
 * `lib/planogenerator/plantillas/equipos.ts` (también la red de seguridad de /api/plano); acá
 * están las coreografías de ejemplo.
 */
import {
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
};
