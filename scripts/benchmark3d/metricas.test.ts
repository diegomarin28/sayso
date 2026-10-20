import { describe, expect, it } from "vitest";
import type { PiezaPlano, PlanoDePiezas, Vec3 } from "../../shared";
import type { FotoReferencia, MedidasReferencia } from "./caso";
import { bajas, type LineaBase } from "./informe";
import {
  MARCO_TODO,
  certeza,
  choques,
  enFoto,
  enVista,
  espejadoEnX,
  flotantes,
  posiciones,
  proporciones,
  puntosEscala,
  puntosForma,
  solape,
} from "./metricas";
import type { Resultado } from "./puntuar";

const pieza = (pieza: string, pos: Vec3, dim: Vec3, extra: Partial<PiezaPlano> = {}): PiezaPlano => ({ pieza, forma: "caja", pos, dim, pivote: [0, 0, 0], ...extra });
const plano = (...piezas: PiezaPlano[]): PlanoDePiezas => ({ modelo: "prueba", unidades: "cm", piezas });
const medidas = (x: number, y: number, z: number): MedidasReferencia => ({ x, y, z, fuente: "https://example.com/ficha" });

/** Una caja de 40 × 20 × 10 parada, con piezas adentro. */
const carcasa = pieza("carcasa", [0, 10, 0], [40, 20, 10]);

describe("choques: piezas que se atraviesan a medias", () => {
  it("dos piezas hermanas encastradas chocan; separadas o una con su carcasa, no", () => {
    const a = pieza("a", [-5, 10, 0], [10, 10, 4], { padre: "carcasa" });
    const b = pieza("b", [1, 10, 0], [10, 10, 4], { padre: "carcasa" }); // 4 de 10 cm de ancho encima de a
    const c = pieza("c", [15, 10, 0], [6, 6, 4], { padre: "carcasa" });
    expect(choques(plano(carcasa, a, b, c))).toEqual([["a", "b", 0.4]]);
  });

  it("una pieza entera adentro de otra es una carcasa con su contenido (las cajas no saben qué es hueco)", () => {
    const caja = pieza("caja", [0, 10, 0], [20, 10, 8]);
    const adentro = pieza("adentro", [0, 10, 0], [4, 4, 4]);
    expect(choques(plano(caja, adentro))).toEqual([]);
  });

  it("las piezas fuera del cuerpo no cuentan (la caja de una correa atraviesa la del reloj)", () => {
    const caja = pieza("caja_reloj", [0, 1, 0], [4.4, 1.1, 5.2]);
    const correa = pieza("correa_reloj", [0, 0.6, 0], [2.4, 0.4, 19]);
    const sensor = pieza("sensor", [0, 0.6, 0], [3, 0.6, 3], { padre: "caja_reloj" });
    expect(choques(plano(caja, correa, sensor)).length).toBeGreaterThan(0);
    expect(choques(plano(caja, correa, sensor), ["correa"])).toEqual([]);
  });

  it("solape: volumen en común", () => {
    expect(solape(pieza("a", [0, 0, 0], [2, 2, 2]), pieza("b", [1, 0, 0], [2, 2, 2]))).toBe(4);
    expect(solape(pieza("a", [0, 0, 0], [2, 2, 2]), pieza("b", [5, 0, 0], [2, 2, 2]))).toBe(0);
  });
});

describe("flotantes: piezas que no tocan a ninguna otra", () => {
  it("una pieza lejos del equipo flota; las que se apoyan, no", () => {
    const placa = pieza("placa", [0, 10, -4], [20, 10, 1], { padre: "carcasa" });
    const lejos = pieza("lejos", [200, 10, 0], [2, 2, 2], { padre: "carcasa" });
    expect(flotantes(plano(carcasa, placa, lejos))).toEqual(["lejos"]);
    expect(flotantes(plano(carcasa))).toEqual([]);
  });
});

describe("proporciones contra las medidas reales", () => {
  it("el doble de grande con la misma forma: escala 2 y forma perfecta", () => {
    const p = proporciones(plano(carcasa), medidas(20, 10, 5))!;
    expect(p.escala).toBeCloseTo(2);
    p.errores.forEach((e) => expect(e).toBeCloseTo(0));
    expect(puntosForma(p)).toBeCloseTo(1);
    expect(puntosEscala(p)).toBeCloseTo(0); // el doble ya vale 0
  });

  it("otra forma con el mismo volumen: escala 1 y error en los ejes que no coinciden", () => {
    const p = proporciones(plano(carcasa), medidas(20, 20, 20))!; // 8000 cm³ como la carcasa
    expect(p.escala).toBeCloseTo(1);
    expect(p.errores[0]).toBeCloseTo(Math.log(2));
    expect(puntosForma(p)).toBeLessThan(0.5);
  });

  it("sin las piezas fuera del cuerpo (el pie de un TV no entra en las medidas sin pie)", () => {
    const pie = pieza("pie", [0, -5, 0], [10, 10, 10]);
    expect(proporciones(plano(carcasa, pie), medidas(40, 20, 10), ["pie"])!.escala).toBeCloseTo(1);
    expect(proporciones(plano(carcasa, pie), medidas(40, 20, 10))!.escala).toBeGreaterThan(1);
  });
});

/** Foto de frente del equipo parado: la carcasa ocupa de (100, 50) a (500, 250) px. */
const foto = (extra: Partial<FotoReferencia> = {}): FotoReferencia => ({
  archivo: "frente.jpg",
  url: "https://example.com/frente.jpg",
  pagina: "https://example.com/frente",
  licencia: "CC0",
  descripcion: "de frente",
  derecha: "+x",
  abajo: "-y",
  marco: "carcasa",
  esquinas: { ai: [100, 50], ad: [500, 50], bd: [500, 250], bi: [100, 250] },
  piezas: {},
  ...extra,
});

