import * as THREE from "three";
import type { PlanoDePiezas, Vec3 } from "../../shared";
import { SUFIJO_MALLA, construirEscena, type DatosPieza } from "../../lib/planogenerator";
import { desplazamientoDespiece, type EstadoEscena } from "./reproductor";
import { crearTween, seguir, type Tween } from "./tween";

/**
 * Escena del visor en estilo "ilustración técnica": bordes visibles, modo rayos X
 * (lo que no es del paso queda gris translúcido, la pieza activa sólida y naranja)
 * y transiciones con easing. Sin React: lo usa Visor.tsx en cada cuadro.
 */

export const COLOR_ACTIVO = "#E8590C";
const ACTIVO = new THREE.Color(COLOR_ACTIVO);
const FANTASMA = new THREE.Color("#7d8894");
const OPACIDAD_FANTASMA = 0.1;
const BORDE = new THREE.Color("#cfd8e2");
const BORDE_FANTASMA = new THREE.Color("#a9bacb");
const BORDE_ACTIVO = new THREE.Color("#4a1803");
const ANGULO_BORDES = 30; // grados: solo aristas marcadas, no las de superficies curvas

const DURACION = { mover: 750, girar: 750, fundido: 450, foco: 400, despiece: 650 };
const ESCALON_DESPIECE_MS = 70;

type MallaAnimable = {
  malla: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  borde: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  color: THREE.Color;
  opacidad: number;
  transparente: boolean;
  metalness: number;
  roughness: number;
};

export type NodoAnimable = {
  id: string;
  nodo: THREE.Group;
  /** Malla principal (la que define medidas) + detalles. */
  principal: THREE.Mesh;
  mallas: MallaAnimable[];
  reposo: THREE.Vector3;
  centroPadre: Vec3 | null;
  ancestros: string[];
  /** Posición en la secuencia del despiece (de abajo hacia arriba). */
  orden: number;
  tw: Record<"desp" | "despiece" | "rot" | "visible" | "foco" | "fantasma", Tween>;
};

export type EscenaPreparada = {
  raiz: THREE.Group;
  nodos: Map<string, NodoAnimable>;
  avisos: string[];
  radio: number;
  piso: number;
  despiece: { ultimo: number; subiendo: boolean };
};

export function prepararEscena(plano: PlanoDePiezas): EscenaPreparada {
  const { raiz, nodos, avisos } = construirEscena(plano);
  const animables = new Map<string, NodoAnimable>();
  const ids = [...nodos.keys()];
  const profundidad = (id: string) => ancestrosDe(nodos.get(id)!, raiz).length;
  const enOrden = [...ids].sort((a, b) => profundidad(a) - profundidad(b) || ids.indexOf(a) - ids.indexOf(b));

  for (const [id, nodo] of nodos) {
    const padre = nodo.parent?.userData as Partial<DatosPieza> | undefined;
    animables.set(id, {
      id,
      nodo,
      principal: nodo.getObjectByName(id + SUFIJO_MALLA) as THREE.Mesh,
      mallas: mallasPropias(nodo).map(prepararMalla),
      reposo: nodo.position.clone(),
      centroPadre: padre?.centro ?? null,
      ancestros: ancestrosDe(nodo, raiz),
      orden: enOrden.indexOf(id),
      tw: {
        desp: crearTween([0, 0, 0]),
        despiece: crearTween([0, 0, 0]),
        rot: crearTween([0, 0, 0]),
        visible: crearTween([1]),
        foco: crearTween([0]),
        fantasma: crearTween([0]),
      },
    });
  }
  const caja = new THREE.Box3().setFromObject(raiz);
  const radio = Math.max(caja.getBoundingSphere(new THREE.Sphere()).radius, 1);
  return { raiz, nodos: animables, avisos, radio, piso: caja.min.y, despiece: { ultimo: 0, subiendo: true } };
}

function ancestrosDe(nodo: THREE.Object3D, raiz: THREE.Object3D): string[] {
  const res: string[] = [];
  for (let p = nodo.parent; p && p !== raiz; p = p.parent) res.push(p.name);
  return res;
}

/** Mallas de esta pieza (la principal y sus detalles), sin entrar en las piezas hijas. */
function mallasPropias(nodo: THREE.Group): THREE.Mesh[] {
  const res: THREE.Mesh[] = [];
  const visitar = (o: THREE.Object3D) => {
    for (const hijo of o.children) {
      if (hijo instanceof THREE.Group) continue;
      if (hijo instanceof THREE.Mesh) res.push(hijo);
      visitar(hijo);
    }
  };
  visitar(nodo);
  return res;
}

function prepararMalla(m: THREE.Mesh): MallaAnimable {
  const malla = m as MallaAnimable["malla"];
  const mat = malla.material;
  mat.emissive.copy(ACTIVO);
  mat.emissiveIntensity = 0;
  const borde = new THREE.LineSegments(
    new THREE.EdgesGeometry(malla.geometry, ANGULO_BORDES),
    new THREE.LineBasicMaterial({ color: BORDE, transparent: true, opacity: 0.6 }),
  );
  borde.name = `${malla.name}__borde`;
  borde.raycast = () => {};
  malla.add(borde);
  return {
    malla,
    borde,
    color: mat.color.clone(),
    opacidad: mat.opacity,
    transparente: mat.transparent,
    metalness: mat.metalness,
    roughness: mat.roughness,
  };
}

export function liberar(raiz: THREE.Object3D) {
  raiz.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    }
  });
}

