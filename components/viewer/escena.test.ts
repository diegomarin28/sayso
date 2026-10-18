import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { planoNotebookBase } from "../../lib/planogenerator";
import { planoCelular, planoHeladera, planoTablet, planoTelevisor } from "../../lib/planogenerator/plantillas/equipos";
import { COLOR_ACTIVO, OPACIDAD_GRANDE_ACTIVA, animar, colocarEtiqueta, encuadre, ladoEtiqueta, prepararEscena, separarEtiquetas, suavizar, usarColorActivo, type CambioLado, type LadoEtiqueta } from "./escena";
import { aplicarAccion, estadoInicial, type EstadoEscena } from "./reproductor";
import { conDesarme } from "./guia/desarme";

const ctx = { casoId: "t" };
const preparar = () => {
  const escena = prepararEscena(planoNotebookBase);
  return { escena, estado: estadoInicial(escena.nodos.keys()) };
};
const material = (escena: ReturnType<typeof prepararEscena>, id: string) =>
  escena.nodos.get(id)!.mallas[0].malla.material;
const con = (estado: EstadoEscena, ...acciones: Parameters<typeof aplicarAccion>[1][]) =>
  acciones.reduce((e, a) => aplicarAccion(e, a, ctx).estado, estado);

describe("escena: modo rayos X", () => {
  it("la pieza activa queda sólida y del color de resaltado; las demás grises translúcidas; sus hijas quedan normales", () => {
    const { escena, estado } = preparar();
    const e = con(estado, { t: "resaltar", pieza: "ventilador" });
    animar(escena, e, 0);
    animar(escena, e, 5000);
    const activo = material(escena, "ventilador");
    expect(activo.color.getHexString()).toBe(new THREE.Color(COLOR_ACTIVO).getHexString());
    expect(activo.opacity).toBe(1);
    expect(activo.emissiveIntensity).toBeGreaterThan(0);
    expect(material(escena, "placa_madre").opacity).toBeCloseTo(0.1);
    expect(material(escena, "placa_madre").transparent).toBe(true);
    expect(material(escena, "tornillos_ventilador").opacity).toBe(1);
  });

  it("el resaltado toma el color del tema (tema.ts: --dato de la app), en la pieza y en su brillo", () => {
    usarColorActivo("#4fd1e0");
    try {
      const { escena, estado } = preparar();
      const e = con(estado, { t: "resaltar", pieza: "ventilador" });
      animar(escena, e, 0);
      animar(escena, e, 5000);
      const cian = new THREE.Color("#4fd1e0").getHexString();
      expect(material(escena, "ventilador").color.getHexString()).toBe(cian);
      expect(material(escena, "ventilador").emissive.getHexString()).toBe(cian);
    } finally {
      usarColorActivo(COLOR_ACTIVO);
    }
  });

  it("un resaltado claro (cian) brilla igual que el naranja, no más: el bloom no lo lava a blanco", () => {
    const brillo = (color: string) => {
      usarColorActivo(color);
      try {
        const { escena, estado } = preparar();
        const e = con(estado, { t: "resaltar", pieza: "ventilador" });
        animar(escena, e, 0);
        animar(escena, e, 5000);
        const m = material(escena, "ventilador");
        return { intensidad: m.emissiveIntensity, visto: m.emissiveIntensity * (0.2126 * m.emissive.r + 0.7152 * m.emissive.g + 0.0722 * m.emissive.b) };
      } finally {
        usarColorActivo(COLOR_ACTIVO);
      }
    };
    const naranja = brillo(COLOR_ACTIVO);
    const cian = brillo("#4fd1e0");
    expect(cian.visto).toBeCloseTo(naranja.visto, 5);
    expect(cian.intensidad).toBeLessThan(naranja.intensidad * 0.6);
    // Un color más oscuro que el naranja no brilla de más.
    expect(brillo("#7a2a00").intensidad).toBeCloseTo(naranja.intensidad, 5);
  });

  it("las piezas genéricas (el pack no las nombra) van en gris; las demás, con su receta", () => {
    const conReceta = prepararEscena(planoNotebookBase);
    const escena = prepararEscena(planoNotebookBase, undefined, undefined, new Set(["ram"]));
    const gris = new THREE.Color("#8d96a1").getHexString();
    expect(material(escena, "ram").color.getHexString()).toBe(gris);
    expect(material(conReceta, "ram").color.getHexString()).not.toBe(gris);
    expect(material(escena, "ssd").color.getHexString()).toBe(material(conReceta, "ssd").color.getHexString());
    // Resaltada, igual toma el color de resaltado (la guía puede nombrarla).
    const e = con(estadoInicial(escena.nodos.keys()), { t: "resaltar", pieza: "ram" });
    animar(escena, e, 0);
    animar(escena, e, 5000);
    expect(material(escena, "ram").color.getHexString()).toBe(new THREE.Color(COLOR_ACTIVO).getHexString());
  });

  it("sin piezas resaltadas todo vuelve a su material original", () => {
    const { escena, estado } = preparar();
    const original = material(escena, "placa_madre").color.getHexString();
    animar(escena, con(estado, { t: "resaltar", pieza: "ssd" }), 0);
    animar(escena, con(estado, { t: "resaltar", pieza: "ssd" }), 5000);
    animar(escena, estado, 5000);
    animar(escena, estado, 10000);
    expect(material(escena, "placa_madre").color.getHexString()).toBe(original);
    expect(material(escena, "placa_madre").opacity).toBe(1);
  });

  it("ocultar funde la pieza hasta hacerla invisible", () => {
    const { escena, estado } = preparar();
    const e = con(estado, { t: "ocultar", pieza: "bateria" });
    animar(escena, e, 0);
    animar(escena, e, 5000);
    expect(escena.nodos.get("bateria")!.mallas[0].malla.visible).toBe(false);
  });
});