describe("posición contra la foto anotada", () => {
  // Arriba a la derecha de la carcasa (x = 10 de 20, y = 15 de 0…20).
  const boton = pieza("boton", [10, 15, 5], [2, 2, 1], { padre: "carcasa" });

  it("de frente: la pieza arriba a la derecha cae arriba a la derecha de la foto", () => {
    expect(enVista(plano(carcasa, boton), "boton", foto())).toEqual([0.5, -0.5]);
    expect(enFoto([400, 100], foto())[0]).toBeCloseTo(0.5);
    expect(enFoto([400, 100], foto())[1]).toBeCloseTo(-0.5);
    expect(posiciones(plano(carcasa, boton), [foto({ piezas: { boton: [400, 100] } })])).toEqual([{ foto: "frente.jpg", pieza: "boton", d: 0, puntos: 2 }]);
  });

  it("desde atrás la derecha es -x: el mismo botón cae a la izquierda", () => {
    expect(enVista(plano(carcasa, boton), "boton", foto({ derecha: "-x" }))).toEqual([-0.5, -0.5]);
  });

  it("con perspectiva (un trapecio), el centro del contorno sigue siendo el centro", () => {
    const trapecio = foto({ esquinas: { ai: [150, 50], ad: [450, 50], bd: [500, 250], bi: [100, 250] } });
    const [u, v] = enFoto([300, 150], trapecio);
    expect(u).toBeCloseTo(0);
    expect(v).toBeCloseTo(0);
  });

  it("más lejos vale 1 o 0; una pieza que el plano no tiene vale 0", () => {
    const r = posiciones(plano(carcasa, boton), [foto({ piezas: { boton: [350, 125], otra: [300, 150] } }), foto({ piezas: { boton: [100, 250] } })]);
    expect(r).toEqual([
      { foto: "frente.jpg", pieza: "boton", d: 0.35, puntos: 1 }, // apenas más de 0,35
      { foto: "frente.jpg", pieza: "otra", d: null, puntos: 0 },
      { foto: "frente.jpg", pieza: "boton", d: 2.12, puntos: 0 },
    ]);
  });

  it("espejado en x: el botón de la derecha pasa a la izquierda y el resto no cambia", () => {
    expect(enVista(espejadoEnX(plano(carcasa, boton)), "boton", foto())).toEqual([-0.5, -0.5]);
  });

  it('marco "todo": el equipo entero sin las piezas fuera del cuerpo', () => {
    const correa = pieza("correa", [0, 10, 40], [4, 1, 70]);
    const vista = foto({ marco: MARCO_TODO, derecha: "+x", abajo: "+z" });
    // Sin la correa, el equipo va de z = -5 a 5,5 (el botón sobresale medio cm): el botón queda casi en el borde.
    expect(enVista(plano(carcasa, boton, correa), "boton", vista, ["correa"])).toEqual([0.5, (5 - 0.25) / 5.25]);
    expect(enVista(plano(carcasa, boton, correa), "boton", vista)![1]).toBeLessThan(0);
  });
});

describe("certeza: lo que el plano dice haber visto, con respaldo", () => {
  it('"manual" sin página y "foto" sin URL son incoherencias; estimada o sin origen, no', () => {
    const c = certeza(
      plano(
        pieza("a", [0, 0, 0], [1, 1, 1], { origen: "manual", cita: { doc: "Manual", pagina: 12, estado: "VERIFICADO" } }),
        pieza("b", [0, 0, 0], [1, 1, 1], { origen: "manual" }),
        pieza("c", [0, 0, 0], [1, 1, 1], { origen: "foto", cita: { doc: "foto", url: "https://example.com", estado: "VERIFICADO" } }),
        pieza("d", [0, 0, 0], [1, 1, 1], { origen: "foto" }),
        pieza("e", [0, 0, 0], [1, 1, 1], { origen: "estimada" }),
        pieza("f", [0, 0, 0], [1, 1, 1]),
      ),
    );
    expect(c.origen).toEqual({ manual: 2, foto: 2, estimada: 1, plantilla: 0, sinDato: 1 });
    expect(c.incoherencias).toEqual(['b: "manual" sin página', 'd: "foto" sin URL']);
  });
});

describe("bajas contra la línea de base", () => {
  const resultado = (puntajes: Resultado["puntajes"], bytes = 1000, triangulos = 500) =>
    ({ tipo: "tv", puntajes, detalle: { rendimiento: { bytes, triangulos } } }) as Resultado;
  const base: LineaBase = { tv: { puntajes: { geometria: 80, posicion: 50, certeza: 100, evidencia: 0, rendimiento: 100 }, bytes: 1000, triangulos: 500 } };

  it("un puntaje que baja, una medición que se pierde o un GLB que engorda; mejorar no avisa", () => {
    expect(bajas(base, [resultado({ geometria: 90, posicion: 50, certeza: 100, evidencia: 10, rendimiento: 100 }, 1050)])).toEqual([]);
    expect(bajas(base, [resultado({ geometria: 79, posicion: null, certeza: 100, evidencia: 0, rendimiento: 100 }, 1200, 400)])).toEqual([
      "tv: geometria bajó de 80 a 79",
      "tv: posicion ya no se puede medir (era 50)",
      "tv: bytes creció de 1000 a 1200",
    ]);
    expect(bajas(base, [resultado({ geometria: 79, posicion: 50, certeza: 100, evidencia: 0, rendimiento: 100 })], 1)).toEqual([]);
  });
});
