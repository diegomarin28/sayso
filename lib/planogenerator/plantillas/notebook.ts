import type { PlanoDePiezas } from "../../../shared";

/**
 * Plantilla genérica de notebook (escalón 1 de la escalera 3D).
 * Es ESQUEMÁTICA: no representa un modelo real. Las posiciones son típicas de una
 * notebook de 15" vista desde abajo, con la tapa inferior encima (translúcida).
 * Los ids coinciden con las piezas del knowledge pack del fixture.
 *
 * Alturas (centro en y): la base ocupa y ∈ [-0.6, 0.6]; la placa madre apoya sobre la
 * base y los componentes apoyan sobre la placa (tope de la placa = 0.78).
 */
const TOPE_BASE = 0.6;
const TOPE_PLACA = 0.78;
const sobre = (tope: number, alto: number) => tope + alto / 2;

export const planoNotebookBase: PlanoDePiezas = {
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