describe("escena: transiciones", () => {
  it("el despiece es escalonado: la placa arranca antes que las piezas que van encima", () => {
    const { escena, estado } = preparar();
    animar(escena, estado, 0);
    const e = con(estado, { t: "despiezar", cantidad: 1 });
    const y = (id: string) => escena.nodos.get(id)!.nodo.position.y - escena.nodos.get(id)!.reposo.y;
    animar(escena, e, 1000);
    animar(escena, e, 1300);
    expect(y("placa_madre")).toBeGreaterThan(0);
    expect(y("tornillos_ventilador")).toBe(0);
    animar(escena, e, 10000);
    expect(y("tornillos_ventilador")).toBeGreaterThan(0);
  });

  it("los movimientos tienen easing: a mitad de tiempo no están ni al principio ni al final", () => {
    const { escena, estado } = preparar();
    animar(escena, estado, 0);
    const e = con(estado, { t: "desplazar", pieza: "ventilador", vec: [0, 4, 0] });
    const n = escena.nodos.get("ventilador")!;
    animar(escena, e, 1000);
    animar(escena, e, 1375);
    const mitad = n.nodo.position.y - n.reposo.y;
    expect(mitad).toBeGreaterThan(0.5);
    expect(mitad).toBeLessThan(3.5);
    animar(escena, e, 3000);
    expect(n.nodo.position.y - n.reposo.y).toBeCloseTo(4);
  });
});

describe("escena: encuadre en celular", () => {
  const escena = prepararEscena(planoNotebookBase);
  /** Proyecta `p` con la cámara encuadrada y el focal offset aplicado como camera-controls (positivo = la vista baja, los objetos suben). */
  const proyectar = (camara: THREE.PerspectiveCamera, e: ReturnType<typeof encuadre>, p: THREE.Vector3) => {
    camara.position.copy(e.posicion);
    camara.lookAt(e.objetivo);
    camara.position.addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(camara.quaternion), -e.focal);
    camara.updateMatrixWorld();
    return p.clone().project(camara);
  };

  it("con la frase arriba, la pieza queda en el centro de lo que queda libre", () => {
    const tam = { width: 393, height: 515 };
    const camara = new THREE.PerspectiveCamera(35, tam.width / tam.height);
    const e = encuadre(escena, "ventilador", 1.4, camara, tam, 0, 120);
    const ndc = proyectar(camara, e, e.objetivo);
    const pxY = ((1 - ndc.y) / 2) * tam.height;
    expect(pxY).toBeCloseTo(120 + (tam.height - 120) / 2, 0);
    expect(ndc.x).toBeCloseTo(0, 5);
  });

  it("sin frase no corre la vista; en vertical el ancho también entra", () => {
    const tam = { width: 320, height: 568 };
    const camara = new THREE.PerspectiveCamera(35, tam.width / tam.height);
    const e = encuadre(escena, "general", 1, camara, tam);
    expect(Math.abs(e.focal)).toBe(0);
    const derecha = new THREE.Vector3(1, 0, 0);
    const caja = new THREE.Box3().setFromObject(escena.raiz);
    const radio = caja.getBoundingSphere(new THREE.Sphere()).radius * 0.8;
    const borde = proyectar(camara, e, e.objetivo.clone().addScaledVector(derecha, radio));
    expect(Math.abs(borde.x)).toBeLessThanOrEqual(1);
  });
});

