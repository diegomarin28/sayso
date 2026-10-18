import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { PlanoDePiezas, type KnowledgePack } from "../../shared";
import type { LlamarIA } from "../ia/claude";
import { IndicePiezas, bibliotecaDesdeEscena, modeloPara, type BibliotecaPiezas } from "./biblioteca";
import { cargadorGlb } from "./cargador";
import { generarPlano } from "./generador";
import { terminarGuardado } from "./obtener";

/**
 * #234: el reloj se dibuja con la forma de pantalla que trae el pack (cuadrada o redonda). Es un dato del
 * pack, no la marca ni el modelo: los dos relojes se llaman igual y solo cambia `formaPantalla`. Sin el
 * dato, la forma más común del tipo, marcada como estimada.
 */
const pack = (formaPantalla?: "cuadrada" | "redonda"): KnowledgePack => ({
  modelo: "Reloj X",
  clase: "otro",
  verificado: false,
  fuentes: [{ doc: "guía pública" }],
  piezas: ["pantalla", "bateria", "placa", "correa_reloj"].map((id) => ({ id, nombre: id, descripcion: "", ubicacion: "" })),
  pasos: [],
  advertencias: [],
  repuestos: [],
  ...(formaPantalla ? { formaPantalla } : {}),
});
const iaQueFalla: LlamarIA = async () => "no es json";
/** La IA sin manual: ubica todo estimado (sin página). */
const iaEstimada: LlamarIA = async () =>
  JSON.stringify({
    base_ancho_cm: 4.5,
    base_prof_cm: 5,
    medidas_fuente: "estimada",
    piezas: ["pantalla", "bateria", "placa"].map((pieza, i) => ({
      pieza, x: 0, z: -0.3 + i * 0.3, ancho: 0.6, prof: 0.5, alto_cm: 0.2, capa: "sobre_base", sobre: null, forma: "caja", etiquetaManual: null, pagina: null, confianza: "baja",
    })),
  });

const pieza = (p: PlanoDePiezas, id: string) => p.piezas.find((x) => x.pieza === id)!;
const raiz = (p: PlanoDePiezas) => p.piezas.find((x) => !x.padre)!;

describe("forma de la pantalla del reloj (dato del pack, por tipo)", () => {
  for (const [camino, ia] of [["solo esqueleto", iaQueFalla], ["IA estimada", iaEstimada]] as const) {
    it(`${camino}: un reloj redondo y uno cuadrado salen distintos`, async () => {
      const redondo = (await generarPlano({ casoId: "c", knowledgePack: pack("redonda"), tipoEquipo: "reloj inteligente" }, ia)).plano;
      const cuadrado = (await generarPlano({ casoId: "c", knowledgePack: pack("cuadrada"), tipoEquipo: "reloj inteligente" }, ia)).plano;
      expect(() => PlanoDePiezas.parse(redondo)).not.toThrow();
      // Redondo: las formas redondas de reloj de la biblioteca, con planta circular.
      expect(pieza(redondo, "pantalla").formaBiblioteca).toBe("pantalla@reloj_redonda");
      expect(raiz(redondo).formaBiblioteca).toBe("caja_reloj@redonda");
      const [rx, , rz] = pieza(redondo, "pantalla").dim;
      expect(rz / rx).toBeLessThan(1.15);
      // Cuadrado: las formas cuadradas de reloj (#247), no las de celular.
      expect(pieza(cuadrado, "pantalla").formaBiblioteca).toBe("pantalla@reloj_cuadrada");
      expect(raiz(cuadrado).formaBiblioteca).toBe("caja_reloj@cuadrada");
      const [cx, , cz] = pieza(cuadrado, "pantalla").dim;
      expect(cz / cx).toBeGreaterThan(1.1);
      // Con el dato, la forma no queda estimada.
      expect(pieza(redondo, "pantalla").origen).not.toBe("estimada");
    });
  }

  it("sin el dato: la forma más común del tipo (cuadrada), con la caja y la pantalla estimadas y un aviso", async () => {
    const r = await generarPlano({ casoId: "c", knowledgePack: pack(), tipoEquipo: "reloj inteligente" }, iaQueFalla);
    expect(pieza(r.plano, "pantalla").formaBiblioteca).toBe("pantalla@reloj_cuadrada");
    expect(pieza(r.plano, "pantalla").origen).toBe("estimada");
    expect(raiz(r.plano).origen).toBe("estimada");
    expect(pieza(r.plano, "bateria").origen).toBe("plantilla"); // lo demás no cambia
    expect(r.avisos.join(" ")).toMatch(/forma de la pantalla no vino en el pack.*cuadrada.*estimada/);
  });

  it("otro tipo (un celular) no cambia aunque el pack traiga la forma", async () => {
    const kp = { ...pack("redonda"), piezas: [{ id: "bateria", nombre: "bateria", descripcion: "", ubicacion: "" }] };
    const r = await generarPlano({ casoId: "c", knowledgePack: kp, tipoEquipo: "celular" }, iaQueFalla);
    expect(r.plano.piezas.every((p) => !p.formaBiblioteca)).toBe(true);
    expect(r.avisos.join(" ")).not.toMatch(/forma de la pantalla/);
  });
});

