import { describe, expect, it } from "vitest";
import type { Coreografia } from "../../../shared";
import { conPiezaNombrada, piezaNombrada } from "./pieza-nombrada";

const piezas = [
  { id: "bateria", nombre: "Batería" },
  { id: "ventilador", nombre: "Ventilador" },
  { id: "tornillos_ventilador", nombre: "Tornillos del ventilador" },
  { id: "placa_madre", nombre: "Placa base" },
  { id: "wifi", nombre: "Placa Wi-Fi" },
];
const plano = new Set(["bateria", "ventilador", "tornillos_ventilador", "placa_madre"]);
const paso = (dice: string, extra: Partial<Coreografia> = {}): Coreografia => ({ paso: 1, dice, acciones: [], riesgo: "bajo", ...extra });

describe("pieza nombrada (B6)", () => {
  it("encuentra la pieza aunque cambien tildes, mayúsculas o el plural", () => {
    expect(piezaNombrada("Desconectá la BATERIA antes de seguir.", piezas, plano)).toBe("bateria");
    expect(piezaNombrada("Revisá las baterías.", piezas, plano)).toBe("bateria");
    expect(piezaNombrada("La placa madre está abajo.", piezas, plano)).toBe("placa_madre"); // por el id
  });

  it("si nombra varias, gana la más específica; no confunde palabras sueltas", () => {
    expect(piezaNombrada("Aflojá los tornillos del ventilador.", piezas, plano)).toBe("tornillos_ventilador");
    expect(piezaNombrada("Una placa cualquiera.", piezas, plano)).toBeNull();
    expect(piezaNombrada("Ventiladores de techo no.", piezas, plano)).toBe("ventilador");
  });

  it("solo piezas que existen en el plano", () => {
    expect(piezaNombrada("Cambiá la placa Wi-Fi.", piezas, plano)).toBeNull();
  });

  it("suma ir a la pieza y resaltarla si el paso no resalta nada", () => {
    const c = conPiezaNombrada(paso("Ahora sacá la batería con cuidado."), piezas, plano);
    expect(c.acciones).toEqual([
      { t: "camara", objetivo: "bateria", zoom: 1.4 },
      { t: "resaltar", pieza: "bateria" },
    ]);
  });

  it("respeta lo que ya trae el paso: si resalta, no toca; si encuadra, solo resalta", () => {
    const resaltado = paso("La batería y el ventilador.", { acciones: [{ t: "resaltar", pieza: "ventilador" }] });
    expect(conPiezaNombrada(resaltado, piezas, plano)).toBe(resaltado);
    const encuadra = conPiezaNombrada(paso("Mirá la batería.", { acciones: [{ t: "camara", objetivo: "general" }] }), piezas, plano);
    expect(encuadra.acciones).toEqual([{ t: "camara", objetivo: "general" }, { t: "resaltar", pieza: "bateria" }]);
  });

  it("nunca en un paso bloqueado", () => {
    const bloqueo = paso("Acá frenamos: la batería está hinchada.", { riesgo: "alto" });
    expect(conPiezaNombrada(bloqueo, piezas, plano)).toBe(bloqueo);
  });
});
