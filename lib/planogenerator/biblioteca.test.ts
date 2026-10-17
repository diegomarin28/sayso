import { readFileSync, statSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { beforeAll, describe, expect, it } from "vitest";
import type { PlanoDePiezas } from "../../shared";
import {
  RECETA_CUERPO,
  SEPARADOR_VARIANTE,
  bibliotecaDesdeEscena,
  modeloPara,
  palabras,
  partesAjustadas,
  type BibliotecaPiezas,
  type ModeloPieza,
} from "./biblioteca";
import { SUFIJO_MALLA, construirEscena } from "./construir";
import { RECETAS_DETALLE, recetaPara } from "./materiales";
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

  it("cada tipo tiene su propia receta en materiales.ts (no la genérica)", () => {
    for (const tipo of biblioteca.keys()) expect(recetaPara(tipo), tipo).not.toBe(recetaPara("pieza_sin_tipo"));
  });

  it("cubre todas las piezas de la plantilla de notebook, con las variantes de notebook", () => {
    for (const p of planoNotebookBase.piezas) {
      expect(modeloPara(p.pieza, biblioteca), p.pieza).toBeDefined();
      expect(nombreDe(modeloPara(p.pieza, biblioteca, p.dim)), p.pieza).not.toContain(SEPARADOR_VARIANTE);
    }
  });

  it("cubre las piezas de un celular y elige la variante de celular por las medidas", () => {
    for (const p of planoCelular.piezas) expect(modeloPara(p.pieza, biblioteca, p.dim), p.pieza).toBeDefined();
    const elegida = (id: string) => nombreDe(modeloPara(id, biblioteca, planoCelular.piezas.find((p) => p.pieza === id)!.dim));
    expect(elegida("bateria")).toBe("bateria@celular");
    expect(elegida("placa_madre")).toBe("placa_madre@celular");
    expect(elegida("parlante_inferior")).toBe("parlante@celular");
    expect(elegida("conector_carga")).toBe("conector@usb_c");
    expect(elegida("camara_trasera")).toBe("camara@modulo");
    expect(elegida("camara_frontal")).toBe("camara");
    expect(elegida("tapa_trasera")).toBe("tapa_trasera");
  });

  it("las variantes traen del GLB para qué equipo son", () => {
    expect(biblioteca.get("bateria@celular")!.equipos).toContain("celular");
    expect(biblioteca.get("bateria")!.equipos).toContain("notebook");
    expect(biblioteca.get("conector@usb_c")!.equipos).toEqual([]); // la usan los dos
  });

  it("con el tipo de equipo de la recepción usa la versión de celular aunque las medidas digan otra cosa", () => {
    const bateria = planoNotebookBase.piezas.find((p) => p.pieza === "bateria")!;
    expect(nombreDe(modeloPara("bateria", biblioteca, bateria.dim, "Teléfono celular Motorola"))).toBe("bateria@celular");
    expect(nombreDe(modeloPara("bateria", biblioteca, bateria.dim, "lavarropas"))).toBe("bateria");
  });
});

/** Medidas típicas de un celular (cm). Solo para tests: el plano real lo arma la IA desde el manual. */
const planoCelular: PlanoDePiezas = {
  modelo: "celular de prueba",
  unidades: "cm",
  piezas: (
    [
      ["marco", [7.4, 0.8, 15.8]],
      ["pantalla", [7.1, 0.35, 15.5]],
      ["bateria", [5.6, 0.45, 8.6]],
      ["placa_madre", [6, 0.25, 11]],
      ["placa_carga", [6, 0.2, 2]],
      ["camara_trasera", [2.6, 0.7, 2.6]],
      ["camara_frontal", [0.8, 0.5, 0.8]],
      ["conector_carga", [0.9, 0.32, 0.75]],
      ["parlante_inferior", [1.8, 0.35, 1]],
      ["tapa_trasera", [7.3, 0.18, 15.7]],
    ] as const
  ).map(([pieza, dim]) => ({ pieza, forma: "caja", dim: [...dim], pos: [0, 0, 0], pivote: [0, 0, 0] })),
};

