import { describe, expect, it } from "vitest";
import { coreografiaEjemplo, type Coreografia } from "../../../shared";
import { paginaParaPaso } from "./pagina-manual";

const imagen = (pagina: number) => (pagina === 54 ? "https://ej.com/p54.png" : null);
const paso = (c: Partial<Coreografia>): Coreografia => ({ ...coreografiaEjemplo[0], ...c });
const cita = { doc: "HMM", pagina: 54, estado: "VERIFICADO" as const };

describe('"Ver en el manual"', () => {
  it("aparece si el paso cita una página que tiene imagen", () => {
    expect(paginaParaPaso(paso({ cita, riesgo: "bajo" }), imagen)).toEqual({ url: "https://ej.com/p54.png", pagina: 54, doc: "HMM" });
  });

  it("no aparece sin cita, sin página, sin imagen o sin el campo de /api/knowledge", () => {
    expect(paginaParaPaso(paso({ cita: undefined, riesgo: "bajo" }), imagen)).toBeNull();
    expect(paginaParaPaso(paso({ cita: { doc: "HMM", estado: "NO_VERIFICABLE" }, riesgo: "bajo" }), imagen)).toBeNull();
    expect(paginaParaPaso(paso({ cita: { ...cita, pagina: 12 }, riesgo: "bajo" }), imagen)).toBeNull();
    expect(paginaParaPaso(paso({ cita, riesgo: "bajo" }), undefined)).toBeNull();
    expect(paginaParaPaso(undefined, imagen)).toBeNull();
  });

  it("nunca en un paso bloqueado", () => {
    expect(paginaParaPaso(paso({ cita, riesgo: "alto" }), imagen)).toBeNull();
  });
});
