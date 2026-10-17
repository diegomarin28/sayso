import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { PlanoDePiezas, knowledgePackEjemplo, planoEjemplo } from "../../shared";
import { SUFIJO_MALLA, construirEscena } from "./construir";
import { SUFIJO_DETALLE } from "./detalles";
import { planoNotebookBase } from "./plantillas/notebook";

const centroMundo = (o: THREE.Object3D) => {
  o.updateWorldMatrix(true, false);
  return o.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(4));
};

describe("construirEscena", () => {
  it("crea un nodo con nombre por pieza y una malla adentro", () => {
    const { raiz, nodos, avisos } = construirEscena(planoEjemplo);
    expect(avisos).toEqual([]);
    for (const p of planoEjemplo.piezas) {
      const nodo = raiz.getObjectByName(p.pieza);
      expect(nodo).toBe(nodos.get(p.pieza));
      expect(nodo!.getObjectByName(p.pieza + SUFIJO_MALLA)).toBeInstanceOf(THREE.Mesh);
    }
  });

  it("respeta la jerarquía de padres", () => {
    const { raiz, nodos } = construirEscena(planoEjemplo);
    expect(nodos.get("base")!.parent).toBe(raiz);
    expect(nodos.get("ventilador")!.parent).toBe(nodos.get("placa_madre"));
    expect(nodos.get("tornillos_ventilador")!.parent).toBe(nodos.get("ventilador"));
  });

  it("cada malla queda centrada en `pos` del mundo, aunque esté anidada", () => {
    const { nodos } = construirEscena(planoEjemplo);
    for (const p of planoEjemplo.piezas) {
      const malla = nodos.get(p.pieza)!.getObjectByName(p.pieza + SUFIJO_MALLA)!;
      expect(centroMundo(malla)).toEqual(p.pos);
    }
  });

  it("el nodo queda en el pivote y la malla gira alrededor de él", () => {
    const plano: PlanoDePiezas = {
      modelo: "prueba",
      unidades: "cm",
      piezas: [{ pieza: "tapa", forma: "caja", dim: [10, 1, 10], pos: [0, 5, 0], pivote: [0, 0, -5] }],
    };
    const { nodos } = construirEscena(plano);
    const tapa = nodos.get("tapa")!;
    expect(centroMundo(tapa)).toEqual([0, 5, -5]);
    tapa.rotation.x = -Math.PI / 2; // abrir como bisagra
    const malla = tapa.getObjectByName("tapa" + SUFIJO_MALLA)!;
    expect(centroMundo(malla)).toEqual([0, 10, -5]);
  });

  it("las medidas de la geometría coinciden con `dim`", () => {
    const { nodos } = construirEscena(planoNotebookBase);
    for (const p of planoNotebookBase.piezas) {
      const malla = nodos.get(p.pieza)!.getObjectByName(p.pieza + SUFIJO_MALLA) as THREE.Mesh;
      malla.geometry.computeBoundingBox();
      const tam = malla.geometry.boundingBox!.getSize(new THREE.Vector3()).toArray();
      tam.forEach((v, i) => expect(v).toBeCloseTo(p.dim[i], 3));
    }
  });

  it("tolera ids repetidos, padres inexistentes y ciclos", () => {
    const pieza = { forma: "caja" as const, dim: [1, 1, 1] as [number, number, number], pos: [0, 0, 0] as [number, number, number], pivote: [0, 0, 0] as [number, number, number] };
    const plano: PlanoDePiezas = {
      modelo: "roto",
      unidades: "cm",
      piezas: [
        { ...pieza, pieza: "a" },
        { ...pieza, pieza: "a" },
        { ...pieza, pieza: "huerfana", padre: "no_existe" },
        { ...pieza, pieza: "x", padre: "y" },
        { ...pieza, pieza: "y", padre: "x" },
        { ...pieza, pieza: "z", padre: "x" },
        { ...pieza, pieza: "yo", padre: "yo" },
      ],
    };
    const { raiz, nodos, avisos } = construirEscena(plano);
    expect(nodos.size).toBe(6);
    expect(avisos).toHaveLength(5);
    for (const id of ["a", "huerfana", "x", "y", "yo"]) expect(nodos.get(id)!.parent).toBe(raiz);
    expect(nodos.get("z")!.parent).toBe(nodos.get("x"));
  });
});

describe("detalles", () => {
  it("el ventilador trae aspas como detalle, sin crear piezas nuevas", () => {
    const { raiz, nodos } = construirEscena(planoNotebookBase);
    const malla = nodos.get("ventilador")!.getObjectByName("ventilador" + SUFIJO_MALLA)!;
    const detalles = malla.children.filter((c) => c.name.includes(SUFIJO_DETALLE));
    expect(detalles.length).toBeGreaterThan(10);
    const grupos: string[] = [];
    raiz.traverse((o) => o instanceof THREE.Group && o !== raiz && grupos.push(o.name));
    expect(grupos.sort()).toEqual(planoNotebookBase.piezas.map((p) => p.pieza).sort());
  });
});

describe("plantilla de notebook", () => {
  it("valida contra el contrato y no tiene avisos", () => {
    expect(() => PlanoDePiezas.parse(planoNotebookBase)).not.toThrow();
    expect(construirEscena(planoNotebookBase).avisos).toEqual([]);
  });

  it("incluye todas las piezas del knowledge pack del fixture", () => {
    const ids = new Set(planoNotebookBase.piezas.map((p) => p.pieza));
    for (const p of knowledgePackEjemplo.piezas) expect(ids).toContain(p.id);
  });

  it("las piezas no se atraviesan entre sí (salvo padre/hijo apoyados)", () => {
    const { raiz, nodos } = construirEscena(planoNotebookBase);
    raiz.updateMatrixWorld(true);
    const cajas = [...nodos.entries()].map(([id, n]) => {
      const malla = n.getObjectByName(id + SUFIJO_MALLA) as THREE.Mesh;
      malla.geometry.computeBoundingBox();
      const caja = malla.geometry.boundingBox!.clone().applyMatrix4(malla.matrixWorld);
      caja.expandByScalar(-0.001); // tocarse está bien, atravesarse no
      return [id, caja] as const;
    });
    const choques: string[] = [];
    for (let i = 0; i < cajas.length; i++)
      for (let j = i + 1; j < cajas.length; j++)
        if (cajas[i][1].intersectsBox(cajas[j][1])) choques.push(`${cajas[i][0]} × ${cajas[j][0]}`);
    expect(choques).toEqual([]);
  });
});
