import { describe, expect, it } from "vitest";
import { destinoTab, esElDeArriba } from "./foco";

describe("destinoTab", () => {
  it("deja que el navegador avance entre vecinos", () => {
    expect(destinoTab(4, 1, false)).toBeNull();
    expect(destinoTab(4, 2, true)).toBeNull();
  });
  it("da la vuelta en los bordes", () => {
    expect(destinoTab(4, 3, false)).toBe(0);
    expect(destinoTab(4, 0, true)).toBe(3);
  });
  it("si el foco está afuera, vuelve al borde que corresponde", () => {
    expect(destinoTab(4, -1, false)).toBe(0);
    expect(destinoTab(4, -1, true)).toBe(3);
  });
  it("con un solo elemento se queda en él", () => {
    expect(destinoTab(1, 0, false)).toBe(0);
    expect(destinoTab(1, 0, true)).toBe(0);
  });
  it("sin nada focalizable, el foco va al diálogo", () => {
    expect(destinoTab(0, -1, false)).toBe(-1);
  });
});

describe("esElDeArriba", () => {
  it("solo el último de la pila", () => {
    const a = Symbol("a");
    const b = Symbol("b");
    expect(esElDeArriba([a, b], b)).toBe(true);
    expect(esElDeArriba([a, b], a)).toBe(false);
    expect(esElDeArriba([], a)).toBe(false);
  });
});
