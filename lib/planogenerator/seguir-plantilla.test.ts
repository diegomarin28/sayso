import { describe, expect, it } from "vitest";
import { fichaEjemplo, PlanoDePiezas, type KnowledgePack, type PiezaPlano, type Vec3 } from "../../shared";
import type { LlamarIA } from "../ia/claude";
import { generarPlano } from "./generador";
import { obtenerPlano } from "./obtener";
import { PLANTILLAS_POR_TIPO } from "./plantillas/por-tipo";
import indice from "../../public/models/piezas/indice.json";
import { IndicePiezas, tipoPara } from "./biblioteca";
import { acotarMedidas, seguirPlantilla, VECES_LA_FORMA } from "./seguir-plantilla";

/**
 * Reglas por TIPO de equipo, nunca por modelo: cada tipo se prueba con al menos dos variantes que no son
 * las de la demo (marcas, tamaños e ids de pieza distintos). Si alguien ata un arreglo a un modelo, la
 * otra variante falla.
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

/** Un plano como los que quedaron en la caché antes del ajuste por tipo: la base acostada, de W × 1,2 × D. */
const planoViejo = (W: number, D: number, piezas: Array<[string, Vec3, Vec3]>): PlanoDePiezas => ({
  modelo: "guardado",
  unidades: "cm",
  medidas: { ancho: "estimada", prof: "estimada" },
  piezas: [
    { pieza: "base", forma: "caja", dim: [W, 1.2, D], pos: [0, 0, 0], pivote: [0, 0, 0], origen: "estimada" },
    ...piezas.map(([pieza, dim, pos]): PiezaPlano => ({ pieza, forma: "caja", dim, pos, pivote: [0, 0, 0], padre: "base", origen: "estimada" })),
  ],
});

/** Lee de la caché (sin IA): el mismo camino que la app con un plano guardado. */
async function leer(guardado: PlanoDePiezas, kp: KnowledgePack, tipoEquipo: string) {
  const cache = { get: async () => ({ plano: guardado, avisos: [], manualUrl: null, piezasPedidas: kp.piezas.map((p) => p.id) }), set: async () => {} };
  const ficha = { ...fichaEjemplo, modelo: { ...fichaEjemplo.modelo, valor: kp.modelo } };
  const sinIA: LlamarIA = async () => {
    throw new Error("no debería llamar a la IA");
  };
  const r = await obtenerPlano({ casoId: "c", knowledgePack: kp, ficha, tipoEquipo }, { cache, llamar: sinIA });
  expect(r.desdeCache).toBe(true);
  expect(() => PlanoDePiezas.parse(r.plano)).not.toThrow();
  return r.plano;
}

const raiz = (p: PlanoDePiezas) => p.piezas.find((x) => !x.padre)!;
const pieza = (p: PlanoDePiezas, id: string) => p.piezas.find((x) => x.pieza === id);
/** Qué fracción de la raíz ocupa la pieza en cada eje. */
const fraccion = (p: PlanoDePiezas, id: string) => pieza(p, id)!.dim.map((v, i) => v / raiz(p).dim[i]);

describe("celular (Samsung, Motorola): pantalla, batería y tornillos con sentido", () => {
  it.each([
    ["Samsung Galaxy S21", "s21", 7.1, 15.1],
    ["Motorola Moto G52", "g52", 7.5, 16.1],
  ])("%s, leído de la caché", async (modelo, sufijo, W, D) => {
    const kp = pack(modelo, [`bateria_${sufijo}`, `pantalla_${sufijo}`, `placa_principal_${sufijo}`, `tornillo_${sufijo}`]);
    // Como lo dejaba la IA sin manual: la batería cuadrada y aplastada, la pantalla sin ubicar, un tornillo de 5 cm.
    const viejo = planoViejo(W, D, [
      [`bateria_${sufijo}`, [5, 0.4, 5.9], [0.4, 0.8, 0.9]],
      [`placa_principal_${sufijo}`, [6, 0.15, 4.4], [0, 0.7, -4.4]],
      [`tornillo_${sufijo}`, [5, 0.1, 0.3], [0, 0.65, 7]],
    ]);
    const plano = await leer(viejo, kp, "celular");
    expect(raiz(plano).pieza).toBe("marco");
    // La pantalla que la IA no ubicó ocupa el frente, como en cualquier celular.
    const [fx, , fz] = fraccion(plano, `pantalla_${sufijo}`);
    expect(fx).toBeGreaterThan(0.85);
    expect(fz).toBeGreaterThan(0.85);
    // La batería, con la proporción de una de celular (más larga que ancha), dentro del marco.
    const bat = pieza(plano, `bateria_${sufijo}`)!;
    expect(bat.dim[2]).toBeGreaterThan(bat.dim[0]);
    expect(bat.dim[0]).toBeLessThan(raiz(plano).dim[0]);
    // El tornillo, chico.
    expect(Math.max(...pieza(plano, `tornillo_${sufijo}`)!.dim)).toBeLessThan(2);
  });
});

