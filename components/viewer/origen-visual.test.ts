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

  it("las inciertas son opacas como las demás (#196): las capas encimadas se leen; la señal es el punteado", () => {
    const quieto = estadoInicial(plano.piezas.map((p) => p.pieza));
    animar(escena, quieto, 0);
    animar(escena, quieto, 5000);
    for (const id of ["ssd", "ram", "ventilador"]) {
      expect(malla(id).malla.material.opacity, id).toBe(1);
      expect(malla(id).malla.material.depthWrite, id).toBe(true); // tapa lo de atrás
    }
    // El punteado se marca más que el borde sólido.
    expect(malla("ssd").borde.material.opacity).toBeGreaterThan(malla("ventilador").borde.material.opacity);

    const resaltadas = aplicarAccion(quieto, { t: "resaltar", pieza: "ssd" }, { casoId: "t" }).estado;
    animar(escena, resaltadas, 6000);
    animar(escena, resaltadas, 12000);
    expect(malla("ssd").malla.material.opacity).toBe(1);
  });
});
