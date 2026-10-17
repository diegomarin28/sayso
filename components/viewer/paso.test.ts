import { describe, expect, it } from "vitest";
import { Coreografia, Evento, coreografiaEjemplo } from "../../shared";
import { prepararPaso } from "./paso";

const ctx = { casoId: "caso-demo-1" };

describe("prepararPaso (filtro de seguridad antes de animar)", () => {
  it("deja pasar los pasos del fixture con sus acciones", () => {
    for (const c of coreografiaEjemplo) {
      const r = prepararPaso(c, ctx);
      expect(r.evaluacion.bloqueado).toBe(false);
      expect(r.coreografia.acciones).toEqual(c.acciones);
      expect(r.eventos).toEqual([]);
    }
  });

  it("un paso peligroso no anima piezas: solo restaura y emite paso_bloqueado", () => {
    const peligroso: Coreografia = {
      paso: 3,
      dice: "Ahora abrí la batería con un destornillador.",
      acciones: [
        { t: "camara", objetivo: "bateria", zoom: 2 },
        { t: "resaltar", pieza: "bateria" },
        { t: "desplazar", pieza: "bateria", vec: [0, 5, 0] },
      ],
      riesgo: "bajo",
    };
    const r = prepararPaso(peligroso, ctx);
    expect(r.evaluacion.bloqueado).toBe(true);
    expect(r.coreografia.acciones).toEqual([{ t: "restaurar" }]);
    expect(r.coreografia.dice).toMatch(/técnico/);
    expect(() => Coreografia.parse(r.coreografia)).not.toThrow();
    expect(r.eventos).toHaveLength(1);
    expect(() => Evento.parse(r.eventos[0])).not.toThrow();
    expect(r.eventos[0]).toMatchObject({ agente: "seguridad", tipo: "paso_bloqueado", casoId: "caso-demo-1" });
  });

  it("si la IA ya marcó riesgo alto, se bloquea aunque el texto parezca inocente", () => {
    const r = prepararPaso({ ...coreografiaEjemplo[1], riesgo: "alto" }, ctx);
    expect(r.evaluacion.bloqueado).toBe(true);
    expect(r.coreografia.acciones).toEqual([{ t: "restaurar" }]);
  });
});