describe("escena: encuadre de una pieza en un equipo chico", () => {
  const tam = { width: 390, height: 600 };
  const distancia = (plano: Parameters<typeof prepararEscena>[0], objetivo: string, zoom = 1) => {
    const escena = prepararEscena(plano);
    const camara = new THREE.PerspectiveCamera(35, tam.width / tam.height);
    const e = encuadre(escena, objetivo, zoom, camara, tam);
    return e.posicion.distanceTo(e.objetivo);
  };

  it("en un celular, la batería y el conector se ven más cerca que el celular entero (no más lejos)", () => {
    const general = distancia(planoCelular, "general");
    expect(distancia(planoCelular, "bateria", 1.2)).toBeLessThan(general);
    expect(distancia(planoCelular, "conector_carga", 1.5)).toBeLessThan(general);
  });

  it("el conector de un celular, con el zoom de la pieza nombrada, se ve grande (no un puntito al borde): ≥ 15 % del ancho", () => {
    const escena = prepararEscena(planoCelular);
    const camara = new THREE.PerspectiveCamera(35, tam.width / tam.height);
    const e = encuadre(escena, "conector_carga", 1.4, camara, tam);
    camara.position.copy(e.posicion);
    camara.lookAt(e.objetivo);
    camara.updateMatrixWorld();
    const caja = new THREE.Box3().setFromObject(escena.nodos.get("conector_carga")!.nodo);
    const ancho = caja.getSize(new THREE.Vector3()).x;
    const a = caja.getCenter(new THREE.Vector3()).addScaledVector(new THREE.Vector3(1, 0, 0), -ancho / 2).project(camara);
    const b = caja.getCenter(new THREE.Vector3()).addScaledVector(new THREE.Vector3(1, 0, 0), ancho / 2).project(camara);
    expect(Math.abs(b.x - a.x) / 2).toBeGreaterThanOrEqual(0.15);
    // Y sigue viéndose su entorno: no llena la pantalla.
    expect(Math.abs(b.x - a.x) / 2).toBeLessThan(0.6);
  });

  it("en una notebook, la batería tampoco queda más lejos que la notebook entera", () => {
    expect(distancia(planoNotebookBase, "bateria", 1.2)).toBeLessThan(distancia(planoNotebookBase, "general"));
  });

  it("en un equipo grande no cambia: una pieza chica se encuadra con su entorno (12 cm de radio como mínimo)", () => {
    const escena = prepararEscena(planoHeladera);
    const camara = new THREE.PerspectiveCamera(35, tam.width / tam.height);
    const conMinimo = encuadre(escena, "termostato", 1, camara, tam);
    const caja = new THREE.Box3().setFromObject(escena.nodos.get("termostato")!.nodo);
    expect(caja.getBoundingSphere(new THREE.Sphere()).radius * 2.6).toBeLessThan(12);
    expect(conMinimo.posicion.distanceTo(conMinimo.objetivo)).toBeLessThan(distancia(planoHeladera, "general"));
    expect(conMinimo.posicion.distanceTo(conMinimo.objetivo)).toBeGreaterThan(30);
  });
});

