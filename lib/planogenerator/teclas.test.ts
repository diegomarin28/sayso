import { describe, expect, it } from "vitest";
import { fichaEjemplo, PlanoDePiezas, type KnowledgePack, type PiezaPlano, type Vec3 } from "../../shared";
import type { LlamarIA } from "../ia/claude";
import { obtenerPlano } from "./obtener";
import { teclaDe, ubicarTeclas } from "./teclas";

/**
 * #232: si el plano trae teclado, la tecla va en su lugar del teclado (por TIPO, nunca por modelo). Cada caso
 * con dos variantes que no son la de la demo, con otras medidas y otras teclas.
 */

const pack = (modelo: string, ids: string[]): KnowledgePack => ({
  modelo,
  clase: "otro",
  verificado: false,
  fuentes: [{ doc: "guía pública" }],
  piezas: ids.map((id) => ({ id, nombre: id.replace(/_/g, " "), descripcion: "", ubicacion: "" })),
  pasos: [],
  advertencias: [],
  repuestos: [],
});

const planoViejo = (W: number, D: number, piezas: Array<[string, Vec3, Vec3]>): PlanoDePiezas => ({
  modelo: "guardado",
  unidades: "cm",
  medidas: { ancho: "estimada", prof: "estimada" },
  piezas: [
    { pieza: "base", forma: "caja", dim: [W, 1.2, D], pos: [0, 0, 0], pivote: [0, 0, 0], origen: "estimada" },
    ...piezas.map(([pieza, dim, pos]): PiezaPlano => ({ pieza, forma: "caja", dim, pos, pivote: [0, 0, 0], padre: "base", origen: "estimada" })),
  ],
});

async function leer(guardado: PlanoDePiezas, kp: KnowledgePack, tipoEquipo: string) {
  const cache = { get: async () => ({ plano: guardado, avisos: [], manualUrl: null, piezasPedidas: kp.piezas.map((p) => p.id) }), set: async () => {} };
  const ficha = { ...fichaEjemplo, modelo: { ...fichaEjemplo.modelo, valor: kp.modelo } };
  const sinIA: LlamarIA = async () => {
    throw new Error("no debería llamar a la IA");
  };
  const r = await obtenerPlano({ casoId: "c", knowledgePack: kp, ficha, tipoEquipo }, { cache, llamar: sinIA });
  expect(() => PlanoDePiezas.parse(r.plano)).not.toThrow();
  return r.plano;
}

const pieza = (p: PlanoDePiezas, id: string) => p.piezas.find((x) => x.pieza === id)!;
const dentro = (t: PiezaPlano, k: PiezaPlano, eje: number) => Math.abs(t.pos[eje] - k.pos[eje]) + t.dim[eje] / 2 <= k.dim[eje] / 2 + 1e-6;

describe("teclaDe: la fila y la columna de un QWERTY genérico", () => {
  it("letras, números y teclas con nombre; el mecanismo va debajo", () => {
    expect(teclaDe("tecla_p")).toMatchObject({ fila: 2, debajo: false });
    expect(teclaDe("tecla_de_la_q")).toMatchObject({ fila: 2 });
    expect(teclaDe("mecanismo_tijera_p")).toMatchObject({ fila: 2, debajo: true });
    expect(teclaDe("tecla_barra_espaciadora")).toMatchObject({ fila: 5, largo: 6 });
    expect(teclaDe("tecla_7")).toMatchObject({ fila: 1 });
    expect(teclaDe("teclado_notebook")).toBeUndefined();
    expect(teclaDe("tecla")).toBeUndefined();
    expect(teclaDe("tecla_turbo")).toBeUndefined();
  });
});

