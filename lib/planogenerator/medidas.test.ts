import { describe, expect, it } from "vitest";
import { knowledgePackEjemplo, type KnowledgePack } from "../../shared";
import { planoDesdePlantilla, planoDesdePropuesta, type PiezaPropuesta } from "./generador";
import { MEDIDA_TIPICA_CM, resolverMedidas } from "./medidas";

const celular: KnowledgePack = {
  ...knowledgePackEjemplo,
  modelo: "Celular de prueba",
  clase: "otro",
  piezas: [
    { id: "base", nombre: "Carcasa", descripcion: "", ubicacion: "" },
    { id: "placa_madre", nombre: "Placa", descripcion: "", ubicacion: "" },
    { id: "bateria", nombre: "Batería", descripcion: "", ubicacion: "" },
  ],
};
const pieza = (p: Partial<PiezaPropuesta> & { pieza: string }): PiezaPropuesta => ({
  x: 0, z: 0, ancho: 0.5, prof: 0.3, alto_cm: 0.3, capa: "sobre_base", sobre: null, forma: "caja",
  etiquetaManual: null, pagina: null, confianza: "alta", ...p,
});

describe("resolverMedidas", () => {
  it("un celular de 7,4 × 15,8 cm queda de 7,4 × 15,8 cm (no 36 cm de notebook)", () => {
    const avisos: string[] = [];
    const m = resolverMedidas("otro", { ancho: 7.4, prof: 15.8, fuente: "manual" }, avisos);
    expect(m).toEqual({ ancho: { cm: 7.4, origen: "manual" }, prof: { cm: 15.8, origen: "manual" } });
    expect(avisos).toEqual([]);
  });

  it("y el plano entero respeta esas medidas, con las piezas adentro", () => {
    const { plano, medidas } = planoDesdePropuesta(celular, {
      base_ancho_cm: 7.4,
      base_prof_cm: 15.8,
      medidas_fuente: "manual",
      piezas: [pieza({ pieza: "placa_madre", capa: "placa", ancho: 0.9, prof: 0.4, z: -0.5 }), pieza({ pieza: "bateria", z: 0.4, ancho: 0.8, prof: 0.45 })],
    });
    const [W, , D] = plano.piezas.find((p) => p.pieza === "base")!.dim;
    expect([W, D]).toEqual([7.4, 15.8]);
    expect(medidas.ancho.origen).toBe("manual");
    for (const p of plano.piezas) {
      expect(Math.abs(p.pos[0]) + p.dim[0] / 2).toBeLessThanOrEqual(W / 2 + 1e-6);
      expect(Math.abs(p.pos[2]) + p.dim[2] / 2).toBeLessThanOrEqual(D / 2 + 1e-6);
    }
  });

  it("los límites son de la clase: 7,4 cm es imposible para una notebook", () => {
    const avisos: string[] = [];
    const m = resolverMedidas("notebook", { ancho: 7.4, prof: 15.8, fuente: "manual" }, avisos);
    // El ancho se descarta y se estima con la proporción típica; la profundidad (válida) se respeta.
    expect(m.ancho.origen).toBe("estimada");
    expect(m.ancho.cm).toBeCloseTo((15.8 * MEDIDA_TIPICA_CM.notebook!.ancho) / MEDIDA_TIPICA_CM.notebook!.prof);
    expect(m.prof).toEqual({ cm: 15.8, origen: "manual" });
    expect(avisos.join(" ")).toMatch(/7\.4 cm, imposible para una notebook/);
  });

  it("solo valen medidas finitas y positivas", () => {
    for (const malo of [Number.NaN, Number.POSITIVE_INFINITY, -3, 0]) {
      const avisos: string[] = [];
      const m = resolverMedidas("otro", { ancho: malo, prof: 15.8, fuente: "manual" }, avisos);
      expect(Number.isFinite(m.ancho.cm) && m.ancho.cm > 0).toBe(true);
      expect(m.ancho.origen).toBe("estimada");
      expect(m.prof).toEqual({ cm: 15.8, origen: "manual" });
    }
  });

  it("la que falta se estima y se marca; la que está se respeta", () => {
    const avisos: string[] = [];
    const m = resolverMedidas("notebook", { ancho: 33, prof: null, fuente: "manual" }, avisos);
    expect(m.ancho).toEqual({ cm: 33, origen: "manual" });
    expect(m.prof.origen).toBe("estimada");
    expect(m.prof.cm).toBeCloseTo((33 * MEDIDA_TIPICA_CM.notebook!.prof) / MEDIDA_TIPICA_CM.notebook!.ancho);
    expect(avisos.join(" ")).toMatch(/Falta la profundidad/);
  });

  it("sin medidas, un equipo que no es notebook no usa la carcasa de notebook", () => {
    const m = resolverMedidas("otro", { ancho: null, prof: null }, []);
    expect(m.ancho.cm).not.toBe(MEDIDA_TIPICA_CM.notebook!.ancho);
    expect(m.ancho.origen).toBe("estimada");
    expect(m.prof.origen).toBe("estimada");
  });

  it("sin fuente declarada, la medida se toma como estimada", () => {
    expect(resolverMedidas("otro", { ancho: 7.4, prof: 15.8 }, []).ancho.origen).toBe("estimada");
  });

  it("la plantilla de notebook (IA caída) no le pone 36 × 25 cm a un celular", () => {
    const { plano, medidas } = planoDesdePlantilla(celular);
    const [W, , D] = plano.piezas.find((p) => p.pieza === "base")!.dim;
    expect([W, D]).not.toEqual([MEDIDA_TIPICA_CM.notebook!.ancho, MEDIDA_TIPICA_CM.notebook!.prof]);
    expect(medidas.ancho.origen).toBe("estimada");
  });
});
