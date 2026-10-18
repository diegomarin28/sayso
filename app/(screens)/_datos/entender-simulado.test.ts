import { describe, expect, it } from "vitest";
import { entenderSimulado, sinEntender } from "./entender-simulado";

describe("recepción simulada (fixture)", () => {
  it("reconoce el equipo por lo que se nombra", () => {
    expect(entenderSimulado("Mi notebook se apaga sola")).toEqual({ clase: "notebook", tipoEquipo: "notebook", claro: true });
    expect(entenderSimulado("el aire no enfría")).toEqual({
      clase: "split",
      tipoEquipo: "aire acondicionado split",
      claro: true,
    });
    expect(entenderSimulado("El celular no carga")).toEqual({ clase: "otro", tipoEquipo: "celular", claro: true });
  });

  it("si no nombra ningún equipo, no lo inventa y pregunta", () => {
    expect(entenderSimulado("dddd")).toEqual({
      clase: "otro",
      tipoEquipo: "equipo",
      claro: false,
      repregunta: "¿Qué equipo es y qué le pasa?",
    });
  });

  it("#260: con el equipo pero sin decir qué le pasa, pregunta qué le pasa (2 variantes)", () => {
    expect(entenderSimulado("notebook dddd")).toMatchObject({ tipoEquipo: "notebook", claro: false, repregunta: "¿Qué le pasa a tu notebook?" });
    expect(entenderSimulado("mi celular")).toMatchObject({ tipoEquipo: "celular", claro: false, repregunta: "¿Qué le pasa a tu celular?" });
  });

  it("un problema dicho con pocas palabras sí es claro", () => {
    expect(entenderSimulado("la heladera no enfría").claro).toBe(true);
    expect(entenderSimulado("tele no prende").claro).toBe(true);
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
