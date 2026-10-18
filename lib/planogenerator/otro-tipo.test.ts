import { describe, expect, it } from "vitest";
import { fichaEjemplo, PlanoDePiezas, type KnowledgePack, type PiezaPlano, type Vec3 } from "../../shared";
import type { LlamarIA } from "../ia/claude";
import { obtenerPlano } from "./obtener";
import { elegirPlantilla } from "./plantillas/por-tipo";

/**
 * #239: el 3D no suma piezas de OTRO tipo de equipo (tóner en una de tinta, joysticks en una consola, estuche
 * en unos de vincha). Por tipo, nunca por modelo: dos variantes de cada uno, que no son las de la QA.
 */

const pack = (modelo: string, ids: string[]): KnowledgePack => ({
  modelo,
  clase: "otro",
  verificado: false,
  fuentes: [{ doc: "guía pública" }],
  piezas: ids.map((id) => ({ id, nombre: id.replace(/_/g, " "), descripcion: "", ubicacion: "" })),
  pasos: [],
  advertencias: [],
  repuestos: [],
});

const planoViejo = (W: number, D: number, piezas: Array<[string, Vec3, Vec3]>): PlanoDePiezas => ({
  modelo: "guardado",
  unidades: "cm",
  medidas: { ancho: "estimada", prof: "estimada" },
  piezas: [
    { pieza: "base", forma: "caja", dim: [W, 1.2, D], pos: [0, 0, 0], pivote: [0, 0, 0], origen: "estimada" },
    ...piezas.map(([pieza, dim, pos]): PiezaPlano => ({ pieza, forma: "caja", dim, pos, pivote: [0, 0, 0], padre: "base", origen: "estimada" })),
  ],
});

async function leer(guardado: PlanoDePiezas, kp: KnowledgePack, tipoEquipo: string) {
  const cache = { get: async () => ({ plano: guardado, avisos: [], manualUrl: null, piezasPedidas: kp.piezas.map((p) => p.id) }), set: async () => {} };
  const ficha = { ...fichaEjemplo, modelo: { ...fichaEjemplo.modelo, valor: kp.modelo } };
  const sinIA: LlamarIA = async () => {
    throw new Error("no debería llamar a la IA");
  };
  const r = await obtenerPlano({ casoId: "c", knowledgePack: kp, ficha, tipoEquipo }, { cache, llamar: sinIA });
  expect(() => PlanoDePiezas.parse(r.plano)).not.toThrow();
  return r.plano;
}

const ids = (p: PlanoDePiezas) => p.piezas.map((x) => x.pieza);

describe("impresora de tinta (Canon PIXMA, Brother DCP-T): sin piezas de láser", () => {
  it.each([
    ["Canon PIXMA G3110", ["rodillo_recogida", "placa_control"]],
    ["Brother DCP-T420W", ["rodillo_alimentacion", "cabezal_impresion"]],
  ])("%s, leído de la caché", async (modelo, piezas) => {
    const plano = await leer(planoViejo(44, 34, [["placa_control", [12, 1.5, 9], [10, 1, -12]]]), pack(modelo, piezas), "impresora");
    for (const laser of ["cartucho_toner", "unidad_fusora", "unidad_laser", "rodillo_transferencia"]) expect(ids(plano)).not.toContain(laser);
    expect(ids(plano)).toContain("cabezal_impresion");
  });

  it("el modelo desempata: una línea de tinta va a la de tinta aunque el pack nombre un rodillo; una láser, a la láser", () => {
    const rodillo = [{ id: "rodillo_recogida" }];
    expect(elegirPlantilla({ clase: "otro", piezas: rodillo, modelo: "Epson EcoTank L3150" }, "impresora")?.id).toBe("impresora");
    expect(elegirPlantilla({ clase: "otro", piezas: rodillo, modelo: "HP DeskJet 2775" }, "impresora")?.id).toBe("impresora");
    expect(elegirPlantilla({ clase: "otro", piezas: rodillo, modelo: "HP LaserJet Pro M15w" }, "impresora")?.id).toBe("impresora_laser");
    expect(elegirPlantilla({ clase: "otro", piezas: [{ id: "cartucho_toner" }], modelo: "Brother HL-1212W" }, "impresora")?.id).toBe("impresora_laser");
  });
});

describe("consola de mesa (Xbox One S, PS5 Digital): sin joysticks si el pack no los nombra", () => {
  it.each([
    ["Xbox One S", ["ventilador", "disipador"]],
    ["PlayStation 5 Digital", ["fuente", "unidad_optica"]],
  ])("%s, leído de la caché", async (modelo, piezas) => {
    const plano = await leer(planoViejo(29, 24, [["ventilador", [8, 3, 8], [-8, 1, -5]]]), pack(modelo, piezas), "consola");
    for (const mando of ["joystick_analogico_izquierdo", "joystick_analogico_derecho", "boton_gatillo_izquierdo", "boton_gatillo_derecho"]) expect(ids(plano)).not.toContain(mando);
    expect(ids(plano)).toContain("placa_consola");
  });

  it("si el pack nombra el joystick (drift del mando), está", async () => {
    const plano = await leer(planoViejo(29, 24, []), pack("Nintendo Switch OLED", ["joystick_analogico_izquierdo"]), "consola");
    expect(ids(plano)).toContain("joystick_analogico_izquierdo");
    expect(ids(plano)).not.toContain("boton_gatillo_derecho");
  });
});

describe("auriculares de vincha (Bose QC45, JBL Tune 510BT): copas y vincha, sin estuche", () => {
  it.each([
    ["Bose QuietComfort 45", ["almohadilla_oreja_izquierda", "bateria"], 19, 17],
    ["JBL Tune 510BT", ["copa_derecha", "placa"], 17, 15],
  ])("%s, leído de la caché", async (modelo, piezas, W, D) => {
    const plano = await leer(planoViejo(W, D, [["bateria", [3, 0.8, 2.4], [5, 0.5, 1]]]), pack(modelo, piezas), "auriculares");
    for (const inEar of ["estuche_auriculares", "placa_estuche", "contacto_resorte_izquierdo", "almohadilla_silicona_izquierda"]) expect(ids(plano)).not.toContain(inEar);
    expect(ids(plano)).toEqual(expect.arrayContaining(["copa_izquierda", "copa_derecha", "parlante_izquierdo"]));
    // La raíz es la vincha: un arco atrás, no una base del tamaño de los auriculares.
    const raiz = plano.piezas.find((p) => !p.padre)!;
    expect(raiz.pieza).toBe("diadema");
    expect(raiz.dim[2]).toBeLessThan(D * 0.3);
    const copa = plano.piezas.find((p) => p.pieza === "copa_izquierda")!;
    expect(raiz.pos[2]).toBeLessThan(copa.pos[2]);
  });

  it("los in-ear con estuche siguen siendo in-ear", () => {
    expect(elegirPlantilla({ clase: "otro", piezas: [{ id: "estuche_auriculares" }], modelo: "Samsung Galaxy Buds2" }, "auriculares")?.id).toBe("auriculares");
    expect(elegirPlantilla({ clase: "otro", piezas: [], modelo: "Apple AirPods Pro" }, "auriculares")?.id).toBe("auriculares");
    expect(elegirPlantilla({ clase: "otro", piezas: [{ id: "almohadilla_oreja" }], modelo: "Sony WH-CH520" }, "auriculares")?.id).toBe("auriculares_vincha");
  });
});
