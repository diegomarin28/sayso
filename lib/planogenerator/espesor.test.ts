import { describe, expect, it } from "vitest";
import type { KnowledgePack } from "../../shared";
import type { LlamarIA } from "../ia/claude";
import { generarPlano } from "./generador";
import { planoCelular, planoImpresora } from "./plantillas/equipos";

/** La IA que no responde: el generador cae a la plantilla del tipo (la red de seguridad de la app). */
const sinIA: LlamarIA = async () => "sin IA";
const pack = (ids: string[]): KnowledgePack => ({
  modelo: "Modelo X1",
  clase: "otro",
  verificado: false,
  fuentes: [{ doc: "pack de prueba" }],
  piezas: ids.map((id) => ({ id, nombre: id, descripcion: "", ubicacion: "" })),
  pasos: [],
  advertencias: [],
  repuestos: [],
});
const armar = async (ids: string[], tipoEquipo: string) => (await generarPlano({ casoId: "c", knowledgePack: pack(ids), tipoEquipo }, sinIA)).plano;
const alto = (piezas: { pos: number[]; dim: number[] }[]) => Math.max(...piezas.map((p) => p.pos[1] + p.dim[1] / 2)) - Math.min(...piezas.map((p) => p.pos[1] - p.dim[1] / 2));

describe("celular: las capas caben en el espesor de un teléfono (#338)", () => {
  it("la plantilla mide lo que el marco, no el doble", () => {
    expect(alto(planoCelular.piezas)).toBeLessThanOrEqual(0.8 + 1e-9);
  });

  it("armado sin IA con todas sus piezas: sigue dentro del espesor y la tapa queda arriba", async () => {
    const ids = ["pantalla", "bateria", "placa_madre", "camara_trasera", "camara_frontal", "conector_carga", "parlante_inferior", "tapa_trasera"];
    const plano = await armar(ids, "celular");
    expect(alto(plano.piezas)).toBeLessThanOrEqual(0.85);
    const y = (id: string) => plano.piezas.find((p) => p.pieza === id)!.pos[1];
    expect(y("tapa_trasera")).toBeGreaterThan(y("bateria"));
    expect(y("pantalla")).toBeLessThan(y("bateria"));
  });
});

describe("impresora de tanque de tinta (#338)", () => {
  it("el tanque que nombra el pack va afuera del cuerpo, contra el frente, no adentro", async () => {
    const plano = await armar(["cabezal_impresion", "tanque_tinta"], "impresora");
    const de = (id: string) => plano.piezas.find((p) => p.pieza === id)!;
    const tapa = de("tapa_impresora");
    const tanque = de("tanque_tinta");
    expect(tanque.pos[2] - tanque.dim[2] / 2).toBeGreaterThanOrEqual(tapa.pos[2] + tapa.dim[2] / 2 - 1e-6); // pasado el frente (+z)
  });

  it("sin tanque en el pack no se agrega (una de cartuchos no lo trae)", async () => {
    const plano = await armar(["cabezal_impresion"], "impresora");
    expect(plano.piezas.some((p) => p.pieza === "tanque_tinta")).toBe(false);
    expect(planoImpresora.piezas.some((p) => p.pieza === "tanque_tinta")).toBe(true); // está en el esqueleto, como opcional
  });
});
