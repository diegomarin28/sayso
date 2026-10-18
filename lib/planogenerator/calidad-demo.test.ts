import { readFileSync, statSync } from "node:fs";
import * as THREE from "three";
import { beforeAll, describe, expect, it } from "vitest";
import indice from "../../public/models/piezas/indice.json";
import referencia from "../../assets/models/blender/calidad-referencia.json";
import { cargadorGlb } from "./cargador";
import { bibliotecaDesdeEscena, type BibliotecaPiezas } from "./biblioteca";
import { GALERIA_CAMPUS } from "../../components/viewer/galeria/campus";
import { PlanoDePiezas } from "../../shared";

const familias = new Map<string, BibliotecaPiezas>();
beforeAll(async () => {
  for (const [id, nombre] of Object.entries(indice.familias)) {
    const b = readFileSync("public/models/piezas/" + nombre);
    familias.set(id, bibliotecaDesdeEscena((await cargadorGlb().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), "")).scene));
  }
});

describe("calidad y presupuesto de la demo", () => {
  it("todas las familias pesan como máximo 200 KiB y conservan los tipos anteriores", () => {
    for (const nombre of Object.values(indice.familias))
      expect(statSync("public/models/piezas/" + nombre).size, nombre).toBeLessThanOrEqual(200 * 1024);
    for (const [id, anterior] of Object.entries(referencia))
      expect([...familias.get(id)!.keys()], id).toEqual(expect.arrayContaining(anterior.tipos));
    expect(familias.get("campus")?.size).toBe(21);
  });

  it("los pivotes están en el centro, sin traslaciones ocultas ni geometría inválida", () => {
    for (const [familia, modelos] of familias) for (const [id, modelo] of modelos) {
      const tam = modelo.caja.getSize(new THREE.Vector3());
      const centro = modelo.caja.getCenter(new THREE.Vector3());
      expect(centro.length(), `${familia}:${id}`).toBeLessThan(Math.max(tam.x, tam.y, tam.z) * 0.003 + 0.002);
      expect([tam.x, tam.y, tam.z].every((n) => Number.isFinite(n) && n > 0), id).toBe(true);
      for (const p of modelo.partes) for (const atributo of ["position", "normal"]) {
        const a = p.geometria.getAttribute(atributo);
        expect(a.array instanceof Float32Array, `${id}:${atributo}`).toBe(true);
        expect(Array.from(a.array).every(Number.isFinite), `${id}:${atributo}`).toBe(true);
      }
    }
  });

  it("cada tipo tiene AJUSTES explícito en la fuente, igual que en el índice", () => {
    const fuente = readFileSync("assets/models/blender/piezas.py", "utf8").split("AJUSTES = {")[1].split("\n}")[0];
    for (const [id, t] of Object.entries(indice.tipos)) expect(fuente, id).toContain(`"${id}": "${t.ajuste}"`);
  });

  it("amplía enteros normalizados antes de aplicar la escala de decodificación", () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Int16Array([-32767, -32767, -32767, 32767, -32767, 32767, 0, 32767, 0]), 3, true));
    g.setIndex([0, 1, 2]);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial()); m.material.name = "cuerpo.placa";
    m.scale.set(5, 3, 2); m.position.set(4, 6, 1);
    const tipo = new THREE.Group(); tipo.name = "placa"; tipo.add(m);
    const escena = new THREE.Group(); escena.add(tipo);
    const modelo = bibliotecaDesdeEscena(escena).get("placa")!;
    expect(modelo.caja.getSize(new THREE.Vector3()).toArray()).toEqual([10, 6, 4]);
    expect(modelo.caja.getCenter(new THREE.Vector3()).toArray()).toEqual([4, 6, 1]);
  });

  it("rechaza triángulos con recetas mezcladas o fuera de la paleta", () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    g.setAttribute("color", new THREE.Uint8BufferAttribute([255, 255, 255, 0, 255, 255, 255, 0, 255, 255, 255, 1], 4, true));
    const tipo = new THREE.Group(); tipo.name = "placa"; tipo.userData.recetas = [0, 1]; tipo.add(new THREE.Mesh(g));
    const escena = new THREE.Group(); escena.userData.paletaRecetas = ["cuerpo", "metal"]; escena.add(tipo);
    expect(() => bibliotecaDesdeEscena(escena)).toThrow("Receta de triángulo inválida");
  });

  it("los esquemas del campus validan, tienen una raíz y excluyen componentes removibles del MacBook", () => {
    for (const e of GALERIA_CAMPUS) {
      expect(() => PlanoDePiezas.parse(e.plano), e.id).not.toThrow();
      const ids = e.plano.piezas.map((p) => p.pieza);
      expect(new Set(ids).size, e.id).toBe(ids.length);
      expect(e.plano.piezas.filter((p) => !p.padre), e.id).toHaveLength(1);
      for (const p of e.plano.piezas) if (p.padre) expect(ids, p.pieza).toContain(p.padre);
      if (e.id.startsWith("macbook")) for (const id of ["ram", "ssd", "wifi", "disco_duro"]) expect(ids).not.toContain(id);
      if (e.id === "macbook-air") expect(ids).not.toContain("ventilador");
    }
    for (const id of ["notebook", "celular", "televisor", "reloj-pared", "reloj-pulsera", "canilla", "lavatorio", "calculadora", "proyector-aula"])
      expect(GALERIA_CAMPUS.some((e) => e.id === id), id).toBe(true);
    expect(GALERIA_CAMPUS.some((e) => e.id === "aspiradora")).toBe(false);
  });
});
