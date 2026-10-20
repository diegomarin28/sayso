import { readFileSync } from "node:fs";
import { cargadorGlb } from "../../lib/planogenerator/cargador";
import { beforeAll, describe, expect, it } from "vitest";
import type { Accion } from "../../shared";
import { IndicePiezas, archivosPara, bibliotecaDesdeEscena, planoNotebookBase, type BibliotecaPiezas } from "../../lib/planogenerator";
import { siguienteBiblioteca } from "./biblioteca";
import { animar, continuarAnimacion, prepararEscena } from "./escena";
import { aplicarAccion, estadoInicial, type EstadoEscena } from "./reproductor";

/** Las piezas reales de la notebook, de los mismos GLB que baja la app. */
let biblioteca: BibliotecaPiezas;
beforeAll(async () => {
  const carpeta = "public/models/piezas/";
  const indice = IndicePiezas.parse(JSON.parse(readFileSync(carpeta + "indice.json", "utf8")));
  biblioteca = new Map();
  for (const archivo of archivosPara(planoNotebookBase.piezas.map((p) => p.pieza), indice)) {
    const datos = readFileSync(carpeta + archivo);
    const gltf = await cargadorGlb().parseAsync(datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength), "");
    for (const [nombre, modelo] of bibliotecaDesdeEscena(gltf.scene)) biblioteca.set(nombre, modelo);
  }
});

describe("siguienteBiblioteca: las piezas que llegan tarde reemplazan a las primitivas", () => {
  const b = new Map() as BibliotecaPiezas;
  it("primero el plazo (primitivas), después la descarga: reemplaza", () => {
    const tras = siguienteBiblioteca(undefined, "ssd,ventilador", null);
    expect(tras?.biblioteca).toBeNull();
    expect(siguienteBiblioteca(tras, "ssd,ventilador", b)?.biblioteca).toBe(b);
  });
  it("primero la descarga, después el plazo: se queda con las piezas", () => {
    const tras = siguienteBiblioteca(undefined, "ssd", b);
    expect(siguienteBiblioteca(tras, "ssd", null)).toBe(tras);
  });
  it("una descarga que falla después del plazo no cambia nada", () => {
    const tras = siguienteBiblioteca(undefined, "ssd", null);
    expect(siguienteBiblioteca(tras, "ssd", null)).toBe(tras);
  });
  it("mismas piezas con otras formas posibles (otras medidas): reemplaza; con las mismas formas, no rearma", () => {
    const una = new Map([["ssd", {}]]) as unknown as BibliotecaPiezas;
    const otra = new Map([["ssd@m2", {}]]) as unknown as BibliotecaPiezas;
    const tras = siguienteBiblioteca(undefined, "ssd", una);
    expect(siguienteBiblioteca(tras, "ssd", new Map(una))).toBe(tras);
    expect(siguienteBiblioteca(tras, "ssd", otra)?.biblioteca).toBe(otra);
  });
});

describe("continuarAnimacion: cambiar primitivas por piezas reales a mitad de un paso", () => {
  it("cada pieza sigue donde iba y con el mismo tramo, sin saltar ni repetir", () => {
    const ctx = { casoId: "t" };
    let estado: EstadoEscena = estadoInicial(planoNotebookBase.piezas.map((p) => p.pieza));
    const acciones: Accion[] = [
      { t: "resaltar", pieza: "ventilador" },
      { t: "desplazar", pieza: "ventilador", vec: [0, 4, 0] },
      { t: "despiezar", cantidad: 0.6 },
    ];
    for (const accion of acciones) estado = aplicarAccion(estado, accion, ctx).estado;

    const primitivas = prepararEscena(planoNotebookBase);
    animar(primitivas, estado, 1000); // arranca el tramo
    animar(primitivas, estado, 1300); // a mitad de camino

    const reales = prepararEscena(planoNotebookBase, biblioteca);
    // Son otras mallas (las de Blender), con los mismos ids.
    expect([...reales.nodos.keys()]).toEqual([...primitivas.nodos.keys()]);
    expect(reales.nodos.get("ventilador")!.mallas.length).not.toBe(primitivas.nodos.get("ventilador")!.mallas.length);

    continuarAnimacion(primitivas, reales);
    for (const t of [1300, 1500, 5000]) {
      animar(primitivas, estado, t);
      animar(reales, estado, t);
      for (const [id, a] of reales.nodos) {
        const b = primitivas.nodos.get(id)!;
        expect(a.nodo.position.distanceTo(b.nodo.position), `${id} en t=${t}`).toBeLessThan(1e-9);
        expect(a.tw.foco.hasta).toEqual(b.tw.foco.hasta);
      }
    }
    // A mitad del tramo el ventilador no volvió al reposo ni saltó al final: va por el medio.
    const v = reales.nodos.get("ventilador")!;
    expect(v.tw.desp.inicio).toBe(primitivas.nodos.get("ventilador")!.tw.desp.inicio);
  });
});
