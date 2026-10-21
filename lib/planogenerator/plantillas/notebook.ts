import type { PiezaPlano, PlanoDePiezas, Vec3 } from "../../../shared";
import { espejadoEnX } from "./espejo";

/**
 * Plantilla genérica de notebook (escalón 1 de la escalera 3D).
 * Es ESQUEMÁTICA: no representa un modelo real. Las posiciones son típicas de una
 * notebook de 15" vista desde abajo, con la tapa inferior encima (translúcida).
 * Los ids coinciden con las piezas del knowledge pack del fixture.
 *
 * Alturas (centro en y): la base ocupa y ∈ [-0.6, 0.6]; la placa madre apoya sobre la
 * base y los componentes apoyan sobre la placa (tope de la placa = 0.78).
 * Del otro lado (abajo, y < -0.6) están el teclado, el trackpad y la tapa de pantalla, cerrada sobre ellos
 * con la bisagra en el borde de atrás (-z): el visor la abre cuando mira la notebook por el teclado (#232).
 */
const TOPE_BASE = 0.6;
const TOPE_PLACA = 0.78;
const sobre = (tope: number, alto: number) => tope + alto / 2;

/**
 * La tapa de pantalla (con su panel) de una notebook dada vuelta con la base `[ancho, hondo]` centrada en x y z:
 * cerrada debajo del teclado (`cara`: la y de su cara), del ancho y lo hondo de la de la biblioteca (31 × 21,4
 * en una base de 32 × 23) y con la bisagra en el borde de atrás. El panel va del lado del teclado (el que mira a
 * quien la abre) y por fuera del marco, que en la forma de la biblioteca sobresale hacia ese lado.
 */
export function tapaDePantalla([ancho, hondo]: [number, number], cara: number): PiezaPlano[] {
  const tapa: Vec3 = [+((ancho * 31) / 32).toFixed(2), 0.76, +((hondo * 21.38) / 23).toFixed(2)];
  const z = -hondo / 2 + tapa[2] / 2;
  const y = cara - 0.12 - tapa[1] / 2;
  return [
    {
      pieza: "carcasa_pantalla",
      forma: "caja",
      dim: tapa,
      pos: [0, y, +z.toFixed(2)],
      pivote: [0, tapa[1] / 2, +(-0.48 * tapa[2]).toFixed(2)],
      padre: "base",
      formaBiblioteca: "carcasa_pantalla@notebook",
    },
    {
      pieza: "pantalla",
      forma: "caja",
      dim: [+((ancho * 29.7) / 32).toFixed(2), 0.11, +((hondo * 19.6) / 23).toFixed(2)],
      pos: [0, +(cara - 0.065).toFixed(3), +(z + 0.2).toFixed(2)],
      pivote: [0, 0, 0],
      padre: "carcasa_pantalla",
      formaBiblioteca: "pantalla@notebook",
    },
  ];
}

const notebookAbierta: PlanoDePiezas = {
  modelo: "Notebook genérica (plantilla)",
  unidades: "cm",
  piezas: [
    { pieza: "base", forma: "extrusion", dim: [36, 1.2, 25], pos: [0, 0, 0], pivote: [0, 0, 0] },
    {
      pieza: "placa_madre",
      forma: "caja",
      dim: [32, 0.18, 13],
      pos: [0, sobre(TOPE_BASE, 0.18), -4.5],
      pivote: [0, 0, 0],
      padre: "base",
    },
    {
      pieza: "disipador",
      forma: "caja",
      dim: [4, 0.3, 4],
      pos: [1, sobre(TOPE_PLACA, 0.3), -5.5],
      pivote: [0, 0, 0],
      padre: "placa_madre",
    },
    {
      // Caño de cobre aplastado que lleva el calor del disipador al ventilador.
      pieza: "heatpipe",
      forma: "caja",
      dim: [5, 0.25, 0.8],
      pos: [5.5, sobre(TOPE_PLACA, 0.25), -6],
      pivote: [0, 0, 0],
      padre: "disipador",
    },
    {
      pieza: "ventilador",
      forma: "cilindro",
      dim: [6, 0.9, 6],
      pos: [11, sobre(TOPE_PLACA, 0.9), -7],
      pivote: [0, 0, 0],
      padre: "placa_madre",
    },
    {
      pieza: "tornillos_ventilador",
      forma: "cilindro",
      dim: [0.6, 0.3, 0.6],
      pos: [12.8, sobre(TOPE_PLACA + 0.9, 0.3), -8.8],
      pivote: [0, 0, 0],
      padre: "ventilador",
    },
    {
      pieza: "ram",
      forma: "caja",
      dim: [6.8, 0.35, 3],
      pos: [-6, sobre(TOPE_PLACA, 0.35), -6.5],
      pivote: [0, 0, 0],
      padre: "placa_madre",
    },
    {
      pieza: "ssd",
      forma: "caja",
      dim: [8, 0.25, 2.2],
      pos: [-11, sobre(TOPE_PLACA, 0.25), -1],
      pivote: [0, 0, 0],
      padre: "placa_madre",
    },
    {
      pieza: "wifi",
      forma: "caja",
      dim: [2.2, 0.2, 3],
      pos: [-14, sobre(TOPE_PLACA, 0.2), -8],
      pivote: [0, 0, 0],
      padre: "placa_madre",
    },
    {
      pieza: "pila_bios",
      forma: "cilindro",
      dim: [2, 0.3, 2],
      pos: [6, sobre(TOPE_PLACA, 0.3), -1],
      pivote: [0, 0, 0],
      padre: "placa_madre",
    },
    {
      pieza: "bateria",
      forma: "extrusion",
      dim: [26, 0.8, 7.5],
      pos: [0, sobre(TOPE_BASE, 0.8), 7],
      pivote: [0, 0, 0],
      padre: "base",
    },
    {
      pieza: "parlante_izquierdo",
      forma: "caja",
      dim: [3.5, 0.7, 2],
      pos: [-15.5, sobre(TOPE_BASE, 0.7), 9],
      pivote: [0, 0, 0],
      padre: "base",
    },
    {
      pieza: "parlante_derecho",
      forma: "caja",
      dim: [3.5, 0.7, 2],
      pos: [15.5, sobre(TOPE_BASE, 0.7), 9],
      pivote: [0, 0, 0],
      padre: "base",
    },
    {
      pieza: "teclado_notebook",
      forma: "caja",
      dim: [31, 0.3, 11],
      pos: [0, -0.75, -4.5],
      pivote: [0, 0, 0],
      padre: "base",
    },
    { pieza: "trackpad", forma: "caja", dim: [13, 0.3, 8], pos: [0, -0.75, 7.2], pivote: [0, 0, 0], padre: "base" },
    ...tapaDePantalla([36, 25], -0.9),
    {
      // Se abre desde el borde trasero, como una tapa con bisagra.
      pieza: "tapa_inferior",
      forma: "extrusion",
      dim: [36, 0.25, 25],
      pos: [0, 2.2, 0],
      pivote: [0, 0, -12.5],
      padre: "base",
    },
  ],
};

/**
 * La plantilla se escribió con la notebook abierta (derecha en +x), pero se muestra dada vuelta, vista desde abajo
 * con la bisagra arriba en la imagen (como las páginas del manual): ahí el lado derecho de quien la usa queda a la
 * izquierda, en -x (#339).
 */
export const planoNotebookBase: PlanoDePiezas = espejadoEnX(notebookAbierta);
