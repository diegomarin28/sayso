import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { PlanoDePiezas, type KnowledgePack } from "../../shared";
import type { LlamarIA } from "../ia/claude";
import { IndicePiezas, bibliotecaDesdeEscena, modeloPara, type BibliotecaPiezas } from "./biblioteca";
import { cargadorGlb } from "./cargador";
import { generarPlano } from "./generador";

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
const INDICE = IndicePiezas.parse(JSON.parse(readFileSync("public/models/piezas/indice.json", "utf8")));
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
      // Redondo: pantalla y caja con formas redondas, planta circular.
      expect(pieza(redondo, "pantalla").formaBiblioteca).toBe("esfera_reloj");
      expect(raiz(redondo).formaBiblioteca).toBe("tapa_reloj");
      // Se dibujan círculos aunque la planta estimada no sea cuadrada: esas formas escalan igual en x y z.
      for (const forma of ["esfera_reloj", "tapa_reloj"]) expect(INDICE.tipos[forma].ajuste, forma).toBe("redondo:xz");
      // Cuadrado: la pantalla de reloj de la biblioteca (por el id), más alta que ancha.
      expect(pieza(cuadrado, "pantalla").formaBiblioteca).toBeUndefined();
      const [cx, , cz] = pieza(cuadrado, "pantalla").dim;
      expect(cz / cx).toBeGreaterThan(1.1);
      // Con el dato, la forma no queda estimada.
      expect(pieza(redondo, "pantalla").origen).not.toBe("estimada");
    });
  }

  it("sin el dato: la forma más común del tipo (cuadrada), con la caja y la pantalla estimadas y un aviso", async () => {
    const r = await generarPlano({ casoId: "c", knowledgePack: pack(), tipoEquipo: "reloj inteligente" }, iaQueFalla);
    expect(pieza(r.plano, "pantalla").formaBiblioteca).toBeUndefined();
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
    for (const archivo of new Set(["pantalla@reloj", "esfera_reloj", "tapa_reloj", "caja_reloj"].map((t) => indice.familias[indice.tipos[t].familia]))) {
      const datos = readFileSync(carpeta + archivo);
      const escena = (await cargadorGlb().parseAsync(datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength), "")).scene;
      for (const [n, m] of bibliotecaDesdeEscena(escena)) biblioteca.set(n, m);
    }
  });

  it("con formaBiblioteca, esa forma; sin ella (o si no existe), la del id", () => {
    expect(modeloPara("pantalla_reloj", biblioteca, [4, 0.2, 4], "reloj", "esfera_reloj")).toBe(biblioteca.get("esfera_reloj"));
    expect(modeloPara("pantalla_reloj", biblioteca, [4, 0.2, 4.8], "reloj")).toBe(biblioteca.get("pantalla@reloj"));
    expect(modeloPara("pantalla_reloj", biblioteca, [4, 0.2, 4.8], "reloj", "no_existe")).toBe(biblioteca.get("pantalla@reloj"));
  });
});
