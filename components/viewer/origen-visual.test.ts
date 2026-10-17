import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { planoNotebookBase } from "../../lib/planogenerator";
import type { PlanoDePiezas } from "../../shared";
import { animar, prepararEscena } from "./escena";
import { aplicarAccion, estadoInicial } from "./reproductor";

const ORIGEN: Record<string, PlanoDePiezas["piezas"][number]["origen"]> = { ventilador: "manual", ssd: "estimada", ram: "plantilla" };
const plano: PlanoDePiezas = { ...planoNotebookBase, piezas: planoNotebookBase.piezas.map((p) => ({ ...p, origen: ORIGEN[p.pieza] })) };

describe("el visor dibuja distinto lo que no salió del manual", () => {
  const escena = prepararEscena(plano);
  const malla = (id: string) => escena.nodos.get(id)!.mallas[0];

  it("estimada y plantilla: contorno punteado; manual y sin origen: contorno sólido", () => {
    expect(malla("ssd").borde.material).toBeInstanceOf(THREE.LineDashedMaterial);
    expect(malla("ram").borde.material).toBeInstanceOf(THREE.LineDashedMaterial);
    expect(malla("ventilador").borde.material).not.toBeInstanceOf(THREE.LineDashedMaterial);
    expect(malla("bateria").borde.material).not.toBeInstanceOf(THREE.LineDashedMaterial); // sin origen
    // Sin las distancias de línea, el punteado no se ve.
    expect(malla("ssd").borde.geometry.getAttribute("lineDistance")).toBeDefined();
  });

  it("las inciertas quedan más transparentes, también resaltadas (un poco menos)", () => {
    const quieto = estadoInicial(plano.piezas.map((p) => p.pieza));
    animar(escena, quieto, 0);
    animar(escena, quieto, 5000);
    expect(malla("ssd").malla.material.opacity).toBeLessThan(malla("ventilador").malla.material.opacity);

    const resaltadas = aplicarAccion(aplicarAccion(quieto, { t: "resaltar", pieza: "ssd" }, { casoId: "t" }).estado, { t: "resaltar", pieza: "ventilador" }, { casoId: "t" }).estado;
    animar(escena, resaltadas, 6000);
    animar(escena, resaltadas, 12000);
    const ssd = malla("ssd").malla.material.opacity;
    expect(ssd).toBeLessThan(malla("ventilador").malla.material.opacity);
    expect(ssd).toBeGreaterThan(0.5); // resaltada se ve bien
  });
});
