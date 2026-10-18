import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { PlanoDePiezas, type ClaseEquipo, type KnowledgePack } from "../../shared";
import { prepararEscena } from "../../components/viewer/escena";
import type { LlamarIA } from "../ia/claude";
import { generarPlano, type PropuestaPlano } from "./generador";
import { pararPlano } from "./orientacion";

const pack = (clase: ClaseEquipo, ids: string[]): KnowledgePack => ({
  modelo: "Modelo X1",
  clase,
  verificado: false,
  fuentes: [{ doc: "manual" }],
  piezas: ids.map((id) => ({ id, nombre: id, descripcion: "", ubicacion: "" })),
  pasos: [],
  advertencias: [],
  repuestos: [],
});
const p = (pieza: string, x: number, z: number, ancho: number, prof: number) => ({
  pieza, x, z, ancho, prof, alto_cm: 1.5, capa: "sobre_base" as const, sobre: null, forma: "caja" as const, etiquetaManual: null, pagina: 12, confianza: "alta" as const,
});
const ia = (propuesta: PropuestaPlano): LlamarIA => async () => JSON.stringify(propuesta);
const IDS_TV = ["placa_principal", "fuente", "tira_led_1", "parlante_izquierdo"];
/** Lo que dio la IA en la prueba real de un TV: la "profundidad" (8 cm) en vez del alto. */
const propuestaTV = (alto: number | null): PropuestaPlano => ({
  base_ancho_cm: 100,
  base_prof_cm: alto,
  medidas_fuente: "estimada",
  piezas: [p("placa_principal", 0.35, -0.1, 0.18, 0.3), p("fuente", -0.35, -0.1, 0.2, 0.35), p("tira_led_1", 0, -0.6, 0.9, 0.06), p("parlante_izquierdo", -0.8, 0.8, 0.12, 0.1)],
});
const raiz = (plano: PlanoDePiezas) => plano.piezas.find((x) => !x.padre)!;
const direccion = (plano: PlanoDePiezas) => prepararEscena(plano).direccion;

describe("equipos parados (TV, heladera, aire, lavarropas, microondas)", () => {
  it("TV con la profundidad en vez del alto (prueba real): queda parado, de frente, con el alto típico", async () => {
    const r = await generarPlano({ casoId: "c", knowledgePack: pack("otro", IDS_TV), tipoEquipo: "televisor" }, ia(propuestaTV(8)));
    expect(() => PlanoDePiezas.parse(r.plano)).not.toThrow();
    const carcasa = raiz(r.plano);
    expect(carcasa.pieza).toBe("carcasa_televisor"); // la carcasa del tipo, no el chasis de notebook
    const [ancho, alto, prof] = carcasa.dim;
    expect(ancho).toBe(100);
    expect(alto).toBeCloseTo(66, 0); // proporción de la plantilla de TV (100 × 66)
    expect(prof).toBe(10); // la profundidad real del TV (plantilla), no una tira acostada
    // La carcasa envuelve las piezas.
    for (const x of r.plano.piezas.filter((y) => y.padre)) {
      expect(x.pos[2] - x.dim[2] / 2, x.pieza).toBeGreaterThanOrEqual(carcasa.pos[2] - prof / 2 - 1e-6);
      expect(x.pos[2] + x.dim[2] / 2, x.pieza).toBeLessThanOrEqual(carcasa.pos[2] + prof / 2 + 1e-6);
    }
    expect(r.avisos.join(" ")).toMatch(/8 cm no puede ser el alto.*parece la profundidad/);
    // Apoyado en el piso, y las piezas de la placa hacia la cámara (+z), delante de la chapa.
    for (const x of r.plano.piezas) expect(x.pos[1] - x.dim[1] / 2, x.pieza).toBeGreaterThanOrEqual(-1e-6);
    for (const x of r.plano.piezas.filter((y) => y.padre)) expect(x.pos[2], x.pieza).toBeGreaterThan(carcasa.pos[2] - prof / 2);
    // Lo de arriba de la imagen (z = -0.6, la tira de LED) queda arriba.
    const tira = r.plano.piezas.find((x) => x.pieza === "tira_led_1")!;
    const parlante = r.plano.piezas.find((x) => x.pieza === "parlante_izquierdo")!;
    expect(tira.pos[1]).toBeGreaterThan(parlante.pos[1]);
    // La cámara mira la cara grande: casi de frente.
    const d = direccion(r.plano);
    expect(d.z).toBeGreaterThan(2 * d.y);
  });

  it("con el alto bien dado, lo respeta", async () => {
    const r = await generarPlano({ casoId: "c", knowledgePack: pack("otro", IDS_TV), tipoEquipo: "Smart TV" }, ia(propuestaTV(58)));
    expect(raiz(r.plano).dim[1]).toBe(58);
    expect(r.avisos.join(" ")).not.toMatch(/no puede ser el alto/);
  });

  it("heladera: también parada, alta", async () => {
    const r = await generarPlano(
      { casoId: "c", knowledgePack: pack("otro", ["compresor", "termostato"]), tipoEquipo: "heladera" },
      ia({ base_ancho_cm: 60, base_prof_cm: 65, medidas_fuente: "estimada", piezas: [p("compresor", 0, 0.8, 0.3, 0.1), p("termostato", 0.3, -0.3, 0.05, 0.02)] }),
    );
    const [ancho, alto] = raiz(r.plano).dim;
    expect(alto).toBeGreaterThan(2 * ancho);
  });

  it("notebook y celular siguen acostados, mirados desde arriba", async () => {
    for (const [tipo, clase] of [["notebook", "notebook"], ["celular", "otro"]] as const) {
      const r = await generarPlano(
        { casoId: "c", knowledgePack: pack(clase, ["bateria", "ventilador"]), tipoEquipo: tipo },
        ia({ base_ancho_cm: 34, base_prof_cm: 24, medidas_fuente: "estimada", piezas: [p("bateria", 0, 0.5, 0.7, 0.3), p("ventilador", 0.6, -0.5, 0.15, 0.2)] }),
      );
      const [ancho, alto, prof] = raiz(r.plano).dim;
      expect(alto, tipo).toBeLessThan(Math.min(ancho, prof));
      const d = direccion(r.plano);
      expect(d.y, tipo).toBeGreaterThan(d.z * 0.9);
    }
  });
});

