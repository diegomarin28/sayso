import { describe, expect, it } from "vitest";
import { fichaEjemplo, type Ficha } from "../../../shared";
import { precisarSimulado } from "./precisar-simulado";

const con = (modelo: string): Ficha => ({
  ...fichaEjemplo,
  modelo: { valor: modelo, estado: "confirmado", fuente: "chapa+usuario" },
});

describe("modelo ambiguo simulado (fixture)", () => {
  it("pregunta solo con «MacBook Air» sin respuesta", () => {
    expect(precisarSimulado(con("MacBook Air"), undefined).precisar?.pregunta).toMatch(/año/);
    expect(precisarSimulado(con(" macbook air "), undefined).precisar).toBeDefined();
    expect(precisarSimulado(con("MacBook Air M1 2020"), undefined).precisar).toBeUndefined();
    expect(precisarSimulado(fichaEjemplo, undefined)).toEqual({ ficha: fichaEjemplo, cambiados: [] });
  });

  it("con la respuesta arma el modelo solo con lo que dijo la persona", () => {
    const r = precisarSimulado(con("MacBook Air"), "la del 2020 con m1");
    expect(r.precisar).toBeUndefined();
    expect(r.cambiados).toEqual(["modelo"]);
    expect(r.ficha.modelo).toEqual({ valor: "MacBook Air M1 2020", estado: "confirmado", fuente: "usuario" });
    expect(precisarSimulado(con("MacBook Air"), "2017").ficha.modelo.valor).toBe("MacBook Air 2017");
  });

  it("si la respuesta no sirve vuelve a preguntar; «No sé» sigue sin preguntar", () => {
    const sigue = precisarSimulado(con("MacBook Air"), "la gris");
    expect(sigue.precisar).toBeDefined();
    expect(sigue.ficha.modelo.valor).toBe("MacBook Air");
    expect(precisarSimulado(con("MacBook Air"), "")).toEqual({ ficha: con("MacBook Air"), cambiados: [] });
  });
});
