import { readFileSync, readdirSync, statSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { beforeAll, describe, expect, it } from "vitest";
import type { PlanoDePiezas, Vec3 } from "../../shared";
import { planoAire, planoHeladera } from "../../components/viewer/ejemplos";
import {
  IndicePiezas,
  RECETA_CUERPO,
  SEPARADOR_VARIANTE,
  archivosPara,
  bibliotecaDesdeEscena,
  leerAjuste,
  modeloPara,
  palabras,
  partesAjustadas,
  type BibliotecaPiezas,
  type ModeloPieza,
} from "./biblioteca";
import { SUFIJO_MALLA, construirEscena } from "./construir";
import { RECETAS_DETALLE, recetaPara } from "./materiales";
import { planoNotebookBase } from "./plantillas/notebook";
import { TIPOS_DE_PIEZA, tiposParaPrompt } from "./tipos";

const CARPETA = "public/models/piezas/";
const indice = IndicePiezas.parse(JSON.parse(readFileSync(CARPETA + "indice.json", "utf8")));
/** Todas las familias juntas (en la app se bajan solo las que usa el plano). */
let biblioteca: BibliotecaPiezas;
const porArchivo = new Map<string, BibliotecaPiezas>();

beforeAll(async () => {
  biblioteca = new Map();
  for (const archivo of Object.values(indice.familias)) {
    const datos = readFileSync(CARPETA + archivo);
    const buffer = datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength);
    const familia = bibliotecaDesdeEscena((await new GLTFLoader().parseAsync(buffer, "")).scene);
    porArchivo.set(archivo, familia);
    for (const [nombre, modelo] of familia) biblioteca.set(nombre, modelo);
  }
});

/** Caja de todas las mallas de la pieza (principal + detalles), en el espacio de la malla principal. */
const cajaDe = (malla: THREE.Object3D) => {
  const caja = new THREE.Box3();
  malla.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.computeBoundingBox();
    caja.union(o.geometry.boundingBox!);
  });
  return caja;
};