describe("escena: lado de la etiqueta", () => {
  const lienzo = { width: 393, height: 515 };
  const etiqueta = { ancho: 120, alto: 26 };

  it("arriba a la derecha si entra", () => {
    expect(ladoEtiqueta({ x: 150, y: 300 }, etiqueta, lienzo, 100)).toEqual({ h: "derecha", v: "arriba" });
  });

  it("abajo si arriba se encimaría con la frase", () => {
    expect(ladoEtiqueta({ x: 150, y: 160 }, etiqueta, lienzo, 100).v).toBe("abajo");
  });

  it("a la izquierda si a la derecha se sale del lienzo", () => {
    expect(ladoEtiqueta({ x: 300, y: 300 }, etiqueta, lienzo, 0).h).toBe("izquierda");
  });
});

describe("escena: cerrado / abierto", () => {
  const opacidadDe = (escena: ReturnType<typeof prepararEscena>, id: string) =>
    (escena.nodos.get(id)!.principal.material as THREE.MeshStandardMaterial).opacity;

  it("tapas, puertas y carcasas son cubiertas; la raíz que no es carcasa, no", () => {
    expect(prepararEscena(planoNotebookBase).cubiertas).toEqual({ tapa_inferior: "tapa", carcasa_pantalla: "tapa" });
  });

  it("la tapa (translúcida en su receta) se ve opaca cerrada y translúcida al abrir", () => {
    const escena = prepararEscena(planoNotebookBase);
    const cerrado = estadoInicial(escena.nodos.keys(), escena.cubiertas);
    animar(escena, cerrado, 0);
    animar(escena, cerrado, 5000);
    expect(opacidadDe(escena, "tapa_inferior")).toBeCloseTo(1, 3);
    const abierto = aplicarAccion(cerrado, { t: "despiezar", cantidad: 1 }, { casoId: "c" }).estado;
    animar(escena, abierto, 5001);
    animar(escena, abierto, 10000);
    expect(opacidadDe(escena, "tapa_inferior")).toBeLessThan(0.5);
  });

  // Se arman desde atrás: lo de adentro queda del lado de la tapa y la carcasa (con su placa al medio) en el
  // de la pantalla. Abierto por la pantalla, sin nada resaltado, la carcasa taparía todo.
  it.each([
    ["celular", planoCelular, "Sacá la tapa trasera.", "Despegá la pantalla."],
    ["tablet", planoTablet, "Sacá la tapa trasera.", "Despegá la pantalla de a poco."],
  ])("%s: abierto por la pantalla, la carcasa se ve translúcida; por la tapa, opaca", (_, plano, porTapa, porPantalla) => {
    const abrir = (dice: string) => {
      const escena = prepararEscena(plano);
      const inicio = estadoInicial(escena.nodos.keys(), escena.cubiertas, escena.lados);
      const e = con(inicio, ...conDesarme({ paso: 1, dice, acciones: [], riesgo: "bajo" }, plano).acciones);
      animar(escena, e, 0);
      animar(escena, e, 5000);
      return opacidadDe(escena, "marco");
    };
    expect(abrir(porPantalla)).toBeLessThan(0.5);
    expect(abrir(porTapa)).toBeCloseTo(1, 3);
  });
});

