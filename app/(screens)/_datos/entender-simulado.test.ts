import { describe, expect, it } from "vitest";
import { entenderSimulado, sinEntender } from "./entender-simulado";

describe("recepción simulada (fixture)", () => {
  it("reconoce el equipo por lo que se nombra", () => {
    expect(entenderSimulado("Mi notebook se apaga sola")).toEqual({ clase: "notebook", tipoEquipo: "notebook" });
    expect(entenderSimulado("el aire no enfría")).toEqual({ clase: "split", tipoEquipo: "aire acondicionado split" });
    expect(entenderSimulado("El celular no carga")).toEqual({ clase: "otro", tipoEquipo: "celular" });
  });

  it("si no nombra ningún equipo, no lo inventa", () => {
    expect(entenderSimulado("dddd")).toEqual({ clase: "otro", tipoEquipo: "equipo" });
    expect(entenderSimulado("se apaga sola")).toEqual({ clase: "otro", tipoEquipo: "equipo" });
  });
});

describe("sinEntender", () => {
  it("es sin entender solo cuando no hay equipo", () => {
    expect(sinEntender("otro", "equipo")).toBe(true);
    expect(sinEntender("otro", "")).toBe(true);
    expect(sinEntender("otro", undefined)).toBe(true);
    expect(sinEntender("otro", "celular")).toBe(false);
    expect(sinEntender("notebook", "equipo")).toBe(false);
  });
});
