import { describe, expect, it, vi } from "vitest";
import { planoNotebookBase, type BibliotecaPiezas } from "../../lib/planogenerator";
import { prepararEscena, prepararEscenaSegura } from "./escena";
import { bajarCalidad, bajarRendimiento, calidadInicial, dprPara, esPlana, puntosVigia, RENDIMIENTO_PLENO, Vigia, type SoporteGL } from "./salud";

const iphone: SoporteGL = { webgl2: true, colorFlotante: true, maxMuestras: 4, tactil: true };
const mac: SoporteGL = { webgl2: true, colorFlotante: true, maxMuestras: 8, tactil: false };

describe("bajarRendimiento (si no llega a 30 fps)", () => {
  it("primero apaga el bloom; si sigue lento, dibuja a densidad 1", () => {
    const uno = bajarRendimiento(RENDIMIENTO_PLENO, true);
    expect(uno).toEqual({ sinBloom: true, dprBajo: false });
    expect(dprPara(uno)).toEqual([1, 2]);
    const dos = bajarRendimiento(uno, false);
    expect(dos).toEqual({ sinBloom: true, dprBajo: true });
    expect(dprPara(dos)).toBe(1);
  });

  it("con el bloom ya apagado (equipo sin buffers flotantes o efectos en 'no') baja directo la densidad", () => {
    expect(dprPara(bajarRendimiento(RENDIMIENTO_PLENO, false))).toBe(1);
  });
});

describe("calidadInicial", () => {
  it("en la compu: efectos, multisampling (hasta 4) y luz de entorno", () => {
    expect(calidadInicial(mac)).toEqual({ efectos: true, multisampling: 4, entorno: true });
  });

  it("en el celular: efectos sin multisampling (en iOS se come la memoria del lienzo)", () => {
    expect(calidadInicial(iphone)).toEqual({ efectos: true, multisampling: 0, entorno: true });
  });

  it("sin buffers de color flotante: ni bloom ni luz de entorno", () => {
    expect(calidadInicial({ ...iphone, colorFlotante: false })).toEqual({ efectos: false, multisampling: 0, entorno: false });
  });
});

describe("bajarCalidad", () => {
  it("apaga primero los efectos, después la luz de entorno, y después no queda nada", () => {
    const sinEfectos = bajarCalidad(calidadInicial(mac));
    expect(sinEfectos).toEqual({ efectos: false, multisampling: 4, entorno: true });
    const sinEntorno = bajarCalidad(sinEfectos!);
    expect(sinEntorno).toEqual({ efectos: false, multisampling: 4, entorno: false });
    expect(bajarCalidad(sinEntorno!)).toBeNull();
  });
});

describe("esPlana (el vigía compara con el color de una esquina)", () => {
  const px = (...rgba: number[]) => new Uint8Array(rgba);
  it("todo negro (o casi) es plana; un solo píxel con color no", () => {
    expect(esPlana(px(0, 0, 0, 255, 3, 5, 2, 255), [0, 0, 0])).toBe(true);
    expect(esPlana(px(0, 0, 0, 255, 0, 40, 0, 255), [0, 0, 0])).toBe(false);
  });

  it("con fondo de color (--escena): solo el fondo es plana, una pieza encima no", () => {
    const fondo = [28, 31, 36];
    expect(esPlana(px(28, 31, 36, 255, 30, 29, 38, 255), fondo)).toBe(true);
    expect(esPlana(px(28, 31, 36, 255, 200, 205, 210, 255), fondo)).toBe(false);
    // Negro sobre fondo de color: no es "plana" contra el fondo; la esquina también sale negra y ahí sí.
    expect(esPlana(px(0, 0, 0, 255), fondo)).toBe(false);
    expect(esPlana(px(0, 0, 0, 255), [0, 0, 0, 255])).toBe(true);
  });
});

describe("Vigia", () => {
  const correr = (v: Vigia, cuadros: boolean[]) => {
    const res: string[] = [];
    for (const negro of cuadros) if (v.siguiente()) res.push(v.registrar(negro));
    return res;
  };

  it("avisa con N cuadros negros seguidos dentro de la ventana", () => {
    const v = new Vigia({ desde: 3, hasta: 20, seguidos: 4 });
    expect(correr(v, Array(10).fill(true))).toContain("negro");
  });

  it("no avisa si la imagen aparece, ni antes de la ventana (la cámara se está acomodando)", () => {
    const v = new Vigia({ desde: 3, hasta: 20, seguidos: 4 });
    const cuadros = [true, true, true, true, true, false, true, true, true, false, true];
    expect(correr(v, cuadros)).not.toContain("negro");
  });

  it("termina después de la ventana", () => {
    const v = new Vigia({ desde: 1, hasta: 3, seguidos: 10 });
    correr(v, [false, false, false, false]);
    expect(v.terminado).toBe(true);
  });
});

describe("prepararEscenaSegura", () => {
  it("si las piezas de Blender rompen la escena, la arma con primitivas y avisa", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    class BibliotecaRota extends Map {
      keys(): never {
        throw new Error("GLB roto");
      }
    }
    const rota = new BibliotecaRota() as unknown as BibliotecaPiezas;
    expect(() => prepararEscena(planoNotebookBase, rota)).toThrow("GLB roto");
    const escena = prepararEscenaSegura(planoNotebookBase, rota);
    expect([...escena.nodos.keys()]).toEqual([...prepararEscena(planoNotebookBase).nodos.keys()]);
    expect(escena.avisos[0]).toMatch(/formas simples/);
  });

  it("sin biblioteca (el GLB no cargó) usa primitivas sin aviso extra", () => {
    const escena = prepararEscenaSegura(planoNotebookBase, null);
    expect(escena.nodos.size).toBe(prepararEscena(planoNotebookBase).nodos.size);
    expect(escena.avisos.some((a) => /formas simples/.test(a))).toBe(false);
  });
});

describe("puntosVigia", () => {
  it("reparte una grilla de 3×3 por la imagen (no solo el centro) y nunca se sale del lienzo", () => {
    const puntos = puntosVigia(800, 600, 24);
    expect(puntos).toHaveLength(9);
    const xs = new Set(puntos.map(([x]) => x));
    const ys = new Set(puntos.map(([, y]) => y));
    expect(xs.size).toBe(3);
    expect(ys.size).toBe(3);
    for (const [x, y] of puntos) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + 24).toBeLessThanOrEqual(800);
      expect(y + 24).toBeLessThanOrEqual(600);
    }
    expect(puntos).toContainEqual([388, 288]); // el centro sigue estando
    expect(puntosVigia(800, 600, 16, 5)).toHaveLength(25);
  });

  it("en un lienzo más chico que el cuadrado, mira desde la esquina", () => {
    for (const [x, y] of puntosVigia(10, 10, 24)) expect([x, y]).toEqual([0, 0]);
  });
});
