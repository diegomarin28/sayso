import { describe, expect, it, vi } from "vitest";
import { planoNotebookBase, type BibliotecaPiezas } from "../../lib/planogenerator";
import { prepararEscena, prepararEscenaSegura } from "./escena";
import { bajarCalidad, bajarRendimiento, calidadInicial, dprPara, esPlana, imagenPlana, lineasVigia, RENDIMIENTO_PLENO, Vigia, type SoporteGL } from "./salud";

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

describe("lineasVigia e imagenPlana (#238: una TV de frente no es un 3D negro)", () => {
  it("filas y columnas enteras repartidas por la imagen, sin salirse del lienzo", () => {
    const t = lineasVigia(800, 600, 9);
    expect(t).toHaveLength(18);
    expect(t.filter((x) => x.alto === 1 && x.ancho === 800)).toHaveLength(9);
    expect(t.filter((x) => x.ancho === 1 && x.alto === 600)).toHaveLength(9);
    for (const x of t) {
      expect(x.x + x.ancho).toBeLessThanOrEqual(800);
      expect(x.y + x.alto).toBeLessThanOrEqual(600);
    }
  });

  /** Imagen de prueba (RGBA, y = 0 abajo como en readPixels) y su lector de tramos. */
  const imagen = (ancho: number, alto: number, pintar: (x: number, y: number) => [number, number, number, number]) => {
    const px = new Uint8Array(ancho * alto * 4);
    for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) px.set(pintar(x, y), (y * ancho + x) * 4);
    const leer = ({ x, y, ancho: w, alto: h }: { x: number; y: number; ancho: number; alto: number }) => {
      const out = new Uint8Array(w * h * 4);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.set(px.subarray(((y + j) * ancho + x + i) * 4, ((y + j) * ancho + x + i) * 4 + 4), (j * w + i) * 4);
      return out;
    };
    return { leer, esquina: px.slice(0, 4) };
  };
  const FONDO: [number, number, number, number] = [0, 0, 0, 0]; // lienzo transparente
  const VIDRIO: [number, number, number, number] = [4, 5, 7, 255]; // pantalla apagada, casi negra
  const BORDE: [number, number, number, number] = [150, 158, 168, 255]; // bisel o contorno de pieza

  /** Un equipo de frente que ocupa casi todo el lienzo: vidrio negro con un borde claro de 2 px (y un pie abajo). */
  const deFrente = (ancho: number, alto: number, margen: number, pie: boolean) =>
    imagen(ancho, alto, (x, y) => {
      const dentro = x >= margen && x < ancho - margen && y >= margen + (pie ? 40 : 0) && y < alto - margen;
      if (!dentro) return pie && y < margen + 40 && y >= margen && Math.abs(x - ancho / 2) < 30 ? BORDE : FONDO;
      const borde = x < margen + 2 || x >= ancho - margen - 2 || y < margen + (pie ? 40 : 0) + 2 || y >= alto - margen - 2;
      return borde ? BORDE : VIDRIO;
    });

  it("una TV y un monitor de frente (casi todo pantalla negra) NO son un 3D roto", () => {
    for (const [ancho, alto, margen, pie] of [
      [390, 500, 6, true], // TV con pie, ocupando casi todo
      [600, 400, 30, false], // monitor sin pie, con algo de fondo alrededor
    ] as const) {
      const { leer, esquina } = deFrente(ancho, alto, margen, pie);
      expect(imagenPlana(leer, ancho, alto, esquina)).toBe(false);
    }
  });

  it("solo el fondo, o todo negro (contexto perdido), SÍ es un 3D roto", () => {
    const vacia = imagen(390, 500, () => FONDO);
    expect(imagenPlana(vacia.leer, 390, 500, vacia.esquina)).toBe(true);
    const negra = imagen(390, 500, () => [0, 0, 0, 255]);
    expect(imagenPlana(negra.leer, 390, 500, negra.esquina)).toBe(true);
  });

  it("con la grilla de puntos de antes la TV caía toda en el vidrio negro (el bug)", () => {
    const { leer, esquina } = deFrente(390, 500, 6, true);
    // 5×5 cuadraditos de 16 px en el centro de cada celda, como el vigía viejo.
    const plano = [1, 2, 3, 4, 5].every((i) =>
      [1, 2, 3, 4, 5].every((j) => esPlana(leer({ x: Math.floor((390 * i) / 6) - 8, y: Math.floor((500 * j) / 6) - 8, ancho: 16, alto: 16 }), esquina)),
    );
    // La esquina es fondo transparente (0,0,0,0) y el vidrio (4,5,7) queda dentro del umbral: se veía "plana".
    expect(plano).toBe(true);
    expect(imagenPlana(leer, 390, 500, esquina)).toBe(false);
  });
});