describe("pararPlano", () => {
  it("gira 90° sobre x: la planta queda de frente, las capas hacia la cámara y todo apoyado en el piso", () => {
    const plano: PlanoDePiezas = {
      modelo: "x",
      unidades: "cm",
      piezas: [
        { pieza: "base", forma: "caja", dim: [40, 2, 30], pos: [0, 0, 0], pivote: [0, 0, 0] },
        { pieza: "tapa", forma: "caja", dim: [40, 0.5, 30], pos: [0, 3, 0], pivote: [0, 0, -15], padre: "base" },
        { pieza: "arriba", forma: "caja", dim: [4, 1, 4], pos: [5, 1.5, -10], pivote: [0, 0, 0], padre: "base" },
      ],
    };
    const parado = pararPlano(plano);
    const de = (id: string) => parado.piezas.find((x) => x.pieza === id)!;
    expect(de("base").dim).toEqual([40, 30, 2]);
    expect(Math.min(...parado.piezas.map((x) => x.pos[1] - x.dim[1] / 2))).toBeCloseTo(0, 6);
    expect(de("arriba").pos[1]).toBeGreaterThan(de("base").pos[1]); // z = -10 (arriba en la imagen) → arriba
    expect(de("tapa").pos[2]).toBeGreaterThan(de("base").pos[2]); // la capa de encima → hacia la cámara
    expect(de("tapa").pivote).toEqual([0, 15, 0]); // la bisagra de atrás queda arriba
    // Es una rotación: las distancias entre piezas no cambian.
    const dist = (pl: PlanoDePiezas, a: string, b: string) =>
      new THREE.Vector3(...pl.piezas.find((x) => x.pieza === a)!.pos).distanceTo(new THREE.Vector3(...pl.piezas.find((x) => x.pieza === b)!.pos));
    expect(dist(parado, "base", "arriba")).toBeCloseTo(dist(plano, "base", "arriba"), 6);
  });
});

describe("los dos caminos arrancan igual: generado o solo con el esqueleto (la IA falló)", () => {
  const iaQueFalla: LlamarIA = async () => "no es json";
  /** Qué ve la cámara (+z): la espalda abierta, lo de adentro primero y la cara (pantalla, puertas) detrás. */
  const deEspaldas = (plano: PlanoDePiezas, cara: string[], adentro: string) => {
    const z = (id: string) => plano.piezas.find((x) => x.pieza === id)!.pos[2];
    for (const id of cara) expect(z(id), `${id} detrás de ${adentro}`).toBeLessThan(z(adentro));
    expect(direccion(plano).z).toBeGreaterThan(2 * direccion(plano).y); // mirado de frente a esa espalda
  };

  // Dos variantes por tipo, por tipo de equipo y no por modelo.
  it.each([
    ["televisor LG 43\"", ["placa_control", "fuente", "parlante_izquierdo"], ["pantalla_panel"], "placa_control"],
    ["Smart TV Samsung 65\"", ["placa_control", "retroiluminacion", "fuente"], ["pantalla_panel"], "placa_control"],
    ["heladera Whirlpool", ["compresor", "termostato", "puerta_heladera", "puerta_freezer"], ["puerta_heladera", "puerta_freezer"], "compresor"],
    ["heladera no frost Gafa", ["compresor", "evaporador", "puerta_heladera"], ["puerta_heladera"], "compresor"],
  ])("%s", async (tipoEquipo, ids, cara, adentro) => {
    const kp = pack("otro", ids);
    const soloEsqueleto = await generarPlano({ casoId: "c", knowledgePack: kp, tipoEquipo }, iaQueFalla);
    expect(soloEsqueleto.origen).toBe("plantilla");
    deEspaldas(soloEsqueleto.plano, cara, adentro);
    // Generado: la IA ubicó lo de adentro (visto en el manual); la cara la pone el esqueleto.
    const vistas = ids.filter((id) => !cara.includes(id));
    const generado = await generarPlano(
      { casoId: "c", knowledgePack: kp, tipoEquipo },
      ia({ base_ancho_cm: null, base_prof_cm: null, medidas_fuente: "estimada", piezas: vistas.map((id, i) => p(id, -0.5 + i * 0.4, 0, 0.15, 0.15)) }),
    );
    expect(generado.origen).toBe("ia");
    deEspaldas(generado.plano, cara, adentro);
  });
});
