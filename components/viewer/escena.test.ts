import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { planoNotebookBase } from "../../lib/planogenerator";
import { COLOR_ACTIVO, animar, encuadre, ladoEtiqueta, prepararEscena } from "./escena";
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
  it("la pieza activa queda sólida y naranja; las demás grises translúcidas; sus hijas quedan normales", () => {
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
