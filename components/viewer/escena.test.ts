import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { planoNotebookBase } from "../../lib/planogenerator";
import { planoCelular, planoHeladera } from "../../lib/planogenerator/plantillas/equipos";
import { COLOR_ACTIVO, animar, colocarEtiqueta, encuadre, ladoEtiqueta, prepararEscena, usarColorActivo } from "./escena";
import { aplicarAccion, estadoInicial, type EstadoEscena } from "./reproductor";

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
    expect(prepararEscena(planoNotebookBase).cubiertas).toEqual({ tapa_inferior: "tapa" });
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