describe("TV (LG 43\", Samsung 65\"): la cara es la pantalla y la placa no se estira", () => {
  it.each([
    ["LG 43UQ7500", 97, 5.8],
    ["Samsung QN65Q60", 145, 6.1],
  ])("%s, leído de la caché (plano acostado con la profundidad)", async (modelo, W, D) => {
    const kp = pack(modelo, ["placa_principal_av", "retroiluminacion"]);
    // El plano viejo: la retroiluminación como una tira de 0,75 cm y la placa de 4,5 cm de alto.
    const viejo = planoViejo(W, D, [
      ["placa_principal_av", [W * 0.18, 1.5, 4.5], [W * 0.1, 1.35, 0]],
      ["retroiluminacion", [W * 0.95, 0.5, 0.75], [0, 0.85, D * 0.45]],
    ]);
    const plano = await leer(viejo, kp, "televisor");
    expect(raiz(plano).pieza).toBe("carcasa_televisor");
    const [W2, H2] = raiz(plano).dim;
    expect(H2 / W2).toBeGreaterThan(0.45); // parado, con la proporción de un TV
    // La retroiluminación es un panel, no una tira.
    const [rx, ry] = fraccion(plano, "retroiluminacion");
    expect(rx).toBeGreaterThan(0.85);
    expect(ry).toBeGreaterThan(0.75);
    // Sin pantalla en el pack, se suma la del esqueleto: de frente se ve un TV.
    const [px, py] = fraccion(plano, "pantalla_panel");
    expect(px).toBeGreaterThan(0.9);
    expect(py).toBeGreaterThan(0.8);
    // La placa principal toma la del esqueleto (nombre equivalente): una placa, no un tablón de medio metro.
    expect(pieza(plano, "placa_principal_av")!.dim[1]).toBeLessThan(20);
    expect(pieza(plano, "placa_principal_av")!.origen).toBe("plantilla");
  });
});

/** La IA sin manual: devuelve ubicaciones estimadas (sin página). */
const iaEstimada =
  (piezas: Array<[string, number, number, number, number]>, ancho: number, prof: number): LlamarIA =>
  async () =>
    JSON.stringify({
      base_ancho_cm: ancho,
      base_prof_cm: prof,
      medidas_fuente: "estimada",
      piezas: piezas.map(([id, x, z, a, p]) => ({
        pieza: id, x, z, ancho: a, prof: p, alto_cm: null, capa: "sobre_base", sobre: null, forma: "caja", etiquetaManual: null, pagina: null, confianza: "baja",
      })),
    });

