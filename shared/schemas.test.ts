import { describe, expect, it } from "vitest";
import {
  Caso,
  Coreografia,
  Evento,
  Ficha,
  Foto,
  KnowledgePack,
  PlanoDePiezas,
  casoEjemplo,
  coreografiaEjemplo,
  eventosEjemplo,
  fichaEjemplo,
  fotosEjemplo,
  knowledgePackEjemplo,
  planoEjemplo,
} from "./index";

describe("fixtures validan contra los contratos", () => {
  it("caso, fotos, ficha, eventos", () => {
    expect(() => Caso.parse(casoEjemplo)).not.toThrow();
    fotosEjemplo.forEach((f) => expect(() => Foto.parse(f)).not.toThrow());
    expect(() => Ficha.parse(fichaEjemplo)).not.toThrow();
    eventosEjemplo.forEach((e) => expect(() => Evento.parse(e)).not.toThrow());
  });

  it("knowledge pack y plano", () => {
    expect(() => KnowledgePack.parse(knowledgePackEjemplo)).not.toThrow();
    expect(() => PlanoDePiezas.parse(planoEjemplo)).not.toThrow();
  });

  it("coreografía", () => {
    coreografiaEjemplo.forEach((c) => expect(() => Coreografia.parse(c)).not.toThrow());
  });

  it("toda pieza nombrada en la coreografía existe en el plano", () => {
    const ids = new Set(planoEjemplo.piezas.map((p) => p.pieza));
    for (const c of coreografiaEjemplo) {
      for (const a of c.acciones) {
        if ("pieza" in a) expect(ids.has(a.pieza)).toBe(true);
        if (a.t === "camara") expect(ids.has(a.objetivo)).toBe(true);
      }
    }
  });

  it("toda pieza del plano existe en el knowledge pack", () => {
    const ids = new Set(knowledgePackEjemplo.piezas.map((p) => p.id));
    planoEjemplo.piezas.forEach((p) => expect(ids.has(p.pieza)).toBe(true));
  });

  it("rechaza una acción inventada", () => {
    expect(() =>
      Coreografia.parse({ paso: 1, dice: "x", acciones: [{ t: "explotar" }], riesgo: "bajo" }),
    ).toThrow();
  });
});