describe("notebook sin ventilador, dada vuelta (MacBook Air 15 y 13): la tecla sale del teclado, no de la IA", () => {
  it.each([
    ["MacBook Air 15 M3", 34, 23.8, "p", "q"],
    ["MacBook Air 13 M2", 30.4, 21.5, "o", "z"],
  ])("%s, leído de la caché", async (modelo, W, D, derecha, izquierda) => {
    const ids = ["teclado_notebook", `tecla_${derecha}`, `mecanismo_tijera_${derecha}`, `tecla_${izquierda}`, "trackpad"];
    // Como la estimó la IA: con +y «arriba del teclado», o sea adentro del cuerpo en la plantilla dada vuelta.
    const viejo = planoViejo(W, D, [
      ["teclado_notebook", [W * 0.9, 0.3, D * 0.45], [0, 0.3, -D * 0.2]],
      [`tecla_${derecha}`, [1.5, 0.2, 1.5], [3, 0.54, -2]],
      [`mecanismo_tijera_${derecha}`, [1.4, 0.1, 1.4], [3, 0.5, -2]],
    ]);
    const plano = await leer(viejo, pack(modelo, ids), "notebook");
    const teclado = pieza(plano, "teclado_notebook");
    const d = pieza(plano, `tecla_${derecha}`);
    const i = pieza(plano, `tecla_${izquierda}`);
    const tijera = pieza(plano, `mecanismo_tijera_${derecha}`);
    const trackpad = pieza(plano, "trackpad");

    for (const t of [d, i, tijera]) {
      expect(t.origen).toBe("plantilla");
      expect(t.padre).toBe("teclado_notebook");
      expect(dentro(t, teclado, 0) && dentro(t, teclado, 2)).toBe(true);
    }
    // La cara del teclado mira hacia abajo (la tapa inferior está arriba): el capuchón sobresale por abajo
    // y el mecanismo queda justo encima, dentro del teclado.
    expect(d.pos[1]).toBeLessThan(teclado.pos[1] - teclado.dim[1] / 2);
    expect(tijera.pos[1]).toBeGreaterThan(d.pos[1]);
    expect(tijera.pos[1]).toBeLessThan(teclado.pos[1]);
    // Dada vuelta, la derecha de quien escribe es −x.
    expect(d.pos[0]).toBeLessThan(i.pos[0]);
    // La tecla queda más lejos de quien escribe (el trackpad) que el centro del teclado.
    expect(Math.sign(d.pos[2] - teclado.pos[2])).toBe(-Math.sign(trackpad.pos[2] - teclado.pos[2]));
  });
});

describe("teclado externo (Logitech K120, Redragon K552): las teclas arriba, con la derecha en +x", () => {
  it.each([
    ["Logitech K120", 45, 15.5],
    ["Redragon K552", 35.4, 12.3],
  ])("%s", (modelo, W, D) => {
    const plano: PlanoDePiezas = {
      modelo,
      unidades: "cm",
      piezas: [
        { pieza: "teclado", forma: "caja", dim: [W, 2.4, D], pos: [0, 1.2, 0], pivote: [0, 0, 0], origen: "plantilla" },
        { pieza: "tecla_enter", forma: "caja", dim: [1, 1, 1], pos: [0, 0, 0], pivote: [0, 0, 0], padre: "teclado", origen: "estimada" },
      ],
    };
    const { plano: r } = ubicarTeclas(plano, ["tecla_enter", "tecla_a", "tecla_espacio"]);
    const enter = pieza(r, "tecla_enter");
    const a = pieza(r, "tecla_a");
    const espacio = pieza(r, "tecla_espacio");
    expect(enter.pos[1]).toBeGreaterThan(2.4);
    expect(enter.pos[0]).toBeGreaterThan(a.pos[0]);
    // Quien escribe está en +z: la barra espaciadora, la fila más cercana.
    expect(espacio.pos[2]).toBeGreaterThan(a.pos[2]);
    expect(espacio.dim[0]).toBeGreaterThan(5 * a.dim[0]);
  });
});

it("sin teclado en el plano, las teclas no se tocan", () => {
  const plano = planoViejo(30, 20, [["tecla_p", [1, 0.2, 1], [3, 0.5, -2]]]);
  expect(ubicarTeclas(plano, ["tecla_p"]).plano).toBe(plano);
});