describe("escena: la etiqueta adentro de la pantalla y sin temblar", () => {
  const lienzo = { width: 390, height: 600 };
  const etiqueta = { ancho: 150, alto: 34 };
  const adentro = (u: ReturnType<typeof colocarEtiqueta>, ancla: { x: number; y: number }, reservado = 0) => {
    const x = ancla.x + u.caja.x;
    const y = ancla.y + u.caja.y;
    expect(x).toBeGreaterThanOrEqual(8);
    expect(x + etiqueta.ancho).toBeLessThanOrEqual(lienzo.width - 8);
    expect(y).toBeGreaterThanOrEqual(reservado + 8);
    expect(y + etiqueta.alto).toBeLessThanOrEqual(lienzo.height - 8);
  };

  it("nunca se corta en el borde: pieza pegada a la derecha, a la izquierda, arriba o fuera de la pantalla", () => {
    for (const ancla of [{ x: 385, y: 300 }, { x: 5, y: 300 }, { x: 200, y: 20 }, { x: 200, y: 595 }, { x: 600, y: -50 }]) {
      adentro(colocarEtiqueta(ancla, etiqueta, lienzo, 0), ancla);
    }
  });

  it("tampoco se mete debajo de la frase", () => {
    const ancla = { x: 200, y: 140 };
    adentro(colocarEtiqueta(ancla, etiqueta, lienzo, 120), ancla, 120);
  });

  it("no salta de lado por poco al girar: se queda mientras entre (o casi), y cambia si ya no entra", () => {
    const ancla = { x: 212, y: 300 }; // a la derecha le faltan 8 px (212 + 28 + 150 = 390 > 382)
    expect(colocarEtiqueta(ancla, etiqueta, lienzo, 0).lado.h).toBe("izquierda"); // sin historia, el que entra
    expect(colocarEtiqueta(ancla, etiqueta, lienzo, 0, { h: "derecha", v: "arriba" }).lado.h).toBe("derecha"); // venía de la derecha: se queda
    expect(colocarEtiqueta({ x: 260, y: 300 }, etiqueta, lienzo, 0, { h: "derecha", v: "arriba" }).lado.h).toBe("izquierda"); // ya no entra: cambia
  });

  it("al girar la cámara (3 s a 60 cuadros, pieza oscilando donde ningún lado entra entero) no cambia de lado más de una vez por segundo", () => {
    // Una etiqueta larga ("Conector Lightning de carga") en un celular angosto: era la que saltaba.
    const larga = { ancho: 210, alto: 34 };
    let lado: LadoEtiqueta | undefined;
    let cambio: CambioLado = { h: -Infinity, v: -Infinity };
    const cambios: number[] = [];
    for (let cuadro = 0; cuadro <= 180; cuadro++) {
      const ahora = cuadro * (1000 / 60);
      // Va y viene por el medio (3 vueltas por segundo) con un temblor de ±6 px, como al girar con el dedo.
      const ancla = { x: 195 + 70 * Math.sin((2 * Math.PI * 3 * ahora) / 1000) + 6 * Math.sin(cuadro * 1.7), y: 300 };
      const u = colocarEtiqueta(ancla, larga, lienzo, 0, lado, { ahora, cambio });
      if (lado && u.lado.h !== lado.h) cambios.push(ahora);
      lado = u.lado;
      cambio = u.cambio;
    }
    for (const t of cambios) expect(cambios.filter((x) => x >= t && x < t + 1000)).toHaveLength(1);
    // Sin el freno de tiempo y de margen, el mismo giro cambiaba de lado muchas veces.
    let sinFreno: LadoEtiqueta | undefined;
    let saltos = 0;
    for (let cuadro = 0; cuadro <= 180; cuadro++) {
      const ahora = cuadro * (1000 / 60);
      const ancla = { x: 195 + 70 * Math.sin((2 * Math.PI * 3 * ahora) / 1000) + 6 * Math.sin(cuadro * 1.7), y: 300 };
      const nuevo = ladoEtiqueta(ancla, larga, lienzo, 0);
      if (sinFreno && nuevo.h !== sinFreno.h) saltos++;
      sinFreno = nuevo;
    }
    expect(saltos).toBeGreaterThan(5);
  });

  it("suavizar: el recuadro se acerca a donde tiene que ir según el tiempo, sin pasarse; la primera vez va directo", () => {
    expect(suavizar(null, { x: 100, y: 50 }, 16)).toEqual({ x: 100, y: 50 });
    const a = suavizar({ x: 0, y: 0 }, { x: 100, y: 0 }, 16);
    expect(a.x).toBeGreaterThan(0);
    expect(a.x).toBeLessThan(30);
    let p = { x: 0, y: 0 };
    for (let i = 0; i < 60; i++) p = suavizar(p, { x: 100, y: 0 }, 16);
    expect(p.x).toBeGreaterThan(99);
    expect(p.x).toBeLessThanOrEqual(100);
  });

  it("la línea guía llega a la esquina del recuadro más cercana a la pieza", () => {
    const u = colocarEtiqueta({ x: 100, y: 300 }, etiqueta, lienzo, 0);
    expect(u.lado).toEqual({ h: "derecha", v: "arriba" });
    expect(u.punta).toEqual({ x: u.caja.x, y: u.caja.y + etiqueta.alto });
  });
});

