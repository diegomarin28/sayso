import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { PlanoDePiezas, Rasgos3D } from "../../shared";
import { EJEMPLOS } from "../../components/viewer/ejemplos";
import { cargadorGlb } from "./cargador";
import {
  IndicePiezas,
  archivosDeFormas,
  archivosPara,
  bibliotecaDesdeEscena,
  formasPara,
  modeloPara,
  palabras,
  type BibliotecaPiezas,
  type ModeloPieza,
} from "./biblioteca";
import { PLANTILLAS_POR_TIPO, elegirPlantilla, piezasProbables } from "./plantillas/por-tipo";
import { aplicarRasgos3D } from "./variantes-pack";

const CARPETA = "public/models/piezas/";
const indice = IndicePiezas.parse(JSON.parse(readFileSync(CARPETA + "indice.json", "utf8")));
const porArchivo = new Map<string, BibliotecaPiezas>();
const nombreDe = new Map<ModeloPieza, string>();

beforeAll(async () => {
  for (const archivo of Object.values(indice.familias)) {
    const datos = readFileSync(CARPETA + archivo);
    const familia = bibliotecaDesdeEscena((await cargadorGlb().parseAsync(datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength), "")).scene);
    porArchivo.set(archivo, familia);
    for (const [nombre, modelo] of familia) nombreDe.set(modelo, nombre);
  }
});

/** Lo que armaba el visor antes (#313): todas las familias que tienen alguna variante de cada id. */
function bibliotecaDeAntes(plano: PlanoDePiezas): BibliotecaPiezas {
  const ids = plano.piezas.flatMap((p) => [p.pieza, ...(p.formaBiblioteca ? [p.formaBiblioteca] : [])]);
  return new Map(archivosPara(ids, indice).flatMap((a) => [...porArchivo.get(a)!]));
}

/** Lo que arma ahora `cargarBiblioteca`: solo las formas posibles, de sus familias. */
function bibliotecaDeAhora(plano: PlanoDePiezas, tipoEquipo?: string): BibliotecaPiezas {
  const formas = formasPara(plano.piezas, indice, tipoEquipo);
  return new Map(archivosDeFormas(formas, indice).flatMap((a) => [...porArchivo.get(a)!].filter(([n]) => formas.has(n))));
}

const elegidas = (plano: PlanoDePiezas, biblioteca: BibliotecaPiezas, tipoEquipo?: string) =>
  Object.fromEntries(plano.piezas.map((p) => {
    const m = modeloPara(p.pieza, biblioteca, p.dim, tipoEquipo, p.formaBiblioteca);
    return [p.pieza, m ? nombreDe.get(m) : null];
  }));

/** El mismo tipo de equipo, más chico o más grande (otro modelo): cambian las medidas, no las piezas. */
const escalado = (plano: PlanoDePiezas, k: number): PlanoDePiezas => ({
  ...plano,
  piezas: plano.piezas.map((p) => ({ ...p, dim: p.dim.map((v) => v * k) as typeof p.dim, pos: p.pos.map((v) => v * k) as typeof p.pos })),
});

const rasgos: Array<[string, string, Rasgos3D]> = [
  ["celular", "celular", { celular: { camarasTraseras: 3, muesca: true, bordes: "rectos" } }],
  ["celular", "celular", { celular: { camarasTraseras: 1, muesca: false, bordes: "redondeados" } }],
  ["televisor", "televisor", { televisor: { apoyo: "central" } }],
  ["televisor", "televisor", { televisor: { apoyo: "laterales" } }],
  ["tablet", "tablet", { tablet: { botonFrontal: true } }],
  ["tablet", "tablet", { tablet: { botonFrontal: false } }],
  ["auriculares_vincha", "auriculares_vincha", { auriculares: { formato: "over_ear" } }],
  ["reloj", "reloj", { reloj: { corona: true, botonesLaterales: 2 } }],
  ["reloj", "reloj", { reloj: { corona: false, botonesLaterales: 1 } }],
  ["reloj_redondo", "reloj", { reloj: { corona: false, botonesLaterales: 0 } }],
  ["reloj_redondo", "reloj", { reloj: { corona: true, botonesLaterales: 1 } }],
];

