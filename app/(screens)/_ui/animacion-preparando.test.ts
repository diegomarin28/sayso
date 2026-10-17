import { describe, expect, it } from "vitest";
import { dibujoPara } from "./animacion-preparando";

describe("pantalla 4: el dibujo depende del equipo", () => {
  it.each([
    ["notebook", "notebook"],
    ["Notebook Lenovo", "notebook"],
    ["pantalla de notebook", "notebook"],
    ["celular", "celular"],
    ["iPhone 13", "celular"],
    ["heladera no frost", "heladera"],
    ["lavarropas automático", "lavarropas"],
    ["aire acondicionado split", "aire"],
    ["smart tv", "tv"],
    ["televisor", "tv"],
    ["microondas", "generico"],
    ["equipo", "generico"],
  ])("%s → %s", (equipo, dibujo) => {
    expect(dibujoPara(equipo)).toBe(dibujo);
  });

  it("sin dato, genérico", () => {
    expect(dibujoPara(undefined)).toBe("generico");
    expect(dibujoPara(null)).toBe("generico");
  });
});