describe("al generar (IA simulada, sin gastar): impresora láser y notebook de dos marcas", () => {
  it.each([
    ["Brother HL-L2350DW", 36, 36],
    ["Samsung Xpress M2020", 33, 26],
  ])("impresora láser %s: el tóner y el fusor van donde van en una láser", async (modelo, W, D) => {
    const kp = pack(modelo, ["cartucho_toner", "unidad_fusora", "placa_control"]);
    const ia = iaEstimada([["cartucho_toner", 0, 0, 0.1, 0.1], ["unidad_fusora", 0, 0, 0.1, 0.1], ["placa_control", 0.5, 0.5, 0.2, 0.2]], W, D);
    const r = await generarPlano({ casoId: "c", knowledgePack: kp, tipoEquipo: `impresora láser ${modelo}` }, ia);
    const laser = PLANTILLAS_POR_TIPO.find((p) => p.id === "impresora_laser")!;
    const toner = laser.plano.piezas.find((p) => p.pieza === "cartucho_toner")!;
    const fraccionT = toner.dim[0] / laser.plano.piezas.find((p) => !p.padre)!.dim[0];
    expect(fraccion(r.plano, "cartucho_toner")[0]).toBeCloseTo(fraccionT, 1);
    expect(pieza(r.plano, "cartucho_toner")!.origen).toBe("plantilla");
  });

  it.each([["Lenovo IdeaPad 3"], ["HP Pavilion 15"]])("notebook %s: lo estimado sigue al esqueleto; lo citado del manual, no", async (modelo) => {
    const kp = pack(modelo, ["bateria", "ventilador", "ram"]);
    const ia: LlamarIA = async (p) => {
      const base = JSON.parse(await iaEstimada([["bateria", 0, 0, 0.1, 0.1], ["ventilador", 0.6, -0.5, 0.2, 0.3], ["ram", 0, 0, 0.1, 0.1]], 36, 25)(p));
      base.piezas[1] = { ...base.piezas[1], pagina: 12, confianza: "alta" }; // el ventilador, visto en una página
      return JSON.stringify(base);
    };
    const r = await generarPlano({ casoId: "c", knowledgePack: kp, tipoEquipo: "notebook" }, ia);
    expect(pieza(r.plano, "bateria")!.origen).toBe("plantilla");
    expect(pieza(r.plano, "ventilador")!.origen).toBe("manual");
    expect(pieza(r.plano, "ventilador")!.pos[0]).toBeCloseTo(0.6 * 18, 0); // donde lo vio la IA
  });
});

describe("piezas genéricas: lo que el esqueleto del tipo tiene y el pack no nombra (#187)", () => {
  const NOMBRES = Object.keys(IndicePiezas.parse(indice).tipos);
  /** Las genéricas del plano: de la plantilla y fuera del pack (las que el visor pinta en gris). */
  const genericas = (p: PlanoDePiezas, kp: KnowledgePack) => p.piezas.filter((x) => x.origen === "plantilla" && !kp.piezas.some((q) => q.id === x.pieza));

  it.each([
    ["Brother HL-L2350DW", 36, 36],
    ["Samsung Xpress M2020", 33, 26],
  ])("láser %s con solo tóner y rodillo en el pack: igual tiene fusora, unidad láser, placa y fuente", async (modelo, W, D) => {
    const kp = pack(modelo, ["cartucho_toner", "rodillo_mp"]);
    const r = await generarPlano({ casoId: "c", knowledgePack: kp, tipoEquipo: `impresora láser ${modelo}` }, iaEstimada([["cartucho_toner", 0, 0, 0.1, 0.1]], W, D));
    const ids = genericas(r.plano, kp).map((p) => p.pieza);
    expect(ids).toEqual(expect.arrayContaining(["unidad_fusora", "unidad_laser", "placa_control", "fuente"]));
    // Dentro de la carcasa del plano (escaladas a ella; la tapa de adelante va pegada por fuera), colgadas de la raíz.
    for (const g of genericas(r.plano, kp)) {
      expect(g.padre).toBe(raiz(r.plano).pieza);
      g.pos.forEach((v, i) => expect(Math.abs(v - raiz(r.plano).pos[i]), `${g.pieza} eje ${i}`).toBeLessThanOrEqual(raiz(r.plano).dim[i] / 2 + 1));
    }
  });

  it.each([
    ["LG 43UQ7500", ["retroiluminacion", "placa_principal", "parlante"]],
    ["Samsung UN65", ["pantalla_panel", "fuente_alimentacion"]],
  ])("TV %s: suma lo que falta y nunca una segunda pieza del mismo tipo que una del pack", async (modelo, ids) => {
    const kp = pack(modelo, ids);
    const r = await generarPlano({ casoId: "c", knowledgePack: kp, tipoEquipo: "televisor" }, iaEstimada(ids.map((id) => [id, 0, 0, 0.1, 0.1]), 100, 8));
    const gen = genericas(r.plano, kp);
    expect(gen.length).toBeGreaterThan(0);
    const tiposDelPack = new Set(ids.map((id) => tipoPara(id, NOMBRES)).filter(Boolean));
    for (const g of gen) expect(tiposDelPack.has(tipoPara(g.pieza, NOMBRES)), g.pieza).toBe(false);
  });
});

