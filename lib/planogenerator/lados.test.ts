import { describe, expect, it } from "vitest";
import { PlanoDePiezas, type KnowledgePack } from "../../shared";
import type { LlamarIA } from "../ia/claude";
import { generarPlano } from "./generador";

/** La IA que no responde: el generador cae a la plantilla del tipo (la red de seguridad de la app). */
const sinIA: LlamarIA = async () => "sin IA";
const pack = (clase: KnowledgePack["clase"], ids: string[]): KnowledgePack => ({
  modelo: "Modelo X1",
  clase,
  verificado: false,
  fuentes: [{ doc: "pack de prueba" }],
  piezas: ids.map((id) => ({ id, nombre: id, descripcion: "", ubicacion: "" })),
  pasos: [],
  advertencias: [],
  repuestos: [],
});
const armar = async (clase: KnowledgePack["clase"], ids: string[], tipoEquipo: string) => {
  const { plano } = await generarPlano({ casoId: "c", knowledgePack: pack(clase, ids), tipoEquipo }, sinIA);
  expect(() => PlanoDePiezas.parse(plano)).not.toThrow();
  return (id: string) => plano.piezas.find((p) => p.pieza === id)!;
};

describe("izquierda y derecha del plano sin IA (#339)", () => {
  it("TV, mirada por atrás (la vista del visor): el parlante derecho (el de quien mira la pantalla) queda a la izquierda", async () => {
    const de = await armar("otro", ["parlante_izquierdo", "parlante_derecho"], "televisor");
    expect(de("parlante_derecho").pos[0]).toBeLessThan(0);
    expect(de("parlante_izquierdo").pos[0]).toBeGreaterThan(0);
  });

  it("notebook, vista desde abajo: el parlante derecho queda en -x", async () => {
    const de = await armar("notebook", ["parlante_izquierdo", "parlante_derecho"], "notebook");
    expect(de("parlante_derecho").pos[0]).toBeLessThan(0);
    expect(de("parlante_izquierdo").pos[0]).toBeGreaterThan(0);
  });

  it("auriculares de vincha, vistos desde arriba: la copa derecha queda en -x", async () => {
    const de = await armar("otro", ["copa_izquierda", "copa_derecha"], "auriculares de vincha");
    expect(de("copa_derecha").pos[0]).toBeLessThan(0);
    expect(de("copa_izquierda").pos[0]).toBeGreaterThan(0);
  });

  it("la heladera tiene el ventilador del evaporador en el centro", async () => {
    const de = await armar("otro", ["ventilador_evaporador"], "heladera");
    expect(de("ventilador_evaporador").pos[0]).toBe(de("carcasa_heladera").pos[0]);
  });
});

describe("la tapa trasera de un equipo parado (#340)", () => {
  it.each([
    ["televisor", "carcasa_televisor"],
    ["heladera", "carcasa_heladera"],
    ["microondas", "carcasa_microondas"],
  ])("%s: la tapa que nombra el pack cubre la cara de atrás de la carcasa", async (tipo, carcasa) => {
    const de = await armar("otro", ["tapa_trasera"], tipo);
    const tapa = de("tapa_trasera");
    const raiz = de(carcasa);
    expect(tapa.padre).toBe(raiz.pieza);
    expect(tapa.dim[0]).toBeCloseTo(raiz.dim[0], 5); // del ancho y alto de la carcasa, no de un celular
    expect(tapa.dim[1]).toBeCloseTo(raiz.dim[1], 5);
    expect(tapa.dim[2]).toBeLessThan(1); // una chapa fina
    expect(tapa.pos[0]).toBeCloseTo(raiz.pos[0], 5);
    expect(tapa.pos[1]).toBeCloseTo(raiz.pos[1], 5);
    expect(tapa.pos[2] - tapa.dim[2] / 2).toBeGreaterThanOrEqual(raiz.pos[2] + raiz.dim[2] / 2 - 1e-6); // afuera, atrás (+z)
    expect(tapa.origen).toBe("plantilla");
  });

  it("sin tapa en el pack, no se agrega ninguna", async () => {
    const { plano } = await generarPlano({ casoId: "c", knowledgePack: pack("otro", ["fuente"]), tipoEquipo: "televisor" }, sinIA);
    expect(plano.piezas.some((p) => /tapa/.test(p.pieza))).toBe(false);
  });

  it("con otro nombre de tapa del manual (cubierta_trasera) pasa lo mismo", async () => {
    const de = await armar("otro", ["cubierta_trasera"], "televisor");
    expect(de("cubierta_trasera").dim[0]).toBeCloseTo(de("carcasa_televisor").dim[0], 5);
  });
});
