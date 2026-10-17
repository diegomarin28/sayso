import { describe, expect, it } from "vitest";
import { aPixel, aPlanta, type Esquinas, type Punto } from "./planta";

// Carcasa en perspectiva (lados no paralelos), como en los dibujos de los manuales.
const esquinas: Esquinas = { BL: [290, 92], BR: [800, 345], FR: [490, 525], FL: [30, 262] };

describe("planta", () => {
  it("las esquinas caen en (±1, ±1)", () => {
    expect(aPlanta(esquinas.BL, esquinas).map((v) => +v.toFixed(6))).toEqual([-1, -1]);
    expect(aPlanta(esquinas.FR, esquinas).map((v) => +v.toFixed(6))).toEqual([1, 1]);
  });

  it("ida y vuelta: planta → píxel → planta", () => {
    for (const p of [[0, 0], [0.5, -0.3], [-0.8, 0.9]] as Punto[]) {
      const vuelta = aPlanta(aPixel(p, esquinas), esquinas);
      expect(vuelta[0]).toBeCloseTo(p[0], 6);
      expect(vuelta[1]).toBeCloseTo(p[1], 6);
    }
  });
});