describe("biblioteca de piezas (public/models/piezas)", () => {
  it("cada GLB pesa menos de 2 MB y no sobra ninguno fuera del índice", () => {
    const glbs = readdirSync(CARPETA).filter((f) => f.endsWith(".glb"));
    expect(glbs.sort()).toEqual(Object.values(indice.familias).sort());
    for (const f of glbs) expect(statSync(CARPETA + f).size, f).toBeLessThan(2 * 1024 * 1024);
  });

  it("el índice dice exactamente qué tipos hay en cada GLB", () => {
    for (const [archivo, familia] of porArchivo) {
      const esperados = Object.entries(indice.tipos).filter(([, t]) => indice.familias[t.familia] === archivo).map(([n]) => n);
      expect([...familia.keys()].sort(), archivo).toEqual(esperados.sort());
    }
  });

  it("baja solo las familias que usa el plano (con todas las variantes de cada tipo)", () => {
    const heladera = archivosPara(planoHeladera.piezas.map((p) => p.pieza), indice);
    expect(heladera).not.toContain("computo.glb");
    expect(heladera).toContain("carcasas.glb");
    // `ventilador` tiene variantes en movimiento; `parlante` (de notebook y de celular) está en electrónica.
    expect(archivosPara(["parlante_izquierdo"], indice)).toEqual(["electronica.glb"]);
    expect(archivosPara(["condensador_c12"], indice)).toEqual(["frio_calor.glb"]);
    expect(archivosPara(["sensor_temperatura"], indice)).toEqual([]);
  });

  it("la lista de tipos para la IA sale del índice", () => {
    const tipos = TIPOS_DE_PIEZA.map((t) => t.tipo);
    for (const t of ["compresor", "carcasa", "motor", "serpentin", "puerta", "ventilador", "placa"]) expect(tipos).toContain(t);
    expect(TIPOS_DE_PIEZA.find((t) => t.tipo === "carcasa")!.variantes.sort()).toEqual(["heladera", "lavarropas", "microondas", "split", "televisor"]);
    expect(tiposParaPrompt()).toMatch(/^ventilador: .+\(variantes: axial, tangencial\)$/m);
  });

  it("cada tipo tiene cuerpo y solo usa recetas conocidas", () => {
    expect(biblioteca.size).toBeGreaterThanOrEqual(10);
    for (const [tipo, modelo] of biblioteca) {
      const recetas = modelo.partes.map((p) => p.receta);
      expect(recetas, tipo).toContain(RECETA_CUERPO);
      for (const r of recetas) expect([RECETA_CUERPO, ...Object.keys(RECETAS_DETALLE)], `${tipo}: ${r}`).toContain(r);
    }
  });

  it("cada tipo tiene su propia receta en materiales.ts (no la genérica)", () => {
    for (const tipo of biblioteca.keys()) expect(recetaPara(tipo), tipo).not.toBe(recetaPara("pieza_sin_tipo"));
  });

  it("cubre todas las piezas de la plantilla de notebook, con las variantes de notebook", () => {
    for (const p of planoNotebookBase.piezas) {
      expect(modeloPara(p.pieza, biblioteca), p.pieza).toBeDefined();
      expect(nombreDe(modeloPara(p.pieza, biblioteca, p.dim)), p.pieza).not.toContain(SEPARADOR_VARIANTE);
    }
  });

  it("cubre las piezas de un celular y elige la variante de celular por las medidas", () => {
    for (const p of planoCelular.piezas) expect(modeloPara(p.pieza, biblioteca, p.dim), p.pieza).toBeDefined();
    const elegida = (id: string) => nombreDe(modeloPara(id, biblioteca, planoCelular.piezas.find((p) => p.pieza === id)!.dim));
    expect(elegida("bateria")).toBe("bateria@celular");
    expect(elegida("placa_madre")).toBe("placa_madre@celular");
    expect(elegida("parlante_inferior")).toBe("parlante@celular");
    expect(elegida("conector_carga")).toBe("conector@usb_c");
    expect(elegida("camara_trasera")).toBe("camara@modulo");
    expect(elegida("camara_frontal")).toBe("camara");
    expect(elegida("tapa_trasera")).toBe("tapa_trasera");
  });

  it("heladera y aire: cada pieza con tipo usa su forma y su variante; las demás, la primitiva", () => {
    const elegida = (plano: PlanoDePiezas, id: string, equipo: string) =>
      nombreDe(modeloPara(id, biblioteca, plano.piezas.find((p) => p.pieza === id)!.dim, equipo));
    const sinTipo = ["sensor_temperatura"];
    for (const plano of [planoHeladera, planoAire]) {
      for (const p of plano.piezas) expect(modeloPara(p.pieza, biblioteca) === undefined, p.pieza).toBe(sinTipo.includes(p.pieza));
    }
    expect(elegida(planoHeladera, "carcasa_heladera", "heladera")).toBe("carcasa@heladera");
    expect(elegida(planoHeladera, "ventilador_evaporador", "heladera")).toBe("ventilador@axial");
    expect(elegida(planoHeladera, "condensador", "heladera")).toBe("condensador");
    expect(elegida(planoHeladera, "placa_control", "heladera")).toBe("placa@control");
    expect(elegida(planoHeladera, "cable_alimentacion", "heladera")).toBe("cable@redondo");
    expect(elegida(planoAire, "carcasa_split", "aire acondicionado split")).toBe("carcasa@split");
    expect(elegida(planoAire, "ventilador_tangencial", "aire acondicionado split")).toBe("ventilador@tangencial");
    expect(elegida(planoHeladera, "evaporador", "heladera")).toBe("evaporador@aletas");
    expect(elegida(planoHeladera, "bandeja_verduras", "heladera")).toBe("bandeja");
    expect(elegida(planoAire, "bandeja_condensado", "aire acondicionado split")).toBe("bandeja@goteo");
    // Sin tipo de equipo, las medidas alcanzan para las carcasas.
    for (const [plano, variante] of [[planoHeladera, "carcasa@heladera"], [planoAire, "carcasa@split"]] as const) {
      const c = plano.piezas[0];
      expect(nombreDe(modeloPara(c.pieza, biblioteca, c.dim))).toBe(variante);
    }
  });

  it("piezas sueltas: evaporador, turbina, retroiluminación y bandejas eligen la forma por las medidas", () => {
    const de = (id: string, dim: [number, number, number]) => nombreDe(modeloPara(id, biblioteca, dim));
    expect(de("evaporador", [40, 30, 0.6])).toBe("evaporador"); // placa roll-bond
    expect(de("evaporador_no_frost", [40, 20, 3])).toBe("evaporador@aletas");
    expect(de("turbina", [64, 9, 9])).toBe("turbina");
    expect(de("turbina_horno", [8, 12, 12])).toBe("turbina@centrifuga");
    expect(de("retroiluminacion", [96, 56, 1])).toBe("retroiluminacion");
    expect(de("tira_led_3", [40, 1.2, 0.4])).toBe("tira_led");
    expect(de("estante_vidrio", [55, 1, 35])).toBe("estante");
    expect(de("bandeja_estante", [55, 1, 35])).toBe("bandeja@estante");
    expect(de("bandeja_goteo", [70, 3, 10])).toBe("bandeja@goteo");
  });

  it("las variantes traen del GLB para qué equipo son", () => {
    expect(biblioteca.get("bateria@celular")!.equipos).toContain("celular");
    expect(biblioteca.get("bateria")!.equipos).toContain("notebook");
    expect(biblioteca.get("conector@usb_c")!.equipos).toEqual([]); // la usan los dos
  });

  it("con el tipo de equipo de la recepción usa la versión de celular aunque las medidas digan otra cosa", () => {
    const bateria = planoNotebookBase.piezas.find((p) => p.pieza === "bateria")!;
    expect(nombreDe(modeloPara("bateria", biblioteca, bateria.dim, "Teléfono celular Motorola"))).toBe("bateria@celular");
    expect(nombreDe(modeloPara("bateria", biblioteca, bateria.dim, "lavarropas"))).toBe("bateria");
  });
});

