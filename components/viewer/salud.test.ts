import { describe, expect, it, vi } from "vitest";
import { planoNotebookBase, type BibliotecaPiezas } from "../../lib/planogenerator";
import { prepararEscena, prepararEscenaSegura } from "./escena";
import { bajarCalidad, calidadInicial, esNegro, Vigia, type SoporteGL } from "./salud";

const iphone: SoporteGL = { webgl2: true, colorFlotante: true, maxMuestras: 4, tactil: true };
const mac: SoporteGL = { webgl2: true, colorFlotante: true, maxMuestras: 8, tactil: false };

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

describe("esNegro", () => {
  const px = (...rgba: number[]) => new Uint8Array(rgba);
  it("todo negro (o casi) es negro; un solo píxel con color no", () => {
    expect(esNegro(px(0, 0, 0, 255, 3, 5, 2, 255))).toBe(true);
    expect(esNegro(px(0, 0, 0, 255, 0, 40, 0, 255))).toBe(false);
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
