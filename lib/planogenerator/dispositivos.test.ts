import { readFileSync, statSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import indice from "../../public/models/piezas/indice.json";
import { archivosPara, bibliotecaDesdeEscena, modeloPara, type BibliotecaPiezas } from "./biblioteca";
import { RECETAS_DETALLE, recetaPara } from "./materiales";
import { construirEscena } from "./construir";

const archivo = "public/models/piezas/dispositivos.glb";
const entradas = Object.entries(indice.tipos).filter(([, t]) => t.familia === "dispositivos");
let biblioteca: BibliotecaPiezas;
beforeAll(async () => {
  const b = readFileSync(archivo);
  const escena = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), "");
  biblioteca = bibliotecaDesdeEscena(escena.scene);
});

describe("familia independiente dispositivos", () => {
  it("cubre los seis equipos sin agregar piezas reservadas", () => {
    expect(entradas).toHaveLength(42);
    for (const equipo of ["aspiradora", "secador", "impresora", "consola", "router", "cafetera"])
      expect(entradas.filter(([, t]) => t.equipos.split(" ").includes(equipo)).length, equipo).toBeGreaterThanOrEqual(5);
    for (const [id] of entradas) {
      expect(id).toMatch(/^[a-z][a-z0-9_]+$/);
      expect(id).not.toMatch(/^(evaporador|turbina|retroiluminacion|bandeja|compresor|panel|tambor|bomba)(_|$)/);
    }
  });

  it("es un GLB liviano y coincide exactamente con el índice", () => {
    expect(statSync(archivo).size).toBeLessThan(2 * 1024 * 1024);
    expect([...biblioteca.keys()].sort()).toEqual(entradas.map(([id]) => id).sort());
  });

  it("carga solo su familia para cada tipo, incluso con sufijo de función o ubicación", () => {
    for (const [id] of entradas) {
      expect(archivosPara([id + "_principal"], indice), id).toEqual(["dispositivos.glb"]);
      expect(modeloPara(id + "_principal", biblioteca), id).toBeDefined();
      expect(recetaPara(id), id).not.toBe(recetaPara("sin_receta"));
    }
  });

  it("cada componente tiene cuerpo, normales y dimensiones finitas", () => {
    for (const [id, modelo] of biblioteca) {
      expect(modelo.partes.some((p) => p.receta === "cuerpo"), id).toBe(true);
      const tam = modelo.caja.getSize(new THREE.Vector3());
      expect([tam.x, tam.y, tam.z].every((n) => Number.isFinite(n) && n > 0), id).toBe(true);
      for (const parte of modelo.partes) {
        expect(["cuerpo", ...Object.keys(RECETAS_DETALLE)], id).toContain(parte.receta);
        for (const attr of ["position", "normal"]) {
          const a = parte.geometria.getAttribute(attr);
          expect(a?.count, `${id}:${attr}`).toBeGreaterThan(0);
          expect(Array.from(a.array).every(Number.isFinite), `${id}:${attr}`).toBe(true);
        }
      }
    }
  });

  it("el visor construye cada modelo como nodo independiente, nombrado y animable", () => {
    const piezas = entradas.map(([id], i) => ({ pieza: id, forma: "caja" as const, dim: [6, 3, 5] as [number, number, number], pos: [i * 8, 0, 0] as [number, number, number], pivote: [0, 0, 0] as [number, number, number] }));
    const escena = construirEscena({ modelo: "Validación técnica de componentes genéricos", unidades: "cm", piezas }, { biblioteca });
    expect(escena.avisos).toEqual([]);
    expect(escena.nodos.size).toBe(42);
    for (const [id, nodo] of escena.nodos) {
      expect(nodo.name).toBe(id);
      expect(nodo.children.length).toBeGreaterThan(0);
    }
  });
});
