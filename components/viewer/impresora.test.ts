import { describe, expect, it } from "vitest";
import { fichaEjemplo, PlanoDePiezas, type Coreografia, type KnowledgePack, type PiezaPlano, type Vec3 } from "../../shared";
import type { LlamarIA } from "../../lib/ia/claude";
import { IndicePiezas, tipoPara } from "../../lib/planogenerator/biblioteca";
import { obtenerPlano } from "../../lib/planogenerator/obtener";
import { PLANTILLAS_POR_TIPO } from "../../lib/planogenerator/plantillas/por-tipo";
import indice from "../../public/models/piezas/indice.json";
import { conDesarme } from "./guia/desarme";
import { prepararEscena } from "./escena";
import { aplicarCoreografia, estadoInicial } from "./reproductor";

/**
 * #287: la prueba real mostró una impresora casi vacía. Un plano PARCIAL de la caché se completa con el
 * interior de su TECNOLOGÍA (láser o tinta, la elige el modelo del pack), sin mezclar piezas de la otra, y
 * arranca con la carcasa puesta: se abre recién en el paso que la saca. Sin IA. Dos variantes por tecnología.
 */

const NOMBRES = Object.keys(IndicePiezas.parse(indice).tipos);
const SOLO_LASER = ["cartucho_toner", "unidad_fusora", "unidad_laser", "rodillo_transferencia", "puerta_frontal", "carcasa_impresora"];
const SOLO_TINTA = ["cabezal_impresion", "carro_impresion", "riel_lineal", "cinta_encoder", "cartucho_tinta_negro", "cartucho_tinta_color", "tapa_impresora"];

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

/** Lo que dejó guardado la prueba real: una base y una o dos piezas estimadas, nada más. */
const parcial = (W: number, D: number, piezas: Array<[string, Vec3, Vec3]>): PlanoDePiezas => ({
  modelo: "guardado",
  unidades: "cm",
  medidas: { ancho: "estimada", prof: "estimada" },
  piezas: [
    { pieza: "base", forma: "caja", dim: [W, 1.2, D], pos: [0, 0, 0], pivote: [0, 0, 0], origen: "estimada" },
    ...piezas.map(([pieza, dim, pos]): PiezaPlano => ({ pieza, forma: "caja", dim, pos, pivote: [0, 0, 0], padre: "base", origen: "estimada" })),
  ],
});

async function releer(guardado: PlanoDePiezas, kp: KnowledgePack) {
  const cache = { get: async () => ({ plano: guardado, avisos: [], manualUrl: null, piezasPedidas: kp.piezas.map((p) => p.id) }), set: async () => {} };
  const ficha = { ...fichaEjemplo, modelo: { ...fichaEjemplo.modelo, valor: kp.modelo } };
  const sinIA: LlamarIA = async () => {
    throw new Error("no debería llamar a la IA");
  };
  const r = await obtenerPlano({ casoId: "c", knowledgePack: kp, ficha, tipoEquipo: "impresora" }, { cache, llamar: sinIA });
  expect(() => PlanoDePiezas.parse(r.plano)).not.toThrow();
  return r.plano;
}

const ids = (p: PlanoDePiezas) => p.piezas.map((x) => x.pieza);
const plantilla = (id: string) => PLANTILLAS_POR_TIPO.find((t) => t.id === id)!.plano;
/** Cada pieza del esqueleto está en el plano: con su id o con otra del mismo tipo (el cartucho negro del pack cuenta por el de color). */
const faltan = (plano: PlanoDePiezas, esqueleto: PlanoDePiezas) => {
  const tipos = new Set(ids(plano).map((id) => tipoPara(id, NOMBRES) ?? id));
  // El tanque de tinta es opcional: solo está si el pack lo nombra.
  return ids(esqueleto).filter((id) => id !== "tanque_tinta" && !ids(plano).includes(id) && !tipos.has(tipoPara(id, NOMBRES) ?? id));
};
const paso = (n: number, dice: string, acciones: Coreografia["acciones"] = []): Coreografia => ({ paso: n, dice, acciones, riesgo: "bajo" });

