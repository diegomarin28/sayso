import { describe, expect, it } from "vitest";
import type { PiezaPlano, PlanoDePiezas } from "../../shared";
import { sumarDelManual } from "./completar";

const pieza = (pieza: string, pos: PiezaPlano["pos"], dim: PiezaPlano["dim"], extra: Partial<PiezaPlano> = {}): PiezaPlano => ({
  pieza,
  forma: "caja",
  pos,
  dim,
  pivote: [0, 0, 0],
  ...extra,
});
const plano = (piezas: PiezaPlano[]): PlanoDePiezas => ({ modelo: "x", unidades: "cm", piezas });

describe("sumarDelManual", () => {
  const guardado = plano([
    pieza("base", [0, 0, 0], [30, 2, 20]),
    pieza("bateria", [0, 1, 5], [10, 1, 6], { padre: "base", origen: "manual" }),
    pieza("parlantes", [-14, 1, -9], [1, 1, 1], { padre: "base", origen: "plantilla" }),
  ]);
  // El plano nuevo tiene la carcasa a la mitad de ancho y otra raíz.
  const nuevo = plano([
    pieza("carcasa", [10, 0, 0], [15, 2, 20]),
    pieza("parlantes", [15, 1, 5], [2, 1, 2], { padre: "carcasa", origen: "manual" }),
    pieza("tornillos", [12, 1, 5], [1, 1, 1], { padre: "parlantes", origen: "manual" }),
    pieza("ventilador", [8, 1, 0], [4, 1, 4], { padre: "carcasa", origen: "estimada" }),
  ]);

  it("lleva las piezas vistas en el manual a la carcasa guardada (escala por eje) y reemplaza las del esqueleto", () => {
    const r = sumarDelManual(guardado, nuevo, ["parlantes", "tornillos", "ventilador"]);
    expect(r.sumadas).toEqual(["parlantes", "tornillos"]);
    const p = r.plano.piezas.find((q) => q.pieza === "parlantes")!;
    expect(p).toMatchObject({ pos: [10, 1, 5], dim: [4, 1, 2], padre: "base", origen: "manual" });
    expect(r.plano.piezas.filter((q) => q.pieza === "parlantes")).toHaveLength(1);
    // La que cuelga de otra pieza sumada sigue colgando de ella.
    expect(r.plano.piezas.find((q) => q.pieza === "tornillos")?.padre).toBe("parlantes");
    // Lo estimado no entra (lo resuelve el esqueleto del tipo) y lo guardado no se toca.
    expect(r.plano.piezas.some((q) => q.pieza === "ventilador")).toBe(false);
    expect(r.plano.piezas.find((q) => q.pieza === "bateria")).toEqual(guardado.piezas[1]);
  });

  it("sin piezas del manual devuelve el guardado tal cual", () => {
    expect(sumarDelManual(guardado, nuevo, ["ventilador"])).toEqual({ plano: guardado, sumadas: [] });
  });
});