export function piezasResaltadas(estado: EstadoEscena): string[] {
  return Object.keys(estado.piezas).filter((id) => estado.piezas[id].resaltada);
}

// ---------- Animación cuadro a cuadro ----------

const lerp = THREE.MathUtils.lerp;

/** `ahora` en ms. */
export function animar(escena: EscenaPreparada, estado: EstadoEscena, ahora: number) {
  if (estado.despiece !== escena.despiece.ultimo) {
    escena.despiece.subiendo = estado.despiece > escena.despiece.ultimo;
    escena.despiece.ultimo = estado.despiece;
  }
  const activos = new Set(piezasResaltadas(estado));
  const latido = 1 + 0.25 * Math.sin(ahora / 260);
  const total = escena.nodos.size;

  for (const [id, a] of escena.nodos) {
    const e = estado.piezas[id];
    if (!e) continue;

    // Posición y giro.
    const centro = (a.nodo.userData as DatosPieza).centro;
    const escalon = escena.despiece.subiendo ? a.orden : total - 1 - a.orden;
    const despiece = seguir(
      a.tw.despiece,
      desplazamientoDespiece(centro, a.centroPadre, estado.despiece),
      ahora,
      DURACION.despiece,
      escalon * ESCALON_DESPIECE_MS,
    );
    const desp = seguir(a.tw.desp, e.desp, ahora, DURACION.mover);
    a.nodo.position.set(
      a.reposo.x + desp[0] + despiece[0],
      a.reposo.y + desp[1] + despiece[1],
      a.reposo.z + desp[2] + despiece[2],
    );
    const [rx, ry, rz] = seguir(a.tw.rot, e.rot, ahora, DURACION.girar);
    a.nodo.rotation.set(rx, ry, rz);

    // Rayos X: si hay piezas activas, lo que no es activo ni hijo de activo queda fantasma.
    const esActiva = activos.has(id);
    const esFantasma = activos.size > 0 && !esActiva && !a.ancestros.some((p) => activos.has(p));
    const [foco] = seguir(a.tw.foco, [esActiva ? 1 : 0], ahora, DURACION.foco);
    const [fantasma] = seguir(a.tw.fantasma, [esFantasma ? 1 : 0], ahora, DURACION.foco);
    const [visible] = seguir(a.tw.visible, [e.visible ? 1 : 0], ahora, DURACION.fundido);

    for (const m of a.mallas) pintar(m, foco, fantasma, visible, latido);
  }
}

function pintar(m: MallaAnimable, foco: number, fantasma: number, visible: number, latido: number) {
  const mat = m.malla.material;
  mat.color.copy(m.color).lerp(FANTASMA, fantasma).lerp(ACTIVO, foco);
  mat.metalness = lerp(m.metalness, 0.1, foco);
  mat.roughness = lerp(m.roughness, 0.45, foco);
  mat.emissiveIntensity = foco * 0.9 * latido;

  const opacidad = lerp(lerp(m.opacidad, OPACIDAD_FANTASMA, fantasma), 1, foco) * visible;
  mat.opacity = opacidad;
  const transparente = m.transparente || opacidad < 0.999;
  if (mat.transparent !== transparente) {
    mat.transparent = transparente;
    mat.needsUpdate = true;
  }
  mat.depthWrite = !transparente;
  m.malla.visible = opacidad > 0.01;

  const b = m.borde.material;
  b.color.copy(BORDE).lerp(BORDE_FANTASMA, fantasma).lerp(BORDE_ACTIVO, foco);
  b.opacity = lerp(lerp(0.22, 0.4, fantasma), 0.7, foco) * visible;
  m.borde.visible = b.opacity > 0.01;
}

// ---------- Cámara ----------

export type ModoVista = "perspectiva" | "isometrica";

const DIRECCION_PERSPECTIVA = new THREE.Vector3(0, 1.1, 1).normalize();
const DIRECCION_ISOMETRICA = new THREE.Vector3(1, 1, 1).normalize();

/** Hacia dónde mirar y cuánto alejarse para encuadrar una pieza (o "general"). */
export function encuadre(
  escena: EscenaPreparada,
  objetivo: string,
  zoom: number,
  camara: THREE.Camera,
  tamPantalla: { width: number; height: number },
  despiece = 0,
) {
  const nodo = escena.nodos.get(objetivo)?.nodo ?? escena.raiz;
  const esfera = new THREE.Box3().setFromObject(nodo).getBoundingSphere(new THREE.Sphere());
  // Una pieza se encuadra con su entorno para que se entienda dónde está.
  // Con el despiece las piezas suben y se abren: se deja más margen.
  const radio = nodo === escena.raiz ? esfera.radius * (0.8 + 0.45 * despiece) : Math.max(esfera.radius * 2.6, 12);
  const objetivoPos = esfera.center;

  if (camara instanceof THREE.OrthographicCamera) {
    const posicion = objetivoPos.clone().addScaledVector(DIRECCION_ISOMETRICA, 200);
    const zoomOrto = (Math.min(tamPantalla.width, tamPantalla.height) / (2 * radio)) * zoom;
    return { posicion, objetivo: objetivoPos, zoomOrto };
  }
  const fov = camara instanceof THREE.PerspectiveCamera ? camara.fov : 35;
  const distancia = radio / Math.sin(THREE.MathUtils.degToRad(fov / 2)) / zoom;
  const posicion = objetivoPos.clone().addScaledVector(DIRECCION_PERSPECTIVA, Math.max(distancia, 8));
  return { posicion, objetivo: objetivoPos, zoomOrto: null };
}