describe("impresora con plano parcial (#287): el interior se completa por tecnología", () => {
  it.each([
    ["HP LaserJet Pro M15w", 35, 19, ["cartucho_toner", "unidad_fusora"], [["cartucho_toner", [24, 8, 8], [0, 6, 2]]]],
    ["Brother HL-L2350DW", 36, 36, ["cartucho_toner", "rodillo_recogida", "placa_control"], [["placa_control", [12, 1.5, 9], [10, 1, -12]]]],
  ] as const)("láser %s: todo el interior de una láser y nada de tinta", async (modelo, W, D, piezas, guardadas) => {
    const plano = await releer(parcial(W, D, guardadas.map(([p, d, x]) => [p, [...d] as Vec3, [...x] as Vec3])), pack(modelo, [...piezas]));
    expect(faltan(plano, plantilla("impresora_laser"))).toEqual([]);
    for (const id of SOLO_TINTA) expect(ids(plano)).not.toContain(id);
    expect(plano.piezas.find((p) => !p.padre)!.pieza).toBe("carcasa_impresora");
  });

  it.each([
    ["Epson EcoTank L3250", 38, 35, ["cabezal_impresion", "cartucho_tinta_negro"], [["cabezal_impresion", [7, 5, 5], [-6, 5, -5]]]],
    ["HP DeskJet 2775", 42, 30, ["rodillo_recogida", "placa_control"], [["placa_control", [12, 1.5, 9], [10, 1, -12]]]],
  ] as const)("tinta %s: todo el interior de una de tinta, con su tapa, y nada de láser", async (modelo, W, D, piezas, guardadas) => {
    const plano = await releer(parcial(W, D, guardadas.map(([p, d, x]) => [p, [...d] as Vec3, [...x] as Vec3])), pack(modelo, [...piezas]));
    expect(faltan(plano, plantilla("impresora"))).toEqual([]);
    for (const id of SOLO_LASER) expect(ids(plano)).not.toContain(id);
    expect(ids(plano)).toContain("tapa_impresora");
  });
});

describe("impresora (#287): arranca con la carcasa puesta y la saca el paso que lo dice", () => {
  it.each([
    ["Epson EcoTank L3250", ["cabezal_impresion"]],
    ["HP DeskJet 2775", ["placa_control"]],
  ])("tinta %s: la tapa se corre recién en «abrí la tapa»", async (modelo, piezas) => {
    const plano = await releer(parcial(40, 32, [["placa_control", [12, 1.5, 9], [10, 1, -12]]]), pack(modelo, piezas));
    const escena = prepararEscena(plano, undefined, "impresora");
    expect(escena.cubiertas.tapa_impresora).toBe("tapa");
    const inicio = estadoInicial(escena.nodos.keys(), escena.cubiertas, escena.lados);
    expect(inicio.abierto).toBe(false);
    const antes = aplicarCoreografia(inicio, conDesarme(paso(1, "Desenchufá la impresora y esperá un minuto."), plano), { casoId: "c" }).estado;
    expect(antes.abierto).toBe(false);
    expect(antes.piezas.tapa_impresora.desp).toEqual([0, 0, 0]);
    const abierta = aplicarCoreografia(antes, conDesarme(paso(2, "Abrí la tapa con cuidado."), plano), { casoId: "c" }).estado;
    expect(abierta.abierto).toBe(true);
    expect(abierta.piezas.tapa_impresora.desp).not.toEqual([0, 0, 0]);
  });

  it.each([["HP LaserJet Pro M15w"], ["Brother HL-L2350DW"]])("láser %s: la carcasa queda cerrada hasta que el paso abre la puerta del tóner", async (modelo) => {
    const plano = await releer(parcial(36, 30, [["cartucho_toner", [24, 8, 8], [0, 6, 2]]]), pack(modelo, ["cartucho_toner"]));
    const escena = prepararEscena(plano, undefined, "impresora");
    expect(escena.cubiertas.carcasa_impresora).toBe("raiz");
    const inicio = estadoInicial(escena.nodos.keys(), escena.cubiertas, escena.lados);
    expect(inicio.abierto).toBe(false);
    const antes = aplicarCoreografia(inicio, paso(1, "Apagá la impresora.", [{ t: "camara", objetivo: "general" }]), { casoId: "c" }).estado;
    expect(antes.abierto).toBe(false);
    const abierta = aplicarCoreografia(antes, paso(2, "Abrí la puerta frontal.", [{ t: "ocultar", pieza: "puerta_frontal" }]), { casoId: "c" }).estado;
    expect(abierta.abierto).toBe(true);
  });
});
