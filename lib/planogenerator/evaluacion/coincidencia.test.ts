import { describe, expect, it } from "vitest";
import { planoEjemplo, type PlanoDePiezas } from "../../../shared";
import { coincidencia } from "./coincidencia";

const corrido = (plano: PlanoDePiezas, id: string, dx: number): PlanoDePiezas => ({
  ...plano,
  piezas: plano.piezas.map((p) => (p.pieza === id ? { ...p, pos: [p.pos[0] + dx, p.pos[1], p.pos[2]] } : p)),
});

describe("coincidencia entre dos planos", () => {
  const ancho = planoEjemplo.piezas.find((p) => p.pieza === "base")!.dim[0];
  const ubicables = planoEjemplo.piezas.filter((p) => p.pieza !== "base" && p.pieza !== "tapa_inferior").length;

  it("el mismo plano coincide 100 %; la carcasa no cuenta", () => {
    const c = coincidencia(planoEjemplo, planoEjemplo);
    expect(c).toMatchObject({ porcentaje: 100, max: ubicables * 2 });
  });

  it("una pieza corrida pierde puntos según la distancia (escala 0–2)", () => {
    const pieza = planoEjemplo.piezas.find((p) => p.pieza !== "base")!.pieza;
    // 0,5 de la planta normalizada = 1 punto; más de 0,7 = 0.
    expect(coincidencia(planoEjemplo, corrido(planoEjemplo, pieza, 0.25 * ancho)).piezas.find((p) => p.id === pieza)?.puntos).toBe(1);
    expect(coincidencia(planoEjemplo, corrido(planoEjemplo, pieza, 0.5 * ancho)).piezas.find((p) => p.id === pieza)?.puntos).toBe(0);
  });

  it("una pieza que falta en el otro plano vale 0", () => {
    const pieza = planoEjemplo.piezas.find((p) => p.pieza !== "base")!.pieza;
    const sin = { ...planoEjemplo, piezas: planoEjemplo.piezas.filter((p) => p.pieza !== pieza) };
    expect(coincidencia(planoEjemplo, sin).puntos).toBe(ubicables * 2 - 2);
  });
});
