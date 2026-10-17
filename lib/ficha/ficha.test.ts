import { describe, expect, it } from "vitest";
import { Ficha, fichaEjemplo } from "../../shared";
import { aplicarConfirmacion } from "./ficha";

const leida: Ficha = {
  ...fichaEjemplo,
  modelo: { valor: "NB-15", estado: "probable", fuente: "chapa" },
  serie: { valor: "SN-0000-DEMO", estado: "probable", fuente: "chapa" },
  anio: { valor: null, estado: "desconocido" },
  confirmadaPorUsuario: false,
};

describe("aplicarConfirmacion", () => {
  it("confirmar un campo probable lo pasa a confirmado y marca la fuente", () => {
    const r = aplicarConfirmacion({ ficha: leida, confirmados: ["modelo"] });
    expect(r.ficha.modelo).toEqual({ valor: "NB-15", estado: "confirmado", fuente: "chapa+usuario" });
    expect(r.ficha.serie.estado).toBe("probable");
    expect(r.ficha.confirmadaPorUsuario).toBe(true);
    expect(r.listaParaPreparar).toBe(true);
  });

  it("una corrección queda confirmada con fuente usuario", () => {
    const r = aplicarConfirmacion({ ficha: leida, correcciones: { modelo: " NB-15 Pro " } });
    expect(r.ficha.modelo).toEqual({ valor: "NB-15 Pro", estado: "confirmado", fuente: "usuario" });
    expect(r.cambiados).toEqual(["modelo"]);
  });

  it("corregir a vacío deja el campo desconocido y no lista para preparar", () => {
    const r = aplicarConfirmacion({ ficha: leida, correcciones: { modelo: "" } });
    expect(r.ficha.modelo.estado).toBe("desconocido");
    expect(r.listaParaPreparar).toBe(false);
  });

  it("no se puede confirmar un campo sin valor", () => {
    const r = aplicarConfirmacion({ ficha: leida, confirmados: ["anio"] });
    expect(r.ficha.anio.estado).toBe("desconocido");
    Ficha.parse(r.ficha);
  });

  it("rechaza nombres de campo desconocidos", () => {
    expect(() => aplicarConfirmacion({ ficha: leida, confirmados: ["clase" as never] })).toThrow();
  });
});