describe("escena: vista general en el celular", () => {
  it("en una pantalla vertical el equipo entra entero a lo ancho (no se sale por los costados)", () => {
    const escena = prepararEscena(planoNotebookBase);
    const tam = { width: 390, height: 500 };
    const camara = new THREE.PerspectiveCamera(35, tam.width / tam.height);
    const e = encuadre(escena, "general", 1, camara, tam);
    camara.position.copy(e.posicion);
    camara.lookAt(e.objetivo);
    camara.updateMatrixWorld();
    const caja = new THREE.Box3().setFromObject(escena.raiz);
    for (const x of [caja.min.x, caja.max.x])
      for (const z of [caja.min.z, caja.max.z]) {
        const p = new THREE.Vector3(x, caja.max.y, z).project(camara);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
      }
  });
});

describe("separarEtiquetas (#179: varias piezas resaltadas a la vez)", () => {
  const lienzo = { width: 390, height: 600 };
  const r = (x: number, y: number, ancho = 120, alto = 36) => ({ x, y, ancho, alto });
  const sePisan = (a: ReturnType<typeof r>, b: ReturnType<typeof r>) => a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;

  it("dos etiquetas encimadas: la segunda se corre lo mínimo y ya no se pisan", () => {
    const [a, b] = separarEtiquetas([r(20, 300), r(30, 310)], lienzo);
    expect(a).toEqual(r(20, 300));
    expect(b.x).toBe(30);
    expect(sePisan(a, b)).toBe(false);
    expect(Math.abs(b.y - 310)).toBeLessThanOrEqual(36 + 4 + 10);
  });

  it("tres juntas (como disipador, placa madre y ventilador): ninguna se pisa y todas quedan adentro", () => {
    const res = separarEtiquetas([r(20, 300), r(25, 305), r(30, 298)], lienzo, 100);
    for (let i = 0; i < res.length; i++) {
      for (let j = i + 1; j < res.length; j++) expect(sePisan(res[i], res[j])).toBe(false);
      expect(res[i].y).toBeGreaterThanOrEqual(100);
      expect(res[i].y + res[i].alto).toBeLessThanOrEqual(lienzo.height);
    }
  });

  it("si no se tocan no se mueven, y nunca se meten en la franja reservada de arriba", () => {
    expect(separarEtiquetas([r(10, 300), r(250, 300)], lienzo)).toEqual([r(10, 300), r(250, 300)]);
    const [, b] = separarEtiquetas([r(20, 110), r(20, 112)], lienzo, 100);
    expect(b.y).toBeGreaterThanOrEqual(110 + 36);
  });
});