/** Medidas típicas de un celular (cm). Solo para tests: el plano real lo arma la IA desde el manual. */
const planoCelular: PlanoDePiezas = {
  modelo: "celular de prueba",
  unidades: "cm",
  piezas: (
    [
      ["marco", [7.4, 0.8, 15.8]],
      ["pantalla", [7.1, 0.35, 15.5]],
      ["bateria", [5.6, 0.45, 8.6]],
      ["placa_madre", [6, 0.25, 11]],
      ["placa_carga", [6, 0.2, 2]],
      ["camara_trasera", [2.6, 0.7, 2.6]],
      ["camara_frontal", [0.8, 0.5, 0.8]],
      ["conector_carga", [0.9, 0.32, 0.75]],
      ["parlante_inferior", [1.8, 0.35, 1]],
      ["tapa_trasera", [7.3, 0.18, 15.7]],
    ] as const
  ).map(([pieza, dim]) => ({ pieza, forma: "caja", dim: [...dim], pos: [0, 0, 0], pivote: [0, 0, 0] })),
};

const nombreDe = (modelo?: ModeloPieza) => [...biblioteca].find(([, m]) => m === modelo)?.[0];

describe("modeloPara", () => {
  it("elige el prefijo más largo y no inventa", () => {
    const b: BibliotecaPiezas = new Map([
      ["tapa", { partes: [], caja: new THREE.Box3() }],
      ["tapa_inferior", { partes: [], caja: new THREE.Box3() }],
    ]);
    expect(modeloPara("tapa_inferior_2", b)).toBe(b.get("tapa_inferior"));
    expect(modeloPara("tapa_bisagra", b)).toBe(b.get("tapa"));
    expect(modeloPara("flujo_magnetico", b)).toBeUndefined();
    expect(modeloPara("tapa", undefined)).toBeUndefined();
  });

  it("entre variantes elige la que menos se deforma; sin medidas, la base", () => {
    const de = (x: number, y: number, z: number) => ({ partes: [], caja: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(x, y, z)) });
    const b: BibliotecaPiezas = new Map([
      ["bateria", de(26, 0.8, 7)],
      ["bateria@celular", de(6, 0.5, 9)],
    ]);
    expect(modeloPara("bateria", b, [25, 1, 8])).toBe(b.get("bateria"));
    expect(modeloPara("bateria_principal", b, [5, 0.4, 8])).toBe(b.get("bateria@celular"));
    expect(modeloPara("bateria", b, [9, 0.5, 6])).toBe(b.get("bateria@celular")); // girada
    expect(modeloPara("bateria", b)).toBe(b.get("bateria"));
  });

  it("el tipo de equipo descarta las variantes de otro equipo; las que no dicen equipo sirven para todos", () => {
    const de = (x: number, y: number, z: number, equipos: string[] = []) => ({
      partes: [],
      caja: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(x, y, z)),
      equipos,
    });
    const b: BibliotecaPiezas = new Map([
      ["bateria", de(26, 0.8, 7, ["notebook", "laptop"])],
      ["bateria@celular", de(6, 0.5, 9, ["celular", "telefono"])],
      ["conector", de(1.3, 0.6, 1.5, ["notebook"])],
      ["conector@usb_c", de(0.9, 0.3, 0.75)],
    ]);
    expect(modeloPara("bateria", b, [25, 1, 8], "celulares Samsung")).toBe(b.get("bateria@celular"));
    expect(modeloPara("bateria", b, undefined, "un teléfono")).toBe(b.get("bateria@celular"));
    expect(modeloPara("bateria", b, [5, 0.4, 8], "Notebook Lenovo")).toBe(b.get("bateria"));
    expect(modeloPara("bateria", b, [5, 0.4, 8], "lavarropas")).toBe(b.get("bateria@celular")); // no nombra a ninguna: decide la medida
    expect(modeloPara("conector_carga", b, [1.3, 0.6, 1.5], "celular")).toBe(b.get("conector@usb_c"));
    expect(modeloPara("conector_carga", b, [1.3, 0.6, 1.5], "MacBook Pro")).toBe(b.get("conector")); // equipo desconocido: medidas
  });

  it("palabras: sin tildes ni mayúsculas", () => {
    expect(palabras("Teléfono MÓVIL, iPhone-13")).toEqual(["telefono", "movil", "iphone", "13"]);
  });
});

