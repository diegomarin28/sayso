import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { planoNotebookBase } from "../../lib/planogenerator";
import { COLOR_ACTIVO, animar, prepararEscena } from "./escena";
import { aplicarAccion, estadoInicial, type EstadoEscena } from "./reproductor";

const ctx = { casoId: "t" };
const preparar = () => {
  const escena = prepararEscena(planoNotebookBase);
  return { escena, estado: estadoInicial(escena.nodos.keys()) };
};
const material = (escena: ReturnType<typeof prepararEscena>, id: string) =>
  escena.nodos.get(id)!.mallas[0].malla.material;
const con = (estado: EstadoEscena, ...acciones: Parameters<typeof aplicarAccion>[1][]) =>
  acciones.reduce((e, a) => aplicarAccion(e, a, ctx).estado, estado);

describe("escena: modo rayos X", () => {
  it("la pieza activa queda sólida y naranja; las demás grises translúcidas; sus hijas quedan normales", () => {
    const { escena, estado } = preparar();
    const e = con(estado, { t: "resaltar", pieza: "ventilador" });
    animar(escena, e, 0);
    animar(escena, e, 5000);
    const activo = material(escena, "ventilador");
    expect(activo.color.getHexString()).toBe(new THREE.Color(COLOR_ACTIVO).getHexString());
    expect(activo.opacity).toBe(1);
    expect(activo.emissiveIntensity).toBeGreaterThan(0);
    expect(material(escena, "placa_madre").opacity).toBeCloseTo(0.1);
    expect(material(escena, "placa_madre").transparent).toBe(true);
    expect(material(escena, "tornillos_ventilador").opacity).toBe(1);
  });

  it("sin piezas resaltadas todo vuelve a su material original", () => {
    const { escena, estado } = preparar();
    const original = material(escena, "placa_madre").color.getHexString();
    animar(escena, con(estado, { t: "resaltar", pieza: "ssd" }), 0);
    animar(escena, con(estado, { t: "resaltar", pieza: "ssd" }), 5000);
    animar(escena, estado, 5000);
    animar(escena, estado, 10000);
    expect(material(escena, "placa_madre").color.getHexString()).toBe(original);
    expect(material(escena, "placa_madre").opacity).toBe(1);
  });

  it("ocultar funde la pieza hasta hacerla invisible", () => {
    const { escena, estado } = preparar();
    const e = con(estado, { t: "ocultar", pieza: "bateria" });
    animar(escena, e, 0);
    animar(escena, e, 5000);
    expect(escena.nodos.get("bateria")!.mallas[0].malla.visible).toBe(false);
  });
});

describe("escena: transiciones", () => {
  it("el despiece es escalonado: la placa arranca antes que las piezas que van encima", () => {
    const { escena, estado } = preparar();
    animar(escena, estado, 0);
    const e = con(estado, { t: "despiezar", cantidad: 1 });
    const y = (id: string) => escena.nodos.get(id)!.nodo.position.y - escena.nodos.get(id)!.reposo.y;
    animar(escena, e, 1000);
    animar(escena, e, 1300);
    expect(y("placa_madre")).toBeGreaterThan(0);
    expect(y("tornillos_ventilador")).toBe(0);
    animar(escena, e, 10000);
    expect(y("tornillos_ventilador")).toBeGreaterThan(0);
  });

  it("los movimientos tienen easing: a mitad de tiempo no están ni al principio ni al final", () => {
    const { escena, estado } = preparar();
    animar(escena, estado, 0);
    const e = con(estado, { t: "desplazar", pieza: "ventilador", vec: [0, 4, 0] });
    const n = escena.nodos.get("ventilador")!;
    animar(escena, e, 1000);
    animar(escena, e, 1375);
    const mitad = n.nodo.position.y - n.reposo.y;
    expect(mitad).toBeGreaterThan(0.5);
    expect(mitad).toBeLessThan(3.5);
    animar(escena, e, 3000);
    expect(n.nodo.position.y - n.reposo.y).toBeCloseTo(4);
  });
});
