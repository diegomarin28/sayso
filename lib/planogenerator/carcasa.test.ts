import { describe, expect, it } from "vitest";
import { fichaEjemplo, PlanoDePiezas, type KnowledgePack, type PiezaPlano } from "../../shared";
import { cachePlanosEnMemoria } from "./cache";
import { ajustarPlanoAlTipo, conTapa } from "./carcasa";
import { obtenerPlano } from "./obtener";
import { PLANTILLAS_POR_TIPO } from "./plantillas/por-tipo";
import { claveManual } from "../knowledge/manuales";

const plantilla = (id: string) => PLANTILLAS_POR_TIPO.find((p) => p.id === id)!;
const pieza = (id: string, dim: [number, number, number], pos: [number, number, number], padre?: string): PiezaPlano => ({
  pieza: id, forma: "caja", dim, pos, pivote: [0, 0, 0], ...(padre ? { padre } : {}), origen: "estimada",
});
/** Como lo arma el generador para un celular: chasis de notebook de 1,2 cm y las piezas apiladas encima (1,6 cm en total). */
const celularDelGenerador: PlanoDePiezas = {
  modelo: "celular",
  unidades: "cm",
  piezas: [
    pieza("base", [7.15, 1.2, 14.67], [0, 0, 0]),
    pieza("placa_madre", [6.08, 0.15, 4.4], [0, 0.67, -4.4], "base"),
    pieza("bateria", [5, 0.4, 5.87], [0.43, 0.8, 0.85], "base"),
    pieza("parlante_inferior", [1.8, 0.3, 1.47], [0, 0.75, 5.87], "base"),
  ],
};
/** Un TV guardado en la caché antes de pararlo: acostado, con la profundidad (7,5) como alto de la cara. */
const tvViejo: PlanoDePiezas = {
  modelo: "tv",
  unidades: "cm",
  piezas: [pieza("base", [123, 1.2, 7.5], [0, 0, 0]), pieza("placa_principal", [22, 1.5, 4.5], [12, 1.35, 0], "base")],
};
const raiz = (p: PlanoDePiezas) => p.piezas.find((x) => !x.padre)!;
const espesor = (p: PlanoDePiezas) => Math.max(...p.piezas.map((x) => x.pos[1] + x.dim[1] / 2)) - Math.min(...p.piezas.map((x) => x.pos[1] - x.dim[1] / 2));

describe("ajustarPlanoAlTipo", () => {
  it("celular: la carcasa es el marco (no el chasis de notebook), con su espesor real y la tapa trasera (arranca cerrado)", () => {
    const r = conTapa(ajustarPlanoAlTipo(celularDelGenerador, plantilla("celular")), plantilla("celular"));
    expect(() => PlanoDePiezas.parse(r)).not.toThrow();
    expect(raiz(r).pieza).toBe("marco");
    expect(raiz(r).dim[0]).toBeCloseTo(7.15, 5);
    expect(raiz(r).dim[2]).toBeCloseTo(14.67, 5);
    expect(raiz(r).dim[1]).toBeCloseTo(0.8, 5); // iPhone ≈ 0,8 cm, no 1,6
    const tapa = r.piezas.find((x) => x.pieza === "tapa_trasera")!;
    expect(tapa.padre).toBe("marco");
    expect(tapa.pos[1] - tapa.dim[1] / 2).toBeGreaterThanOrEqual(Math.max(...r.piezas.filter((x) => x !== tapa).map((x) => x.pos[1] + x.dim[1] / 2)) - 1e-6);
    expect(espesor(r)).toBeLessThan(1.1);
    for (const x of r.piezas.filter((y) => y.padre)) expect(x.padre).not.toBe("base");
  });

  it("notebook: la base queda como está y se agrega la tapa inferior si falta (una sola vez)", () => {
    const nb: PlanoDePiezas = { ...celularDelGenerador, piezas: [pieza("base", [34, 1.2, 24], [0, 0, 0]), pieza("bateria", [26, 0.8, 7.5], [0, 1, 7], "base")] };
    const terminar = (p: PlanoDePiezas) => conTapa(ajustarPlanoAlTipo(p, plantilla("notebook")), plantilla("notebook"));
    const r = terminar(nb);
    expect(raiz(r)).toEqual(nb.piezas[0]);
    expect(r.piezas.filter((x) => x.pieza === "tapa_inferior")).toHaveLength(1);
    expect(terminar(r)).toEqual(r);
  });

  it("TV viejo de la caché (123 × 7,5 acostado): parado, con la carcasa del TV y el alto típico estimado", () => {
    const r = ajustarPlanoAlTipo(tvViejo, plantilla("televisor"));
    const [ancho, alto, prof] = raiz(r).dim;
    expect(raiz(r).pieza).toBe("carcasa_televisor");
    expect(ancho).toBe(123);
    expect(alto).toBeCloseTo(123 * 0.66, 0);
    expect(prof).toBe(10);
    expect(r.medidas?.prof).toBe("estimada");
    expect(Math.min(...r.piezas.map((x) => x.pos[1] - x.dim[1] / 2))).toBeCloseTo(0, 6);
  });

  it("es idempotente y no toca un plano que ya tiene su forma (ej. una plantilla)", () => {
    for (const [plano, id] of [[celularDelGenerador, "celular"], [tvViejo, "televisor"]] as const) {
      const una = ajustarPlanoAlTipo(plano, plantilla(id));
      expect(ajustarPlanoAlTipo(una, plantilla(id)), id).toEqual(una);
    }
    expect(ajustarPlanoAlTipo(plantilla("heladera").plano, plantilla("heladera"))).toBe(plantilla("heladera").plano);
  });

  it("un plano viejo de la caché se ajusta al leerlo (sin llamar a la IA)", async () => {
    const kp: KnowledgePack = {
      modelo: "TV", clase: "otro", verificado: false, fuentes: [{ doc: "manual" }], pasos: [], advertencias: [], repuestos: [],
      piezas: [{ id: "placa_principal", nombre: "placa", descripcion: "", ubicacion: "" }],
    };
    const cache = cachePlanosEnMemoria();
    await cache.set(claveManual(fichaEjemplo.marca.valor, fichaEjemplo.modelo.valor!), fichaEjemplo.marca.valor ?? "", fichaEjemplo.modelo.valor!, {
      plano: tvViejo, avisos: [], manualUrl: null, piezasPedidas: ["placa_principal"],
    });
    const r = await obtenerPlano({ casoId: "c", knowledgePack: kp, ficha: fichaEjemplo, tipoEquipo: "televisor" }, { cache, llamar: async () => { throw new Error("no debería llamar a la IA"); } });
    expect(r.desdeCache).toBe(true);
    expect(raiz(r.plano).pieza).toBe("carcasa_televisor");
    expect(raiz(r.plano).dim[1]).toBeGreaterThan(raiz(r.plano).dim[2]);
  });
});