describe("reglas de ajuste (la forma no se deforma)", () => {
  const tamDe = (partes: ReturnType<typeof partesAjustadas>, receta?: string) => {
    const caja = new THREE.Box3();
    for (const p of partes) {
      if (receta && p.receta !== receta) continue;
      p.geometria.computeBoundingBox();
      caja.union(p.geometria.boundingBox!);
    }
    return caja.getSize(new THREE.Vector3()).toArray();
  };

  it("lee la regla del GLB; lo que no entiende es libre", () => {
    expect(leerAjuste("redondo:xz")).toEqual({ modo: "redondo", ejes: [0, 2] });
    expect(leerAjuste("tramo:x:redondo")).toEqual({ modo: "tramo", eje: 0, seccionRedonda: true });
    expect(leerAjuste("proporcional")).toEqual({ modo: "proporcional" });
    for (const raro of [undefined, 3, "", "redondo:xx", "tramo:w", "estirar"]) expect(leerAjuste(raro)).toEqual({ modo: "libre" });
  });

  it("cada tipo trae una regla válida, y lo que se declara redondo es redondo en el modelo", () => {
    for (const [nombre, t] of Object.entries(indice.tipos)) {
      const ajuste = leerAjuste(t.ajuste);
      if (t.ajuste !== "libre") expect(ajuste.modo, nombre).not.toBe("libre");
      expect(biblioteca.get(nombre)?.ajuste, nombre).toEqual(ajuste); // el GLB dice lo mismo que el índice
      if (ajuste.modo === "redondo") {
        const tam = biblioteca.get(nombre)!.caja.getSize(new THREE.Vector3()).toArray();
        const [a, b] = ajuste.ejes;
        expect(Math.max(tam[a], tam[b]) / Math.min(tam[a], tam[b]), nombre).toBeLessThan(1.15);
      }
    }
  });

  it("ventilador en un hueco de 6×9: sigue redondo, entra en el hueco y el alto es el del plano", () => {
    const [x, y, z] = tamDe(partesAjustadas(biblioteca.get("ventilador")!, [6, 0.6, 9]));
    expect(x / z).toBeCloseTo(6.36 / 6, 1); // misma proporción que el modelo
    expect(x).toBeLessThanOrEqual(6 + 1e-6);
    expect(z).toBeLessThanOrEqual(9 + 1e-6);
    expect(y).toBeCloseTo(0.6, 5);
  });

  it("tornillo y lente: la cabeza y la cámara no se estiran", () => {
    const [tx, , tz] = tamDe(partesAjustadas(biblioteca.get("tornillo")!, [0.9, 0.3, 2.2]));
    expect(tx).toBeCloseTo(tz, 5);
    const camara = biblioteca.get("camara")!;
    const original = camara.caja.getSize(new THREE.Vector3()).toArray();
    const ajustada = tamDe(partesAjustadas(camara, [0.9, 0.6, 2.6]));
    ajustada.forEach((v, i) => expect(v / ajustada[0], `eje ${i}`).toBeCloseTo(original[i] / original[0], 5));
  });

  it("cable largo: el medio se alarga y los conectores de las puntas quedan del mismo tamaño", () => {
    const cable = biblioteca.get("cable")!;
    const largo = tamDe(partesAjustadas(cable, [18, 0.16, 1]));
    expect(largo[0]).toBeCloseTo(18, 3);
    const conectoresAntes = tamDe(cable.partes.map((p) => ({ ...p })), "plastico");
    const ancho = (partes: ReturnType<typeof partesAjustadas>) => {
      // Ancho (en x) del conector de la punta derecha: vértices de "plastico" con x > 0.
      const xs = partes.filter((p) => p.receta === "plastico").flatMap((p) => {
        const pos = p.geometria.getAttribute("position");
        return Array.from({ length: pos.count }, (_, i) => pos.getX(i));
      }).filter((x) => x > 0);
      return Math.max(...xs) - Math.min(...xs);
    };
    const normal = partesAjustadas(cable, cable.caja.getSize(new THREE.Vector3()).toArray() as Vec3);
    expect(ancho(partesAjustadas(cable, [18, 0.16, 1]))).toBeCloseTo(ancho(normal), 3);
    expect(conectoresAntes[0]).toBeGreaterThan(0);
  });

  it("tira de LED de 80 cm: la barra se alarga y las lentes se mueven enteras (siguen redondas)", () => {
    const tira = biblioteca.get("tira_led")!;
    // Ancho (en x) de la lente más cercana al centro: en el medio de la tira, que es lo que se alarga.
    const lenteDelMedio = (partes: ReturnType<typeof partesAjustadas>) => {
      const xs = partes.filter((p) => p.receta === "etiqueta").flatMap((p) => {
        const pos = p.geometria.getAttribute("position");
        return Array.from({ length: pos.count }, (_, i) => pos.getX(i));
      });
      const cerca = xs.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a));
      const deLaLente = xs.filter((x) => Math.abs(x - cerca) < 2.4); // las lentes están a 5 cm o más
      return Math.max(...deLaLente) - Math.min(...deLaLente);
    };
    const normal = partesAjustadas(tira, tira.caja.getSize(new THREE.Vector3()).toArray() as Vec3);
    const larga = partesAjustadas(tira, [80, 1.2, 0.9]);
    expect(tamDe(larga)[0]).toBeCloseTo(80, 3);
    expect(lenteDelMedio(larga)).toBeCloseTo(lenteDelMedio(normal), 3);
  });

  it("las cajas libres se siguen estirando a la medida justa", () => {
    tamDe(partesAjustadas(biblioteca.get("bateria")!, [20, 0.6, 9])).forEach((v, i) => expect(v).toBeCloseTo([20, 0.6, 9][i], 3));
  });
});

