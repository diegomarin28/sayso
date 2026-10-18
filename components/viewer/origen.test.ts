import { describe, expect, it } from "vitest";
import { planoEjemplo, type PlanoDePiezas } from "../../shared";
import { piezasGenericas, resumenOrigen, textoOrigenPieza, textoResumen, todoDelManual } from "./origen";

const con = (origenes: (PlanoDePiezas["piezas"][number]["origen"])[], medidas?: PlanoDePiezas["medidas"]): PlanoDePiezas => ({
  ...planoEjemplo,
  piezas: origenes.map((origen, i) => ({ ...planoEjemplo.piezas[0], pieza: `p${i}`, origen })),
  medidas,
});

describe("resumen del origen del plano", () => {
  it("un plano mixto no es 'todo del manual' y dice cuántas de cada una", () => {
    const r = resumenOrigen(con(["manual", "manual", "estimada", "plantilla"], { ancho: "manual", prof: "manual" }));
    expect(todoDelManual(r)).toBe(false);
    expect(textoResumen(r)).toBe("2 del manual · 1 estimada · 1 genérica");
  });

  it("todo del manual solo si también las medidas salen del manual", () => {
    expect(todoDelManual(resumenOrigen(con(["manual", "manual"], { ancho: "manual", prof: "manual" })))).toBe(true);
    expect(todoDelManual(resumenOrigen(con(["manual", "manual"], { ancho: "manual", prof: "estimada" })))).toBe(false);
    expect(textoResumen(resumenOrigen(con(["manual"], { ancho: "manual", prof: "manual" })))).toBe("Todo ubicado con el manual");
  });

  it("planos sin origen (viejos o de fixture) son 'sin verificar', nunca verificados", () => {
    const r = resumenOrigen(con([undefined, undefined]));
    expect(todoDelManual(r)).toBe(false);
    expect(textoResumen(r)).toBe("Ubicaciones sin verificar");
  });
});

describe("textoOrigenPieza", () => {
  it("dice de dónde sale, con documento y página cuando hay", () => {
    expect(textoOrigenPieza({ origen: "manual", cita: { doc: "HMM", pagina: 54, estado: "NO_VERIFICABLE" } })).toBe("Manual · HMM p. 54");
    expect(textoOrigenPieza({ origen: "estimada", cita: { doc: "HMM", pagina: 12, estado: "NO_VERIFICABLE" } })).toBe("Estimada · p. 12");
    expect(textoOrigenPieza({ origen: "estimada" })).toBe("Estimada");
    expect(textoOrigenPieza({ origen: "plantilla" })).toBe("Genérica");
    expect(textoOrigenPieza({})).toBe("Sin verificar");
  });
});

describe("piezasGenericas", () => {
  const plano: PlanoDePiezas = {
    modelo: "láser",
    unidades: "cm",
    piezas: [
      { pieza: "carcasa_impresora", forma: "caja", dim: [38, 22, 36], pos: [0, 11, 0], pivote: [0, 0, 0], origen: "estimada" },
      { pieza: "cartucho_toner", forma: "caja", dim: [27, 9, 9], pos: [0, 12, 4], pivote: [0, 0, 0], padre: "carcasa_impresora", origen: "plantilla" },
      { pieza: "unidad_fusora", forma: "caja", dim: [26, 6, 6], pos: [0, 10, -12], pivote: [0, 0, 0], padre: "carcasa_impresora", origen: "plantilla" },
    ],
  };

  it("las de la plantilla que el pack no nombra (el tóner del pack, aunque esté ubicado por la plantilla, no)", () => {
    expect([...piezasGenericas(plano, [{ id: "cartucho_toner" }])]).toEqual(["unidad_fusora"]);
  });

  it("sin pack (el lab), ninguna", () => {
    expect(piezasGenericas(plano).size).toBe(0);
    expect(piezasGenericas(plano, []).size).toBe(0);
  });
});
