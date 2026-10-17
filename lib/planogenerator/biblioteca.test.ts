import { readFileSync, statSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { beforeAll, describe, expect, it } from "vitest";
import type { PlanoDePiezas } from "../../shared";
import { RECETA_CUERPO, bibliotecaDesdeEscena, modeloPara, partesAjustadas, type BibliotecaPiezas } from "./biblioteca";
import { SUFIJO_MALLA, construirEscena } from "./construir";
import { RECETAS_DETALLE } from "./materiales";
import { planoNotebookBase } from "./plantillas/notebook";

const GLB = "public/models/piezas.glb";
let biblioteca: BibliotecaPiezas;

beforeAll(async () => {
  const datos = readFileSync(GLB);
  const buffer = datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength);
  const gltf = await new GLTFLoader().parseAsync(buffer, "");
  biblioteca = bibliotecaDesdeEscena(gltf.scene);
});

/** Caja de todas las mallas de la pieza (principal + detalles), en el espacio de la malla principal. */
const cajaDe = (malla: THREE.Object3D) => {
  const caja = new THREE.Box3();
  malla.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.computeBoundingBox();
    caja.union(o.geometry.boundingBox!);
  });
  return caja;
};

describe("piezas.glb", () => {
  it("pesa menos de 2 MB", () => {
    expect(statSync(GLB).size).toBeLessThan(2 * 1024 * 1024);
  });

  it("cada tipo tiene cuerpo y solo usa recetas conocidas", () => {
    expect(biblioteca.size).toBeGreaterThanOrEqual(10);
    for (const [tipo, modelo] of biblioteca) {
      const recetas = modelo.partes.map((p) => p.receta);
      expect(recetas, tipo).toContain(RECETA_CUERPO);
      for (const r of recetas) expect([RECETA_CUERPO, ...Object.keys(RECETAS_DETALLE)], `${tipo}: ${r}`).toContain(r);
    }
  });

  it("cubre todas las piezas de la plantilla de notebook", () => {
    for (const p of planoNotebookBase.piezas) expect(modeloPara(p.pieza, biblioteca), p.pieza).toBeDefined();
  });
});

describe("modeloPara", () => {
  it("elige el prefijo más largo y no inventa", () => {
    const b: BibliotecaPiezas = new Map([
      ["tapa", { partes: [], caja: new THREE.Box3() }],
      ["tapa_inferior", { partes: [], caja: new THREE.Box3() }],
    ]);
    expect(modeloPara("tapa_inferior_2", b)).toBe(b.get("tapa_inferior"));
    expect(modeloPara("tapa_bisagra", b)).toBe(b.get("tapa"));
    expect(modeloPara("condensador_de_flujo", b)).toBeUndefined();
    expect(modeloPara("tapa", undefined)).toBeUndefined();
  });
});

describe("partesAjustadas", () => {
  const caja = (x: number, y: number, z: number) => ({
    partes: [{ receta: RECETA_CUERPO, geometria: new THREE.BoxGeometry(x, y, z).translate(5, 5, 5) }],
    caja: new THREE.Box3(new THREE.Vector3(5 - x / 2, 5 - y / 2, 5 - z / 2), new THREE.Vector3(5 + x / 2, 5 + y / 2, 5 + z / 2)),
  });
  const medida = (g: THREE.BufferGeometry) => {
    g.computeBoundingBox();
    return { tam: g.boundingBox!.getSize(new THREE.Vector3()), centro: g.boundingBox!.getCenter(new THREE.Vector3()) };
  };

  it("centra y estira al `dim` del plano", () => {
    const [p] = partesAjustadas(caja(2, 1, 1), [8, 0.5, 3]);
    const { tam, centro } = medida(p.geometria);
    expect(tam.toArray().map((v) => +v.toFixed(5))).toEqual([8, 0.5, 3]);
    expect(centro.length()).toBeCloseTo(0, 5);
  });

  it("gira 90° si el plano la pone al revés, para no deformarla", () => {
    const modelo = caja(4, 1, 1);
    // El lado largo del modelo (x) tiene que terminar en el lado largo del plano (z).
    const [p] = partesAjustadas(modelo, [2, 1, 8]);
    const { tam } = medida(p.geometria);
    expect(tam.toArray().map((v) => +v.toFixed(5))).toEqual([2, 1, 8]);
    const pos = p.geometria.getAttribute("position");
    const zs = Array.from({ length: pos.count }, (_, i) => pos.getZ(i));
    expect(Math.max(...zs)).toBeCloseTo(4, 5);
  });
});

describe("construirEscena con biblioteca", () => {
  it("cada pieza mide `dim` y queda centrada en `pos`, con nombres y materiales propios", () => {
    const { nodos } = construirEscena(planoNotebookBase, { biblioteca });
    const materiales = new Set<THREE.Material>();
    for (const p of planoNotebookBase.piezas) {
      const malla = nodos.get(p.pieza)!.getObjectByName(p.pieza + SUFIJO_MALLA) as THREE.Mesh;
      const caja = cajaDe(malla);
      caja.getSize(new THREE.Vector3()).toArray().forEach((v, i) => expect(v, p.pieza).toBeCloseTo(p.dim[i], 3));
      expect(caja.getCenter(new THREE.Vector3()).length(), p.pieza).toBeCloseTo(0, 3);
      expect(malla.geometry.type, p.pieza).toBe("BufferGeometry"); // del GLB, no una primitiva
      malla.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        expect(o.name.startsWith(p.pieza + SUFIJO_MALLA)).toBe(true);
        expect(materiales.has(o.material as THREE.Material)).toBe(false);
        materiales.add(o.material as THREE.Material);
      });
    }
  });

  it("una pieza sin tipo en la biblioteca usa la primitiva de siempre", () => {
    const plano: PlanoDePiezas = {
      modelo: "prueba",
      unidades: "cm",
      piezas: [{ pieza: "condensador", forma: "cilindro", dim: [1, 2, 1], pos: [0, 0, 0], pivote: [0, 0, 0] }],
    };
    const malla = construirEscena(plano, { biblioteca }).nodos.get("condensador")!.children[0] as THREE.Mesh;
    expect(malla.geometry).toBeInstanceOf(THREE.CylinderGeometry);
  });
});
