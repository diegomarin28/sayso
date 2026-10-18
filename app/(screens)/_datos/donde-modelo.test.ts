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
});