describe("modeloPara respeta la forma que eligió el generador", () => {
  let biblioteca: BibliotecaPiezas;
  beforeAll(async () => {
    const carpeta = "public/models/piezas/";
    const indice = IndicePiezas.parse(JSON.parse(readFileSync(carpeta + "indice.json", "utf8")));
    biblioteca = new Map();
    for (const archivo of new Set(["pantalla@reloj", "esfera_reloj", "tapa_reloj", "caja_reloj", "caja_reloj@cuadrada", "pantalla@reloj_redonda"].map((t) => indice.familias[indice.tipos[t].familia]))) {
      const datos = readFileSync(carpeta + archivo);
      const escena = (await cargadorGlb().parseAsync(datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength), "")).scene;
      for (const [n, m] of bibliotecaDesdeEscena(escena)) biblioteca.set(n, m);
    }
  });

  it("con formaBiblioteca, esa forma; sin ella (o si no existe), la del id", () => {
    expect(modeloPara("pantalla_reloj", biblioteca, [4, 0.2, 4.8], "reloj", "esfera_reloj")).toBe(biblioteca.get("esfera_reloj"));
    expect(modeloPara("pantalla_reloj", biblioteca, [4, 0.2, 4.8], "reloj")).toBe(biblioteca.get("pantalla@reloj"));
    expect(modeloPara("pantalla_reloj", biblioteca, [4, 0.2, 4.8], "reloj", "no_existe")).toBe(biblioteca.get("pantalla@reloj"));
  });
});

describe("#234: cada forma de reloj usa sus piezas de la biblioteca (2 variantes)", () => {
  let biblioteca: BibliotecaPiezas;
  beforeAll(async () => {
    const carpeta = "public/models/piezas/";
    const indice = IndicePiezas.parse(JSON.parse(readFileSync(carpeta + "indice.json", "utf8")));
    biblioteca = new Map();
    for (const archivo of new Set(Object.values(indice.tipos).map((t) => indice.familias[t.familia]))) {
      const datos = readFileSync(carpeta + archivo);
      const escena = (await cargadorGlb().parseAsync(datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength), "")).scene;
      for (const [n, m] of bibliotecaDesdeEscena(escena)) biblioteca.set(n, m);
    }
  });

  it.each([
    ["cuadrada", { caja_reloj: "caja_reloj@cuadrada", pantalla: "pantalla@reloj_cuadrada", tapa_reloj: "tapa_reloj@cuadrada" }],
    ["redonda", { caja_reloj: "caja_reloj@redonda", pantalla: "pantalla@reloj_redonda", tapa_reloj: "tapa_reloj" }],
  ] as const)("reloj de pantalla %s", async (forma, esperadas) => {
    const r = await generarPlano({ casoId: "c", knowledgePack: pack(forma), tipoEquipo: "reloj inteligente" }, iaQueFalla);
    for (const [id, nombre] of Object.entries(esperadas)) {
      const p = pieza(r.plano, id);
      expect(biblioteca.has(nombre), nombre).toBe(true);
      expect(modeloPara(p.pieza, biblioteca, p.dim, "reloj inteligente", p.formaBiblioteca), id).toBe(biblioteca.get(nombre));
    }
  });
});

