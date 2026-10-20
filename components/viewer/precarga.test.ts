import { readFileSync } from "node:fs";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { IndicePiezas, archivosDeFormas, formasPara } from "../../lib/planogenerator";
import { planoCelular } from "../../lib/planogenerator/plantillas/equipos";
import { piezasProbables } from "../../lib/planogenerator/plantillas/por-tipo";
import { cargarBiblioteca, precargarPiezas } from "./biblioteca";

const CARPETA = "public/models/piezas/";
const indice = IndicePiezas.parse(JSON.parse(readFileSync(CARPETA + "indice.json", "utf8")));
const pack = (ids: string[]) => ({ clase: "otro" as const, piezas: ids.map((id) => ({ id })) });

describe("piezasProbables: qué formas precargar antes de tener el plano", () => {
  // Por tipo, nunca por modelo: dos variantes de cada tipo dan el mismo esqueleto.
  it.each([
    ["iPhone 15", "Samsung Galaxy A54", "marco"],
    ["Smart TV 55 pulgadas", "televisor LG", "carcasa_televisor"],
    ["notebook Lenovo", "MacBook Pro", "base"],
    ["impresora Epson", "impresora multifunción Canon", "carro_impresion"],
    ["impresora láser Brother", "Samsung Xpress láser", "carcasa_impresora"],
  ])("%s y %s: las del esqueleto de su tipo", (a, b, raiz) => {
    expect(piezasProbables(a)).toEqual(piezasProbables(b));
    expect(piezasProbables(a)).toContain(raiz);
  });

  it("con el pack: sus piezas más las del esqueleto, sin repetir; sin nada, nada", () => {
    const ids = piezasProbables("celular", pack(["bateria", "flex_carga"]));
    expect(ids).toContain("flex_carga");
    expect(ids).toContain("marco");
    expect(new Set(ids).size).toBe(ids.length);
    expect(piezasProbables("una cosa rara", pack(["ventilador"]))).toEqual(["ventilador"]);
    expect(piezasProbables()).toEqual([]);
  });
});

describe("precargarPiezas: el visor encuentra las formas ya bajadas", () => {
  const bajados: string[] = [];
  beforeAll(() => {
    vi.stubGlobal("fetch", async () => new Response(readFileSync(CARPETA + "indice.json", "utf8")));
    vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(async function (this: GLTFLoader, url: string) {
      const archivo = url.split("/").pop()!;
      bajados.push(archivo);
      const datos = readFileSync(CARPETA + archivo);
      return this.parseAsync(datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength), "");
    });
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("con el tipo de equipo baja las familias de su esqueleto, una vez; después el visor no baja nada", async () => {
    await precargarPiezas("Samsung Galaxy S23");
    const pedidas = piezasProbables("celular").map((pieza) => ({ pieza }));
    const esperadas = archivosDeFormas(formasPara(pedidas, indice, "Samsung Galaxy S23"), indice);
    expect([...bajados].sort()).toEqual([...esperadas].sort());
    // Solo las variantes de celular o sin equipo: ni la notebook ni el reloj (#313).
    expect(bajados).not.toContain("notebook_demo.glb");
    expect(bajados).not.toContain("relojes_demo.glb");
    const antes = bajados.length;
    const biblioteca = await cargarBiblioteca(planoCelular.piezas, "Samsung Galaxy S23");
    expect(bajados.length).toBe(antes);
    expect(biblioteca?.size).toBeGreaterThan(0);
    // La biblioteca trae solo las formas que el visor puede elegir para ese plano.
    expect(new Set(biblioteca!.keys())).toEqual(formasPara(planoCelular.piezas, indice, "Samsung Galaxy S23"));
  });

  it("sin tipo ni pack no baja nada", async () => {
    const antes = bajados.length;
    await precargarPiezas("   ", null);
    expect(bajados.length).toBe(antes);
  });
});
