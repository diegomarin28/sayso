import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { Coreografia, PlanoDePiezas } from "../../shared";
import { planoNotebookBase } from "../../lib/planogenerator";
import { planoCelular, planoHeladera, planoReloj, planoTablet } from "../../lib/planogenerator/plantillas/equipos";
import { conDesarme } from "./desarme";
import { animar, prepararEscena, type EscenaPreparada } from "./escena";
import { aplicarCoreografia, cerrar, estadoInicial, type EstadoEscena } from "./reproductor";

const ctx = { casoId: "t" };
const paso = (dice: string, ...acciones: Coreografia["acciones"]): Coreografia => ({ paso: 1, dice, riesgo: "bajo", acciones });
const inicial = (escena: EscenaPreparada) => estadoInicial(escena.nodos.keys(), escena.cubiertas, escena.lados);
/** Lo que hace el visor con un paso: suma el desarme y aplica las acciones. */
const reproducir = (escena: EscenaPreparada, estado: EstadoEscena, c: Coreografia) =>
  aplicarCoreografia(estado, conDesarme(c, escena.lados, escena.nodos.keys(), 2 * escena.radio), ctx).estado;
/** Alto (en el mundo) del centro de una pieza. */
const alto = (escena: EscenaPreparada, id: string) => {
  escena.raiz.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(escena.nodos.get(id)!.principal).getCenter(new THREE.Vector3()).y;
};
const hasta = (escena: EscenaPreparada, estado: EstadoEscena) => {
  animar(escena, estado, 10_000);
  animar(escena, estado, 20_000);
};

/** Un celular con tornillos en la tapa trasera (arriba) y uno del lado de la pantalla (abajo). */
const conTornillos: PlanoDePiezas = (() => {
  const base = planoCelular.piezas.find((p) => p.pieza === "camara_frontal")!;
  return {
    ...planoCelular,
    piezas: [
      ...planoCelular.piezas,
      { ...base, pieza: "tornillo_1", dim: [0.3, 0.2, 0.3], pos: [3.2, 1.85, 7.6] },
      { ...base, pieza: "tornillo_2", dim: [0.3, 0.2, 0.3], pos: [-3.2, 1.85, 7.6] },
      { ...base, pieza: "tornillo_3", dim: [0.3, 0.2, 0.3], pos: [3.2, -0.3, 7.6] },
    ],
  };
})();

describe("en la mano (#233): un equipo acostado arranca con la pantalla arriba", () => {
  // Dos variantes del tipo "plano con pantalla abajo": celular y tablet.
  for (const [nombre, plano] of [["celular", planoCelular], ["tablet", planoTablet]] as const) {
    it(`${nombre}: la pantalla y la tapa trasera son caras de lados opuestos, y arranca dado vuelta (la pantalla arriba)`, () => {
      const escena = prepararEscena(plano);
      expect(escena.lados?.caras).toMatchObject({ pantalla: -1, tapa_trasera: 1 });
      expect(escena.lados?.frente).toBe(-1);
      expect(inicial(escena).volteado).toBe(true);
      expect(alto(escena, "pantalla")).toBeGreaterThan(alto(escena, "tapa_trasera"));
      // Apoyado en el piso, no flotando ni hundido.
      expect(new THREE.Box3().setFromObject(escena.raiz).min.y).toBeCloseTo(escena.piso, 2);
    });
  }

  it("reloj: la pantalla ya está arriba (no se da vuelta) y la tapa de abajo es una cara", () => {
    const escena = prepararEscena(planoReloj);
    expect(escena.lados?.frente).toBe(1);
    expect(escena.lados?.caras.tapa_reloj).toBe(-1);
    expect(inicial(escena).volteado).toBe(false);
  });

  it("la notebook (sin pantalla en el plano) no se da vuelta; un equipo parado (heladera) no tiene caras", () => {
    expect(inicial(prepararEscena(planoNotebookBase)).volteado ?? false).toBe(false);
    expect(prepararEscena(planoHeladera).lados).toBeUndefined();
  });

  it("a mitad del giro no atraviesa el piso", () => {
    const escena = prepararEscena(planoCelular);
    const abierto = reproducir(escena, inicial(escena), paso("Sacá la tapa trasera.", { t: "resaltar", pieza: "tapa_trasera" }));
    animar(escena, abierto, 0);
    for (const t of [150, 300, 450, 600, 750]) {
      animar(escena, abierto, t);
      escena.raiz.updateMatrixWorld(true);
      expect(new THREE.Box3().setFromObject(escena.raiz).min.y).toBeGreaterThan(escena.piso - 0.05);
    }
  });
});

