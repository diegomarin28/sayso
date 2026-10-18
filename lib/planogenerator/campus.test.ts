import { existsSync, readFileSync, statSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { cargadorGlb } from "./cargador";
import indice from "../../public/models/piezas/indice.json";
import cobertura from "../../assets/models/blender/campus-cobertura.json";
import { archivosPara, bibliotecaDesdeEscena, leerAjuste, modeloPara, partesAjustadas, type BibliotecaPiezas } from "./biblioteca";
import { RECETAS_DETALLE, recetaPara } from "./materiales";
import { construirEscena } from "./construir";

const archivo = "public/models/piezas/campus.glb";
const entradas = Object.entries(indice.tipos).filter(([, t]) => t.familia === "campus");
let biblioteca: BibliotecaPiezas;
beforeAll(async () => {
  const b = readFileSync(archivo);
  biblioteca = bibliotecaDesdeEscena((await cargadorGlb().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), "")).scene);
});

describe("objetos cercanos del campus", () => {
  it("cubre los 8 grupos con nuevas piezas y reutiliza IDs existentes", () => {
    expect(entradas).toHaveLength(21);
    expect(Object.keys(cobertura)).toHaveLength(8);
    const tipos = indice.tipos as Record<string, { familia: string; equipos: string }>;
    const nuevas = new Set<string>();
    for (const [equipo, grupo] of Object.entries(cobertura)) {
      expect(grupo.nuevas.length, equipo).toBeGreaterThan(0);
      expect(grupo.reutilizadas.length, equipo).toBeGreaterThan(0);
      for (const id of grupo.nuevas) {
        expect(tipos[id]?.familia, id).toBe("campus");
        expect(tipos[id]?.equipos.split(" "), id).toContain(equipo);
        nuevas.add(id);
      }
      for (const id of grupo.reutilizadas) {
        expect(tipos[id], id).toBeDefined();
        expect(tipos[id]?.familia, id).not.toBe("campus");
      }
    }
    expect([...nuevas].sort()).toEqual(entradas.map(([id]) => id).sort());
    for (const id of ["bateria@celular", "pantalla@panel", "retroiluminacion", "fuente", "camara@modulo", "parlante", "joystick_analogico", "cartucho_toner"])
      expect(tipos[id].familia, id).not.toBe("campus");
  });

  it("GLB liviano con exactamente los tipos del índice y render de cada uno", () => {
    expect(statSync(archivo).size).toBeLessThanOrEqual(200 * 1024);
    expect([...biblioteca.keys()].sort()).toEqual(entradas.map(([id]) => id).sort());
    for (const [id] of entradas) {
      expect(id).toMatch(/^[a-z][a-z0-9_]+(@[a-z0-9_]+)?$/);
      expect(existsSync(`assets/models/blender/renders/campus/${id}.jpg`), id).toBe(true);
    }
    for (const equipo of Object.keys(cobertura))
      expect(existsSync(`assets/models/blender/renders/campus/hoja_${equipo}.jpg`), equipo).toBe(true);
  });

  it("reglas explícitas y coherentes entre AJUSTES, índice y GLB", () => {
    const fuente = readFileSync("assets/models/blender/piezas.py", "utf8").split("AJUSTES = {")[1].split("\n}")[0];
    for (const [id, entrada] of entradas) {
      expect(entrada.ajuste, id).toMatch(/^(libre|proporcional|redondo:[xyz]{2}|tramo:[xyz](:redondo)?)$/);
      expect(fuente, id).toContain(`"${id}": "${entrada.ajuste}"`);
      expect(biblioteca.get(id)?.ajuste, id).toEqual(leerAjuste(entrada.ajuste));
    }
  });

  it("carga a demanda y conserva prioridad de recetas anteriores", () => {
    for (const [id] of entradas) {
      const tipo = id.split("@")[0];
      expect(archivosPara([tipo + "_principal"], indice), id).toContain("campus.glb");
      expect(modeloPara(tipo + "_principal", biblioteca), id).toBeDefined();
      expect(recetaPara(tipo), id).not.toBe(recetaPara("sin_receta"));
    }
    expect(recetaPara("pantalla@segmentos")).toBe(recetaPara("pantalla_generica"));
    expect(recetaPara("carcasa_proyector")).toBe(recetaPara("carcasa_generica"));
  });

  it("cada modelo tiene cuerpo, materiales conocidos y geometría finita al ajustarse", () => {
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
      const partes = partesAjustadas(modelo, [4, 9, 3]);
      for (const parte of partes) {
        expect(Array.from(parte.geometria.getAttribute("position").array).every(Number.isFinite), id).toBe(true);
        parte.geometria.dispose();
      }
    }
  });

  it("construye nodos independientes y animables para todos los tipos", () => {
    for (const [id] of entradas) {
      const plano = { modelo: "Componentes genéricos de campus", unidades: "cm" as const,
        piezas: [{ pieza: id.split("@")[0] + "_principal", forma: "caja" as const,
          dim: [6, 3, 5] as [number, number, number], pos: [0, 0, 0] as [number, number, number], pivote: [0, 0, 0] as [number, number, number] }] };
      const escena = construirEscena(plano, { biblioteca: new Map([[id, biblioteca.get(id)!]]) });
      expect(escena.avisos, id).toEqual([]);
      expect(escena.nodos.size, id).toBe(1);
      const nodo = escena.nodos.get(plano.piezas[0].pieza)!;
      expect(nodo.name, id).toBe(plano.piezas[0].pieza);
      expect(nodo.children.length, id).toBeGreaterThan(0);
    }
  });
});
