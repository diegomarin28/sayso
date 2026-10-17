import type { Coreografia, PiezaPlano, PlanoDePiezas, Vec3 } from "../../shared";

/**
 * Planos de ejemplo de electrodomésticos, SOLO para /lab y tests (regla "nada hardcodeado"):
 * medidas típicas en cm, no de un modelo. En producción el plano lo arma la IA desde el manual.
 * Incluyen una pieza sin tipo en la biblioteca (el sensor) para ver la primitiva de respaldo.
 */
const pieza = (id: string, dim: Vec3, pos: Vec3, forma: PiezaPlano["forma"] = "caja", padre?: string): PiezaPlano => ({
  pieza: id,
  forma,
  dim,
  pos,
  pivote: [0, 0, 0],
  ...(padre ? { padre } : {}),
});

export const planoHeladera: PlanoDePiezas = {
  modelo: "Heladera genérica (ejemplo del lab)",
  unidades: "cm",
  piezas: [
    pieza("carcasa_heladera", [60, 172, 65], [0, 86, 0]),
    pieza("puerta_freezer", [60, 50, 8], [0, 147, 36.5], "caja", "carcasa_heladera"),
    pieza("puerta_heladera", [60, 117, 8], [0, 61, 36.5], "caja", "carcasa_heladera"),
    pieza("bisagra_superior", [7, 3, 3], [-25, 173.5, 31], "caja", "carcasa_heladera"),
    pieza("compresor", [18, 17, 14], [0, 10.5, -22], "cilindro", "carcasa_heladera"),
    pieza("condensador", [45, 80, 2], [0, 95, -34], "caja", "carcasa_heladera"),
    pieza("evaporador", [40, 20, 3], [0, 140, -27], "caja", "carcasa_heladera"),
    pieza("bandeja_verduras", [52, 18, 30], [0, 12, 14], "caja", "carcasa_heladera"),
    pieza("ventilador_evaporador", [12, 12, 3], [20, 140, -24], "cilindro", "carcasa_heladera"),
    pieza("resistencia_deshielo", [30, 4, 6], [0, 128, -27], "caja", "carcasa_heladera"),
    pieza("termostato", [4, 3, 3], [22, 112, -28], "caja", "carcasa_heladera"),
    pieza("placa_control", [15, 1.8, 10], [0, 173, -20], "caja", "carcasa_heladera"),
    pieza("cable_alimentacion", [28, 1, 2], [10, 4, -34], "caja", "carcasa_heladera"),
    pieza("sensor_temperatura", [1, 2, 1], [15, 100, -28], "cilindro", "carcasa_heladera"),
  ],
};

export const planoAire: PlanoDePiezas = {
  modelo: "Aire split, unidad interior genérica (ejemplo del lab)",
  unidades: "cm",
  piezas: [
    pieza("carcasa_split", [80, 28, 20], [0, 14, 0]),
    pieza("ventilador_tangencial", [64, 9, 9], [-3, 8, 2], "cilindro", "carcasa_split"),
    pieza("serpentin_evaporador", [70, 16, 3], [-3, 18, -4], "caja", "carcasa_split"),
    pieza("motor_ventilador", [8, 9, 9], [35, 8, 1], "cilindro", "carcasa_split"),
    pieza("placa_control", [10, 1.5, 8], [34, 22, -2], "caja", "carcasa_split"),
    pieza("filtro_izquierdo", [34, 0.6, 16], [-18, 26.5, -1], "caja", "carcasa_split"),
    pieza("filtro_derecho", [34, 0.6, 16], [18, 26.5, -1], "caja", "carcasa_split"),
    pieza("manguera_desagote", [20, 3, 2.5], [-30, 2, -7], "cilindro", "carcasa_split"),
    pieza("cable_alimentacion", [20, 1, 1.6], [28, 2, -7], "caja", "carcasa_split"),
    pieza("bandeja_condensado", [70, 1.5, 8], [-3, 10.5, -4], "caja", "carcasa_split"),
    pieza("sensor_temperatura", [1, 2, 1], [-36, 20, -6], "cilindro", "carcasa_split"),
  ],
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
};