describe("resaltado de una pieza grande (#231: no rellenar todo de celeste)", () => {
  const mat = (escena: ReturnType<typeof prepararEscena>, id: string) => escena.nodos.get(id)!.principal.material as THREE.MeshStandardMaterial;
  const borde = (escena: ReturnType<typeof prepararEscena>, id: string) => escena.nodos.get(id)!.mallas[0].borde.material;
  const resaltar = (plano: Parameters<typeof prepararEscena>[0], pieza: string) => {
    const escena = prepararEscena(plano);
    const e = con(estadoInicial(escena.nodos.keys()), { t: "resaltar", pieza });
    animar(escena, e, 0);
    animar(escena, e, 5000);
    return escena;
  };

  // Dos variantes por tipo: el panel frontal de una tablet y la tapa trasera de un celular.
  for (const [nombre, plano, grande, adentro] of [
    ["tablet: panel frontal", planoTablet, "pantalla", "bateria"],
    ["celular: tapa trasera", planoCelular, "tapa_trasera", "bateria"],
  ] as const) {
    it(`${nombre}: translúcida con contorno de color, y lo de adentro sigue a la vista`, () => {
      const escena = resaltar(plano, grande);
      expect(escena.nodos.get(grande)!.grande).toBe(true);
      expect(mat(escena, grande).opacity).toBeCloseTo(OPACIDAD_GRANDE_ACTIVA, 2);
      expect(mat(escena, grande).transparent).toBe(true);
      expect(borde(escena, grande).color.getHexString()).toBe(new THREE.Color(COLOR_ACTIVO).getHexString());
      expect(borde(escena, grande).opacity).toBeCloseTo(1, 2);
      // La batería (adentro) no pasa a fantasma: queda como estaba.
      const original = prepararEscena(plano);
      expect(mat(escena, adentro).opacity).toBeCloseTo(mat(original, adentro).opacity, 3);
      expect(mat(escena, adentro).color.getHexString()).toBe(mat(original, adentro).color.getHexString());
    });
  }

  // Dos variantes: el panel frontal (tapado por la tapa trasera) y la tapa trasera (tapada por el panel).
  for (const [plano, grande, otra] of [
    [planoTablet, "pantalla", "tapa_trasera"],
    [planoCelular, "tapa_trasera", "pantalla"],
  ] as const) {
    it(`resaltado ${grande}, la otra pieza grande (${otra}) pasa a fantasma: no la tapa`, () => {
      const escena = resaltar(plano, grande);
      expect(escena.nodos.get(otra)!.grande).toBe(true);
      expect(mat(escena, otra).opacity).toBeLessThan(0.6);
    });
  }

  // #188: la carcasa raíz es madre de todo; su pantalla (grande) no la tapa, lo de adentro (chico) sigue igual.
  for (const [plano, raiz, pantalla, adentro] of [
    [planoCelular, "marco", "pantalla", "bateria"],
    [planoTelevisor, "carcasa_televisor", "pantalla_panel", "placa_control"],
  ] as const) {
    it(`resaltada la carcasa (${raiz}), su hija grande (${pantalla}) pasa a fantasma y ${adentro} no`, () => {
      const escena = resaltar(plano, raiz);
      expect(escena.nodos.get(pantalla)!.ancestros).toContain(raiz);
      expect(mat(escena, pantalla).opacity).toBeLessThan(0.6);
      expect(mat(escena, adentro).opacity).toBeCloseTo(mat(prepararEscena(plano), adentro).opacity, 3);
    });
  }

  it("una pieza chica (la batería) sigue sólida y lo demás pasa a fantasma, como antes", () => {
    const escena = resaltar(planoTablet, "bateria");
    expect(escena.nodos.get("bateria")!.grande).toBe(false);
    expect(mat(escena, "bateria").opacity).toBeCloseTo(1, 3);
    expect(mat(escena, "placa_madre").opacity).toBeLessThan(0.6);
  });
});

describe("notebook abierta (#232): se da vuelta el equipo, no la cámara", () => {
  const camara = new THREE.PerspectiveCamera(35, 390 / 844);
  const tam = { width: 390, height: 844 };

  it("arranca dada vuelta (mirada por el teclado) y la cámara sigue arriba y adelante", () => {
    const escena = prepararEscena(planoNotebookBase);
    expect(escena.vuelta).toBeDefined();
    expect(escena.raiz.rotation.z).toBeCloseTo(Math.PI);
    const e = encuadre(escena, "general", 1, camara, tam, 0, 0, "abajo");
    expect(e.posicion.y).toBeGreaterThan(e.objetivo.y);
    expect(e.posicion.z).toBeGreaterThan(e.objetivo.z);
  });

  it("encuadra con la tapa de pantalla abierta (no la caja cerrada) y vuelve a girar al sacar la tapa inferior", () => {
    const escena = prepararEscena(planoNotebookBase);
    const inicio = estadoInicial(escena.nodos.keys(), escena.cubiertas, escena.lados);
    const girados = { carcasa_pantalla: inicio.piezas.carcasa_pantalla.rot };
    const cerrada = encuadre(escena, "general", 1, camara, tam, 0, 0, "abajo");
    const abierta = encuadre(escena, "general", 1, camara, tam, 0, 0, "abajo", {}, girados);
    // Abierta, la pantalla sube: el centro de lo que se encuadra queda más arriba.
    expect(abierta.objetivo.y).toBeGreaterThan(cerrada.objetivo.y + 3);
    const volteada = aplicarAccion(inicio, { t: "rotar", pieza: "tapa_inferior", eje: "x", grados: -100 }, { casoId: "c" }).estado;
    animar(escena, volteada, 0);
    animar(escena, volteada, 5000);
    expect(escena.raiz.rotation.z).toBeCloseTo(0);
  });
});
