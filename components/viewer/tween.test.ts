import { describe, expect, it } from "vitest";
import { crearTween, easeInOutCubic, seguir, valorTween } from "./tween";

describe("tween", () => {
  it("easeInOutCubic arranca y termina suave", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(0.1)).toBeLessThan(0.1);
    expect(easeInOutCubic(0.9)).toBeGreaterThan(0.9);
  });

  it("va del valor inicial al objetivo en la duración pedida", () => {
    const tw = crearTween([0, 0, 0]);
    expect(seguir(tw, [10, 0, 0], 1000, 500)).toEqual([0, 0, 0]);
    expect(valorTween(tw, 1250)[0]).toBeCloseTo(5);
    expect(valorTween(tw, 1500)).toEqual([10, 0, 0]);
  });

  it("respeta el retraso (explosionado escalonado)", () => {
    const tw = crearTween([0]);
    seguir(tw, [4], 0, 400, 300);
    expect(valorTween(tw, 250)).toEqual([0]);
    expect(valorTween(tw, 500)[0]).toBeCloseTo(2);
  });

  it("si el objetivo cambia a mitad de camino, sigue desde donde estaba (sin saltos)", () => {
    const tw = crearTween([0]);
    seguir(tw, [10], 0, 1000);
    const mitad = valorTween(tw, 500)[0];
    expect(seguir(tw, [0], 500, 1000)[0]).toBeCloseTo(mitad);
    expect(valorTween(tw, 1500)).toEqual([0]);
  });

  it("repetir el mismo objetivo no reinicia la transición", () => {
    const tw = crearTween([0]);
    seguir(tw, [10], 0, 1000);
    seguir(tw, [10], 600, 1000);
    expect(tw.inicio).toBe(0);
  });
});