/** Planos de todos los tipos (ejemplos, plantillas y con rasgos del pack), cada uno en tres tamaños. */
const PLANOS: Array<[string, PlanoDePiezas, string]> = [
  ...Object.entries(EJEMPLOS).map(([id, e]): [string, PlanoDePiezas, string] => [id, e.plano, e.tipoEquipo]),
  ...PLANTILLAS_POR_TIPO.map((p): [string, PlanoDePiezas, string] => [`plantilla ${p.id}`, p.plano, p.nombre]),
  ...rasgos.map(([ejemplo, tipo, r]): [string, PlanoDePiezas, string] => [`${ejemplo} con ${JSON.stringify(r)}`, aplicarRasgos3D(EJEMPLOS[ejemplo].plano, { rasgos3D: r }, tipo), EJEMPLOS[ejemplo].tipoEquipo]),
].flatMap(([id, plano, tipo]) => [0.6, 1, 1.6].map((k): [string, PlanoDePiezas, string] => [`${id} ×${k}`, escalado(plano, k), tipo]));

/** Además del tipo de cada plano: sin tipo, otro modelo del mismo tipo y equipos cruzados. */
const OTROS_TIPOS = [undefined, "notebook Lenovo", "MacBook Pro", "Samsung Galaxy A54", "iPhone 15", "Smart TV 55", "impresora láser Brother", "reloj inteligente", "tablet"];

describe("formasPara: el visor baja solo las formas que puede elegir (#313)", () => {
  it("el índice tiene los mismos equipos que cada forma del GLB", () => {
    for (const familia of porArchivo.values())
      for (const [nombre, modelo] of familia) expect(modelo.equipos, nombre).toEqual(palabras(indice.tipos[nombre].equipos));
  });

  // Uno por plano (con todos los tipos de equipo): en la CI, todos juntos pasan el plazo de 5 s.
  it.each(PLANOS)("%s: con las formas posibles, cada pieza elige la misma forma que con todas las familias de antes", (id, plano, tipo) => {
    const antes = bibliotecaDeAntes(plano);
    for (const t of [tipo, ...OTROS_TIPOS]) expect(elegidas(plano, bibliotecaDeAhora(plano, t), t), `${id} · ${t}`).toEqual(elegidas(plano, antes, t));
  }, 30000);

  it("cubre todos los planos en tres tamaños", () => expect(PLANOS.length * (1 + OTROS_TIPOS.length)).toBeGreaterThan(500));

  it("una notebook ya no baja el reloj, la calculadora ni la tablet; un celular, la notebook ni el reloj", () => {
    const notebook = archivosDeFormas(formasPara(EJEMPLOS.notebook.plano.piezas, indice, "notebook"), indice);
    for (const ajena of ["relojes_demo.glb", "campus.glb", "cotidianos.glb", "tablet_demo.glb"]) expect(notebook).not.toContain(ajena);
    expect(notebook.length).toBeLessThan(archivosPara(EJEMPLOS.notebook.plano.piezas.map((p) => p.pieza), indice).length);
    const celular = archivosDeFormas(formasPara(EJEMPLOS.celular.plano.piezas, indice, "celular"), indice);
    for (const ajena of ["notebook_demo.glb", "relojes_demo.glb", "campus.glb", "cotidianos.glb"]) expect(celular).not.toContain(ajena);
  });

  it("la forma que eligió el generador alcanza sola; una que no existe se elige como sin dato", () => {
    expect([...formasPara([{ pieza: "pantalla", formaBiblioteca: "pantalla@reloj_redonda" }], indice)]).toEqual(["pantalla@reloj_redonda"]);
    expect(formasPara([{ pieza: "pantalla", formaBiblioteca: "pantalla@inventada" }], indice)).toEqual(formasPara([{ pieza: "pantalla" }], indice));
    expect(formasPara([{ pieza: "sensor_temperatura" }], indice).size).toBe(0);
  });

  it("la precarga (sin medidas) incluye lo que después pide el visor con el plano de su tipo", () => {
    for (const { nombre } of PLANTILLAS_POR_TIPO) {
      // La plantilla que elige la precarga con ese tipo (con "notebook sin ventilador", la de notebook).
      const p = elegirPlantilla({ clase: "otro", piezas: [] }, nombre)!;
      const precarga = formasPara(piezasProbables(nombre).map((pieza) => ({ pieza })), indice, nombre);
      for (const forma of formasPara(p.plano.piezas, indice, nombre)) expect(precarga.has(forma), `${nombre}: ${forma}`).toBe(true);
    }
  });
});