describe("las reglas no miran el modelo", () => {
  it("el mismo plano con otro modelo y otra marca da lo mismo; aplicarlas dos veces no cambia nada", async () => {
    const piezas: Array<[string, Vec3, Vec3]> = [["bateria", [5, 0.4, 5.9], [0.4, 0.8, 0.9]], ["placa_madre", [6, 0.15, 4.4], [0, 0.7, -4.4]]];
    const a = await leer(planoViejo(7.2, 15, piezas), pack("Marca A modelo 1", ["bateria", "placa_madre", "pantalla"]), "celular");
    const b = await leer(planoViejo(7.2, 15, piezas), pack("Otra marca X-99", ["bateria", "placa_madre", "pantalla"]), "celular");
    expect(a.piezas).toEqual(b.piezas);
    const celular = PLANTILLAS_POR_TIPO.find((p) => p.id === "celular")!;
    const otra = seguirPlantilla(a, ["bateria", "placa_madre", "pantalla"], celular);
    expect(otra.plano.piezas).toEqual(a.piezas);
  });

  it("acotarMedidas: por tipo de pieza (sus medidas en la biblioteca), parejo y sin mover el centro", () => {
    const plano = planoViejo(30, 20, [["tornillo_tapa", [5, 0.1, 0.3], [1, 1, 1]], ["bateria", [26, 0.7, 7], [0, 1, 0]]]);
    const { plano: acotado, avisos } = acotarMedidas(plano);
    const t = pieza(acotado, "tornillo_tapa")!;
    expect(Math.max(...t.dim)).toBeCloseTo(0.6 * VECES_LA_FORMA, 1); // el tornillo de la biblioteca mide 0,6 cm
    expect(t.dim[0] / t.dim[2]).toBeCloseTo(5 / 0.3, 1);
    expect(t.pos).toEqual([1, 1, 1]);
    expect(pieza(acotado, "bateria")!.dim).toEqual([26, 0.7, 7]); // una batería de notebook es normal
    expect(avisos).toHaveLength(1);
  });
});

describe("arranca cerrado: los equipos sin carcasa propia tienen una tapa que los envuelve", () => {
  const dentro = (plano: PlanoDePiezas, tapa: string, id: string) => {
    const t = pieza(plano, tapa)!;
    return pieza(plano, id)!.pos.every((v, i) => Math.abs(v - t.pos[i]) <= t.dim[i] / 2 + 1e-6);
  };
  it.each([
    ["consola PlayStation 5", "tapa_consola", ["placa_consola", "ventilador", "fuente", "unidad_optica"]],
    ["consola Xbox Series S", "tapa_consola", ["placa_consola", "ventilador", "fuente"]],
    ["router TP-Link Archer C6", "tapa_router", ["placa_router", "puerto_rj45_1", "boton_reset"]],
    ["router Huawei HG8145", "tapa_router", ["placa_router", "conector_coaxial", "jaula_sfp"]],
  ])("%s, al generar: la tapa envuelve lo que ubicó la IA y arranca del piso", async (tipoEquipo, tapa, ids) => {
    const ia = iaEstimada(ids.map((id, i): [string, number, number, number, number] => [id, -0.6 + i * 0.4, 0.2 * (i % 2), 0.2, 0.2]), 30, 24);
    const r = await generarPlano({ casoId: "c", knowledgePack: pack(tipoEquipo, ids), tipoEquipo }, ia);
    expect(() => PlanoDePiezas.parse(r.plano)).not.toThrow();
    expect(pieza(r.plano, tapa), tapa).toBeDefined();
    for (const id of ids) expect(dentro(r.plano, tapa, id), `${id} dentro de ${tapa}`).toBe(true);
    const t = pieza(r.plano, tapa)!;
    const piso = Math.min(...r.plano.piezas.map((p) => p.pos[1] - p.dim[1] / 2));
    expect(t.pos[1] - t.dim[1] / 2).toBeCloseTo(piso, 5);
  });

  it("un celular sigue con su tapa trasera fina, arriba (no una caja que lo envuelve)", async () => {
    const ia = iaEstimada([["bateria", 0, 0.2, 0.7, 0.5], ["placa_madre", 0, -0.6, 0.8, 0.3]], 7.2, 15);
    const r = await generarPlano({ casoId: "c", knowledgePack: pack("Motorola Edge 40", ["bateria", "placa_madre"]), tipoEquipo: "celular" }, ia);
    const tapa = pieza(r.plano, "tapa_trasera")!;
    expect(tapa.dim[1]).toBeLessThan(0.5);
    expect(tapa.pos[1]).toBeGreaterThan(Math.max(...r.plano.piezas.filter((p) => p !== tapa && p.padre).map((p) => p.pos[1])));
  });
});
