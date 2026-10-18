import { describe, expect, it } from "vitest";
import { dondeBuscarModelo } from "./donde-modelo";

describe("dónde más buscar el modelo (sin etiqueta)", () => {
  it("un aire: la unidad de afuera y el control remoto", () => {
    const d = dondeBuscarModelo("aire acondicionado split");
    expect(d.lugares.join(" ")).toMatch(/unidad de afuera/);
    expect(d.alternativas).toContain("El control remoto");
  });

  it("un celular: en Ajustes", () => {
    expect(dondeBuscarModelo("celular").lugares.join(" ")).toMatch(/Ajustes/);
  });

  it("cualquier otro equipo: siempre la caja o la factura", () => {
    for (const t of ["microondas", "equipo", null]) {
      const d = dondeBuscarModelo(t);
      expect(d.lugares.length).toBeGreaterThan(0);
      expect(d.alternativas).toContain("La caja o la factura");
    }
  });

  it.each([
    ["reloj", "Apple Watch Series 7 (reloj inteligente)"],
    ["reloj", "smartwatch Samsung Galaxy Watch 5"],
    ["tablet", "iPad 9.ª generación"],
    ["tablet", "tablet Samsung Galaxy Tab A8"],
  ])("%s que no prende (%s): nada con el equipo prendido; la parte de atrás sí (#255)", (_, tipo) => {
    const d = dondeBuscarModelo(tipo, "no prende, la pantalla queda negra");
    const todo = [...d.lugares, ...d.alternativas].join(" | ");
    expect(todo).not.toMatch(/Ajustes|Configuraci|men[uú]|Acerca de|pantalla de/);
    expect(d.lugares[0]).toMatch(/^Atrás, grabado/);
    expect(d.alternativas).toContain("La caja o la factura");
  });

  it("un reloj no es un celular: la parte de atrás y la app del reloj, no «Acerca del teléfono»", () => {
    const d = dondeBuscarModelo("reloj inteligente");
    expect(d.lugares.join(" ")).not.toMatch(/Acerca del teléfono/);
    expect(d.alternativas).toEqual(["La parte de atrás del reloj", "La app del reloj en el celular", "La caja o la factura"]);
  });

  it("una tablet que sí prende sigue ofreciendo Ajustes", () => {
    expect(dondeBuscarModelo("tablet", "se le rompió la pantalla").alternativas).toContain("La pantalla de Ajustes");
  });
});