describe("partesAjustadas", () => {
  const caja = (x: number, y: number, z: number) => ({
    partes: [{ receta: RECETA_CUERPO, geometria: new THREE.BoxGeometry(x, y, z).translate(5, 5, 5) }],
    caja: new THREE.Box3(new THREE.Vector3(5 - x / 2, 5 - y / 2, 5 - z / 2), new THREE.Vector3(5 + x / 2, 5 + y / 2, 5 + z / 2)),
  });
  const medida = (g: THREE.BufferGeometry) => {
    g.computeBoundingBox();
    return { tam: g.boundingBox!.getSize(new THREE.Vector3()), centro: g.boundingBox!.getCenter(new THREE.Vector3()) };
  };

  it("centra y estira al `dim` del plano", () => {
    const [p] = partesAjustadas(caja(2, 1, 1), [8, 0.5, 3]);
    const { tam, centro } = medida(p.geometria);
    expect(tam.toArray().map((v) => +v.toFixed(5))).toEqual([8, 0.5, 3]);
    expect(centro.length()).toBeCloseTo(0, 5);
  });

  it("la para si el plano la pone de frente (ej. un ventilador acostado en el modelo)", () => {
    const [p] = partesAjustadas(caja(12, 3, 12), [12, 12, 3]);
    const { tam } = medida(p.geometria);
    expect(tam.toArray().map((v) => +v.toFixed(5))).toEqual([12, 12, 3]);
    // Se giró, no se estiró: el lado de 3 del modelo es el de 3 del plano.
    const pos = p.geometria.getAttribute("position");
    expect(new Set(Array.from({ length: pos.count }, (_, i) => +pos.getZ(i).toFixed(5)))).toEqual(new Set([-1.5, 1.5]));
  });

  it("no la gira por una diferencia chica", () => {
    const [p] = partesAjustadas(caja(10, 2, 10), [10, 2.3, 10]);
    expect(medida(p.geometria).tam.toArray().map((v) => +v.toFixed(5))).toEqual([10, 2.3, 10]);
  });

  it("gira 90° si el plano la pone al revés, para no deformarla", () => {
    const modelo = caja(4, 1, 1);
    // El lado largo del modelo (x) tiene que terminar en el lado largo del plano (z).
    const [p] = partesAjustadas(modelo, [2, 1, 8]);
    const { tam } = medida(p.geometria);
    expect(tam.toArray().map((v) => +v.toFixed(5))).toEqual([2, 1, 8]);
    const pos = p.geometria.getAttribute("position");
    const zs = Array.from({ length: pos.count }, (_, i) => pos.getZ(i));
    expect(Math.max(...zs)).toBeCloseTo(4, 5);
  });
});