describe("desarme en vivo (#233): el paso que saca una cara la levanta y la esconde", () => {
  it("celular: «sacá la tapa trasera» da vuelta el equipo (la tapa arriba), la levanta, la esconde y abre", () => {
    const escena = prepararEscena(planoCelular);
    const e = reproducir(escena, inicial(escena), paso("Sacá la tapa trasera con la púa.", { t: "resaltar", pieza: "tapa_trasera" }));
    expect(e.volteado).toBe(false);
    expect(e.abierto).toBe(true);
    expect(e.piezas.tapa_trasera.visible).toBe(false);
    expect(e.piezas.tapa_trasera.desp[1]).toBeGreaterThan(0);
    hasta(escena, e);
    expect(alto(escena, "tapa_trasera")).toBeGreaterThan(alto(escena, "pantalla"));
  });

  it("tablet: «despegá la pantalla» (nombrada solo en el texto) la levanta hacia arriba sin dar vuelta el equipo", () => {
    const escena = prepararEscena(planoTablet);
    const e = reproducir(escena, inicial(escena), paso("Despegá la pantalla con la púa, de a poco.", { t: "camara", objetivo: "general" }));
    expect(e.volteado).toBe(true);
    expect(e.abierto).toBe(true);
    expect(e.piezas.pantalla.visible).toBe(false);
    // Hacia afuera de su lado (abajo en el plano): dado vuelta, hacia arriba.
    expect(e.piezas.pantalla.desp[1]).toBeLessThan(0);
    const antes = alto(escena, "pantalla");
    hasta(escena, e);
    expect(alto(escena, "pantalla")).toBeGreaterThan(antes);
  });

  // Dos variantes: en las dos, lo de adentro está del lado de la tapa trasera.
  for (const [nombre, plano] of [["celular", planoCelular], ["tablet", planoTablet]] as const) {
    it(`${nombre}: abierto por la pantalla, la carcasa (con su placa al medio) se ve translúcida; por la tapa, no`, () => {
      const opacidadMarco = (dice: string) => {
        const escena = prepararEscena(plano);
        hasta(escena, reproducir(escena, inicial(escena), paso(dice, { t: "camara", objetivo: "general" })));
        return (escena.nodos.get("marco")!.principal.material as THREE.MeshStandardMaterial).opacity;
      };
      expect(prepararEscena(plano).lados?.adentro).toBe(1);
      expect(opacidadMarco("Despegá la pantalla.")).toBeLessThan(0.6);
      expect(opacidadMarco("Sacá la tapa trasera.")).toBeGreaterThan(0.9);
    });
  }

  it("con tornillos: sacar la tapa esconde los tornillos de su lado; «sacá los tornillos» solo los tornillos", () => {
    const escena = prepararEscena(conTornillos);
    const tapa = reproducir(escena, inicial(escena), paso("Retirá la tapa trasera.", { t: "resaltar", pieza: "tapa_trasera" }));
    expect([tapa.piezas.tornillo_1.visible, tapa.piezas.tornillo_2.visible, tapa.piezas.tornillo_3.visible]).toEqual([false, false, true]);

    const tornillos = reproducir(escena, inicial(escena), paso("Sacá los tornillos de la tapa trasera.", { t: "resaltar", pieza: "tapa_trasera" }));
    expect([tornillos.piezas.tornillo_1.visible, tornillos.piezas.tornillo_3.visible]).toEqual([false, true]);
    expect(tornillos.piezas.tapa_trasera.visible).toBe(true);
    expect(tornillos.abierto).toBe(false);
  });

  it("al cerrar vuelven la tapa y los tornillos, y el equipo queda otra vez con la pantalla arriba", () => {
    const escena = prepararEscena(conTornillos);
    const abierto = reproducir(escena, inicial(escena), paso("Sacá la tapa trasera.", { t: "resaltar", pieza: "tapa_trasera" }));
    const cerrado = cerrar(abierto);
    expect(cerrado.volteado).toBe(true);
    expect(cerrado.piezas.tapa_trasera).toMatchObject({ visible: true, desp: [0, 0, 0] });
    expect(cerrado.piezas.tornillo_1.visible).toBe(true);
  });

  it("no suma nada si el paso no saca nada, si saca otra cosa o si la guía ya mueve la cara", () => {
    const escena = prepararEscena(planoCelular);
    const ids = [...escena.nodos.keys()];
    const igual = (c: Coreografia) => expect(conDesarme(c, escena.lados, ids, 2 * escena.radio)).toBe(c);
    igual(paso("Ubicá la batería: está debajo de la tapa trasera.", { t: "resaltar", pieza: "bateria" }));
    igual(paso("Abrí Ajustes en la pantalla y fijate la batería.", { t: "resaltar", pieza: "pantalla" }));
    igual(paso("Sacá la batería con cuidado.", { t: "resaltar", pieza: "bateria" }));
    igual(paso("Sacá la tapa trasera.", { t: "ocultar", pieza: "tapa_trasera" }));
    // Un equipo sin caras (heladera): nada.
    const heladera = prepararEscena(planoHeladera);
    const c = paso("Sacá el panel trasero.", { t: "resaltar", pieza: "panel_trasero" });
    expect(conDesarme(c, heladera.lados, heladera.nodos.keys(), 2 * heladera.radio)).toBe(c);
  });
});
