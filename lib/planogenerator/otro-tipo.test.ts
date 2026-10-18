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

/** Un plano guardado ya terminado con el esqueleto de OTRO tipo: la raíz de esa plantilla y lo que le sumó. */
const guardadoComo = (raiz: string, dim: Vec3, piezas: Array<[string, Vec3, Vec3, PiezaPlano["origen"]]>): PlanoDePiezas => ({
  modelo: "guardado",
  unidades: "cm",
  piezas: [
    { pieza: raiz, forma: "caja", dim, pos: [0, dim[1] / 2, 0], pivote: [0, 0, 0], origen: "estimada" },
    ...piezas.map(([pieza, d, pos, origen]): PiezaPlano => ({ pieza, forma: "caja", dim: d, pos, pivote: [0, 0, 0], padre: raiz, origen })),
  ],
});

describe("planos de la caché armados con el esqueleto de otro tipo (#239): se limpian al leerlos", () => {
  it.each([["Canon PIXMA G3110"], ["Epson EcoTank L3250"]])("impresora de tinta guardada como láser: %s", async (modelo) => {
    const viejo = guardadoComo("carcasa_impresora", [44, 22, 34], [
      ["placa_control", [12, 1.5, 9], [10, 3, -12], "estimada"],
      ["rodillo_recogida", [22, 1.6, 1.6], [0, 6.5, -13], "plantilla"],
      ["cartucho_toner", [27, 9, 9], [0, 12.5, 4], "plantilla"],
      ["unidad_fusora", [26, 6.2, 6.3], [0, 10, -12], "plantilla"],
      ["unidad_laser", [20, 4, 12], [0, 19, -3], "plantilla"],
      ["rodillo_transferencia", [26, 1.6, 1.6], [0, 7.2, 6], "plantilla"],
      ["puerta_frontal", [30, 9.5, 1.6], [0, 11.75, 18.3], "plantilla"],
    ]);
    const plano = await leer(viejo, pack(modelo, ["rodillo_recogida", "placa_control"]), "impresora");
    for (const laser of ["cartucho_toner", "unidad_fusora", "unidad_laser", "rodillo_transferencia", "puerta_frontal"]) expect(ids(plano)).not.toContain(laser);
    expect(ids(plano)).toEqual(expect.arrayContaining(["cabezal_impresion", "rodillo_recogida", "placa_control"]));
    expect(plano.piezas.find((p) => !p.padre)!.pieza).toBe("bandeja_papel");
    expect(plano.piezas.every((p) => !p.padre || ids(plano).includes(p.padre))).toBe(true);
  });

  it.each([["Xbox Series S"], ["PlayStation 5 Digital"]])("consola guardada con los joysticks y la tapa que los envolvía: %s", async (modelo) => {
    const viejo = guardadoComo("placa_consola", [29, 1.2, 24], [
      ["ventilador", [8, 3, 8], [-8, 1.5, -5], "estimada"],
      ["joystick_analogico_izquierdo", [2.5, 2.7, 2], [26, 1.4, 4], "plantilla"],
      ["boton_gatillo_derecho", [4, 1.2, 2.5], [34, 0.6, -2], "plantilla"],
      ["tapa_consola", [72, 9, 25], [17, 4.5, 0], "plantilla"],
    ]);
    const plano = await leer(viejo, pack(modelo, ["ventilador", "disipador"]), "consola");
    expect(ids(plano)).not.toContain("joystick_analogico_izquierdo");
    expect(ids(plano)).not.toContain("boton_gatillo_derecho");
    // La tapa se vuelve a armar envolviendo lo que quedó: ya no llega hasta donde estaban los gatillos (x = 53).
    const tapa = plano.piezas.find((p) => p.pieza === "tapa_consola")!;
    expect(tapa.dim[0]).toBeLessThan(72 * 0.75);
    expect(tapa.pos[0] + tapa.dim[0] / 2).toBeLessThan(36);
  });

  it.each([["Bose QuietComfort 45"], ["JBL Tune 510BT"]])("auriculares de vincha guardados como in-ear con estuche: %s", async (modelo) => {
    const viejo = guardadoComo("estuche_auriculares", [19, 8, 17], [
      ["bateria", [3, 0.8, 2.4], [5, 2, 1], "estimada"],
      ["carcasa_auricular_izquierdo", [5.7, 3.9, 6.9], [-4, 6, 0], "plantilla"],
      ["placa_estuche", [15, 0.3, 13], [0, 0.4, 0], "plantilla"],
      ["contacto_resorte_derecho", [1.1, 1.7, 1.1], [4, 2.7, 0], "plantilla"],
    ]);
    const plano = await leer(viejo, pack(modelo, ["bateria", "almohadilla_oreja_izquierda"]), "auriculares");
    for (const inEar of ["estuche_auriculares", "carcasa_auricular_izquierdo", "placa_estuche", "contacto_resorte_derecho"]) expect(ids(plano)).not.toContain(inEar);
    const raiz = plano.piezas.find((p) => !p.padre)!;
    expect(raiz.pieza).toBe("diadema");
    expect(raiz.dim[2]).toBeLessThan(17 * 0.3);
    expect(ids(plano)).toEqual(expect.arrayContaining(["copa_izquierda", "copa_derecha", "bateria"]));
  });

  it("un plano guardado del mismo tipo no cambia (lo que sumó su esqueleto sigue)", async () => {
    const viejo = guardadoComo("placa_consola", [29, 1.2, 24], [
      ["ventilador", [8, 3, 8], [-8, 1.5, -5], "estimada"],
      ["unidad_optica", [14, 2.3, 14.7], [-4, 6.4, 0], "plantilla"],
    ]);
    const plano = await leer(viejo, pack("Xbox One X", ["ventilador"]), "consola");
    expect(plano.piezas.find((p) => p.pieza === "unidad_optica")!.origen).toBe("plantilla");
    expect(plano.piezas.find((p) => !p.padre)!.pieza).toBe("placa_consola");
  });
});
