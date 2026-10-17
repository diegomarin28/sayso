import { describe, expect, it } from "vitest";
import { planoEjemplo } from "../../../shared";
import { piezaACambiar } from "./GuiaExperto";

const base = { paso: 1, dice: "x", acciones: [], riesgo: "bajo" as const };

describe("piezaACambiar", () => {
  it("devuelve la pieza si existe en el plano", () => {
    expect(piezaACambiar({ ...base, cambiar: "ventilador" }, planoEjemplo)).toBe("ventilador");
  });
  it("ignora piezas que no están en el plano", () => {
    expect(piezaACambiar({ ...base, cambiar: "pieza_inventada" }, planoEjemplo)).toBeNull();
  });
  it("nunca en un paso bloqueado", () => {
    expect(piezaACambiar({ ...base, riesgo: "alto", cambiar: "ventilador" }, planoEjemplo)).toBeNull();
  });
  it("sin 'cambiar' no hace nada", () => {
    expect(piezaACambiar(base, planoEjemplo)).toBeNull();
  });
});