describe("construirEscena con biblioteca", () => {
  it.each([
    ["notebook", planoNotebookBase],
    ["celular", planoCelular],
    ["heladera", planoHeladera],
    ["aire", planoAire],
  ])("%s: cada pieza entra en su `dim` (justo si es libre) y queda centrada en `pos`, con nombres y materiales propios", (_, plano) => {
    const { nodos } = construirEscena(plano, { biblioteca });
    const materiales = new Set<THREE.Material>();
    for (const p of plano.piezas) {
      const malla = nodos.get(p.pieza)!.getObjectByName(p.pieza + SUFIJO_MALLA) as THREE.Mesh;
      const caja = cajaDe(malla);
      const tam = caja.getSize(new THREE.Vector3()).toArray();
      const libre = (modeloPara(p.pieza, biblioteca, p.dim)?.ajuste?.modo ?? "libre") === "libre";
      if (libre) tam.forEach((v, i) => expect(v, p.pieza).toBeCloseTo(p.dim[i], 3));
      else {
        tam.forEach((v, i) => expect(v, p.pieza).toBeLessThanOrEqual(p.dim[i] + 1e-3));
        expect(Math.max(...tam.map((v, i) => v / p.dim[i])), p.pieza).toBeCloseTo(1, 3); // llena al menos un eje
      }
      expect(caja.getCenter(new THREE.Vector3()).length(), p.pieza).toBeCloseTo(0, 3);
      if (modeloPara(p.pieza, biblioteca)) expect(malla.geometry.type, p.pieza).toBe("BufferGeometry"); // del GLB, no una primitiva
      malla.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        expect(o.name.startsWith(p.pieza + SUFIJO_MALLA)).toBe(true);
        expect(materiales.has(o.material as THREE.Material)).toBe(false);
        materiales.add(o.material as THREE.Material);
      });
    }
  });

  it("una pieza sin tipo en la biblioteca usa la primitiva de siempre", () => {
    const plano: PlanoDePiezas = {
      modelo: "prueba",
      unidades: "cm",
      piezas: [
        { pieza: "sensor_temperatura", forma: "cilindro", dim: [1, 2, 1], pos: [0, 0, 0], pivote: [0, 0, 0] },
        { pieza: "vibrador", forma: "cilindro", dim: [0.4, 0.4, 1], pos: [0, 0, 0], pivote: [0, 0, 0] },
      ],
    };
    const { nodos } = construirEscena(plano, { biblioteca });
    for (const id of ["sensor_temperatura", "vibrador"]) {
      expect((nodos.get(id)!.children[0] as THREE.Mesh).geometry, id).toBeInstanceOf(THREE.CylinderGeometry);
    }
  });
});