const nombreDe = (modelo?: ModeloPieza) => [...biblioteca].find(([, m]) => m === modelo)?.[0];

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

  it("entre variantes elige la que menos se deforma; sin medidas, la base", () => {
    const de = (x: number, y: number, z: number) => ({ partes: [], caja: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(x, y, z)) });
    const b: BibliotecaPiezas = new Map([
      ["bateria", de(26, 0.8, 7)],
      ["bateria@celular", de(6, 0.5, 9)],
    ]);
    expect(modeloPara("bateria", b, [25, 1, 8])).toBe(b.get("bateria"));
    expect(modeloPara("bateria_principal", b, [5, 0.4, 8])).toBe(b.get("bateria@celular"));
    expect(modeloPara("bateria", b, [9, 0.5, 6])).toBe(b.get("bateria@celular")); // girada
    expect(modeloPara("bateria", b)).toBe(b.get("bateria"));
  });

  it("el tipo de equipo descarta las variantes de otro equipo; las que no dicen equipo sirven para todos", () => {
    const de = (x: number, y: number, z: number, equipos: string[] = []) => ({
      partes: [],
      caja: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(x, y, z)),
      equipos,
    });
    const b: BibliotecaPiezas = new Map([
      ["bateria", de(26, 0.8, 7, ["notebook", "laptop"])],
      ["bateria@celular", de(6, 0.5, 9, ["celular", "telefono"])],
      ["conector", de(1.3, 0.6, 1.5, ["notebook"])],
      ["conector@usb_c", de(0.9, 0.3, 0.75)],
    ]);
    expect(modeloPara("bateria", b, [25, 1, 8], "celulares Samsung")).toBe(b.get("bateria@celular"));
    expect(modeloPara("bateria", b, undefined, "un teléfono")).toBe(b.get("bateria@celular"));
    expect(modeloPara("bateria", b, [5, 0.4, 8], "Notebook Lenovo")).toBe(b.get("bateria"));
    expect(modeloPara("bateria", b, [5, 0.4, 8], "lavarropas")).toBe(b.get("bateria@celular")); // no nombra a ninguna: decide la medida
    expect(modeloPara("conector_carga", b, [1.3, 0.6, 1.5], "celular")).toBe(b.get("conector@usb_c"));
    expect(modeloPara("conector_carga", b, [1.3, 0.6, 1.5], "MacBook Pro")).toBe(b.get("conector")); // equipo desconocido: medidas
  });

  it("palabras: sin tildes ni mayúsculas", () => {
    expect(palabras("Teléfono MÓVIL, iPhone-13")).toEqual(["telefono", "movil", "iphone", "13"]);
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
  it.each([
    ["notebook", planoNotebookBase],
    ["celular", planoCelular],
  ])("%s: cada pieza mide `dim` y queda centrada en `pos`, con nombres y materiales propios", (_, plano) => {
    const { nodos } = construirEscena(plano, { biblioteca });
    const materiales = new Set<THREE.Material>();
    for (const p of plano.piezas) {
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
      piezas: [
        { pieza: "condensador", forma: "cilindro", dim: [1, 2, 1], pos: [0, 0, 0], pivote: [0, 0, 0] },
        { pieza: "motor_vibrador", forma: "cilindro", dim: [0.4, 0.4, 1], pos: [0, 0, 0], pivote: [0, 0, 0] },
      ],
    };
    const { nodos } = construirEscena(plano, { biblioteca });
    for (const id of ["condensador", "motor_vibrador"]) {
      expect((nodos.get(id)!.children[0] as THREE.Mesh).geometry, id).toBeInstanceOf(THREE.CylinderGeometry);
    }
  });
});