describe("un plano de la caché armado con la otra forma", () => {
  const otra = { redonda: "cuadrada", cuadrada: "redonda" } as const;
  it.each([["redonda"], ["cuadrada"]] as const)("toma la forma del pack (%s) en la caja y la pantalla", async (forma) => {
    const viejo = (await generarPlano({ casoId: "c", knowledgePack: pack(otra[forma]), tipoEquipo: "reloj inteligente" }, iaQueFalla)).plano;
    const nuevo = (await generarPlano({ casoId: "c", knowledgePack: pack(forma), tipoEquipo: "reloj inteligente" }, iaQueFalla)).plano;
    const r = terminarGuardado(viejo, pack(forma), "reloj inteligente").plano;
    expect(raiz(r).formaBiblioteca).toBe(raiz(nuevo).formaBiblioteca);
    expect(raiz(r).dim).toEqual(raiz(nuevo).dim);
    expect(pieza(r, "pantalla").formaBiblioteca).toBe(pieza(nuevo, "pantalla").formaBiblioteca);
    expect(pieza(r, "pantalla").dim).toEqual(pieza(nuevo, "pantalla").dim);
    expect(r.piezas.map((x) => x.pieza).sort()).toEqual(nuevo.piezas.map((x) => x.pieza).sort());
  });

  it("una caja que salió de una página del manual no se toca", async () => {
    const viejo = (await generarPlano({ casoId: "c", knowledgePack: pack("cuadrada"), tipoEquipo: "reloj inteligente" }, iaQueFalla)).plano;
    const delManual = { ...viejo, piezas: viejo.piezas.map((x) => (!x.padre ? { ...x, origen: "manual" as const } : x)) };
    const r = terminarGuardado(delManual, pack("redonda"), "reloj inteligente").plano;
    expect(raiz(r).formaBiblioteca).toBe(raiz(viejo).formaBiblioteca);
    expect(raiz(r).dim).toEqual(raiz(viejo).dim);
  });
});

describe("la tapa va del lado donde la pone el esqueleto", () => {
  it.each([["redonda"], ["cuadrada"]] as const)("reloj (%s): la tapa (el dorso) abajo de todo; arriba, la pantalla", async (forma) => {
    const r = await generarPlano({ casoId: "c", knowledgePack: pack(forma), tipoEquipo: "reloj inteligente" }, iaQueFalla);
    const tapa = pieza(r.plano, "tapa_reloj");
    const abajo = (x: (typeof r.plano.piezas)[number]) => x.pos[1] - x.dim[1] / 2;
    const arriba = (x: (typeof r.plano.piezas)[number]) => x.pos[1] + x.dim[1] / 2;
    for (const x of r.plano.piezas.filter((y) => y !== tapa)) expect(abajo(tapa), x.pieza).toBeLessThanOrEqual(abajo(x) + 1e-6);
    const pantalla = pieza(r.plano, "pantalla");
    for (const x of r.plano.piezas.filter((y) => y.pieza !== "correa_reloj")) expect(arriba(pantalla) + 1e-6, x.pieza).toBeGreaterThanOrEqual(arriba(x));
  });

  it("celular: la tapa trasera sigue arriba de todo (se lo mira por atrás)", async () => {
    const kp = { ...pack(), piezas: ["bateria", "placa_madre"].map((id) => ({ id, nombre: id, descripcion: "", ubicacion: "" })) };
    const r = await generarPlano({ casoId: "c", knowledgePack: kp, tipoEquipo: "celular" }, iaQueFalla);
    const tapa = pieza(r.plano, "tapa_trasera");
    for (const x of r.plano.piezas.filter((y) => y !== tapa)) expect(tapa.pos[1], x.pieza).toBeGreaterThan(x.pos[1]);
  });
});
