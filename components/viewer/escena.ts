import * as THREE from "three";
import type { PlanoDePiezas, Vec3 } from "../../shared";
import { SUFIJO_MALLA, construirEscena, type BibliotecaPiezas, type DatosPieza } from "../../lib/planogenerator";
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
/**
 * Piezas con ubicación incierta ("estimada" o "plantilla"): contorno punteado y más transparentes
 * (también resaltadas, un poco menos). Las del manual quedan sólidas; sin origen (planos viejos), igual que antes.
 */
const OPACIDAD_INCIERTA = 0.5;
const OPACIDAD_INCIERTA_ACTIVA = 0.8;
/** Trazo del punteado como fracción del lado mayor de la pieza (entre 0,3 y 3 cm). */
const TRAZO_PUNTEADO = 0.08;
const BORDE = new THREE.Color("#cfd8e2");
const BORDE_FANTASMA = new THREE.Color("#a9bacb");
const BORDE_ACTIVO = new THREE.Color("#4a1803");
const ANGULO_BORDES = 30; // grados: solo aristas marcadas, no las de superficies curvas

const DURACION = { mover: 750, girar: 750, fundido: 450, foco: 400, despiece: 650 };
const ESCALON_DESPIECE_MS = 70;

type MallaAnimable = {
  malla: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  /** LineDashedMaterial si la ubicación es incierta. */
  borde: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  incierta: boolean;
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
  /** Desde dónde mira la cámara (perspectiva): la cara grande del equipo hacia la cámara (ver `direccionDeCamara`). */
  direccion: THREE.Vector3;
};

export function prepararEscena(plano: PlanoDePiezas, biblioteca?: BibliotecaPiezas, tipoEquipo?: string): EscenaPreparada {
  const { raiz, nodos, avisos } = construirEscena(plano, { biblioteca, tipoEquipo });
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
      mallas: mallasPropias(nodo).map((m) => prepararMalla(m, esIncierta(nodo.userData as DatosPieza))),
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
  const direccion = direccionDeCamara(caja.getSize(new THREE.Vector3()));
  return { raiz, nodos: animables, avisos, radio, piso: caja.min.y, despiece: { ultimo: 0, subiendo: true }, direccion };
}

/**
 * Como `prepararEscena`, pero si las piezas de Blender rompen algo, arma la escena con las
 * primitivas (cajas y cilindros) y lo avisa: el 3D nunca queda vacío por culpa del GLB.
 */
export function prepararEscenaSegura(plano: PlanoDePiezas, biblioteca?: BibliotecaPiezas | null, tipoEquipo?: string): EscenaPreparada {
  if (!biblioteca) return prepararEscena(plano, undefined, tipoEquipo);
  try {
    return prepararEscena(plano, biblioteca, tipoEquipo);
  } catch (e) {
    console.warn("[visor] las piezas de Blender fallaron, uso primitivas:", e);
    const escena = prepararEscena(plano, undefined, tipoEquipo);
    escena.avisos.unshift("Las piezas detalladas no cargaron en este equipo: se muestran formas simples.");
    return escena;
  }
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

/** La ubicación no salió del manual: se estimó o es de la plantilla. */
export function esIncierta(d: Pick<DatosPieza, "origen">): boolean {
  return d.origen === "estimada" || d.origen === "plantilla";
}

function prepararMalla(m: THREE.Mesh, incierta: boolean): MallaAnimable {
  const malla = m as MallaAnimable["malla"];
  const mat = malla.material;
  mat.emissive.copy(ACTIVO);
  mat.emissiveIntensity = 0;
  const geometria = new THREE.EdgesGeometry(malla.geometry, ANGULO_BORDES);
  let material: THREE.LineBasicMaterial;
  if (incierta) {
    geometria.computeBoundingBox();
    const lado = geometria.boundingBox!.getSize(new THREE.Vector3()).toArray().reduce((a, b) => Math.max(a, b), 0);
    const trazo = Math.min(Math.max(lado * TRAZO_PUNTEADO, 0.3), 3);
    material = new THREE.LineDashedMaterial({ color: BORDE, transparent: true, opacity: 0.6, dashSize: trazo, gapSize: trazo * 0.7 });
  } else {
    material = new THREE.LineBasicMaterial({ color: BORDE, transparent: true, opacity: 0.6 });
  }
  const borde = new THREE.LineSegments(geometria, material);
  if (incierta) borde.computeLineDistances(); // sin esto, el punteado no se dibuja
  borde.name = `${malla.name}__borde`;
  borde.raycast = () => {};
  malla.add(borde);
  return {
    malla,
    borde,
    incierta,
    color: mat.color.clone(),
    opacidad: mat.opacity,
    transparente: mat.transparent,
    metalness: mat.metalness,
    roughness: mat.roughness,
  };
}

/**
 * Las piezas reales llegaron tarde y reemplazan a las primitivas: la escena nueva sigue la
 * animación donde iba la vieja (mismos tramos y despiece), así nada salta ni se repite.
 */
export function continuarAnimacion(desde: EscenaPreparada, hacia: EscenaPreparada): void {
  Object.assign(hacia.despiece, desde.despiece);
  for (const [id, a] of hacia.nodos) {
    const b = desde.nodos.get(id);
    if (!b) continue;
    for (const k of Object.keys(a.tw) as (keyof NodoAnimable["tw"])[]) {
      a.tw[k] = { ...b.tw[k], desde: [...b.tw[k].desde], hasta: [...b.tw[k].hasta] };
    }
    a.nodo.position.copy(b.nodo.position);
    a.nodo.rotation.copy(b.nodo.rotation);
  }
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

  const incierta = m.incierta ? lerp(OPACIDAD_INCIERTA, OPACIDAD_INCIERTA_ACTIVA, foco) : 1;
  const opacidad = lerp(lerp(m.opacidad, OPACIDAD_FANTASMA, fantasma), 1, foco) * visible * incierta;
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
  // El punteado se marca un poco más, para que se note aunque la pieza sea más transparente.
  b.opacity = lerp(lerp(m.incierta ? 0.45 : 0.22, 0.4, fantasma), m.incierta ? 0.85 : 0.7, foco) * visible;
  m.borde.visible = b.opacity > 0.01;
}

// ---------- Cámara ----------

export type ModoVista = "perspectiva" | "isometrica";

/** Equipo acostado (notebook, celular): se mira desde arriba y adelante. */
const DIRECCION_PERSPECTIVA = new THREE.Vector3(0, 1.1, 1).normalize();
/** Equipo parado (TV, heladera, lavarropas…): casi de frente, apenas desde arriba (~19°). */
const DIRECCION_DE_FRENTE = new THREE.Vector3(0, 0.35, 1).normalize();
/** Si el alto es al menos esto de la profundidad, el equipo está parado: su cara grande mira a la cámara (+z). */
const PARADO_DESDE = 0.7;

/** La cara grande del equipo hacia la cámara: de frente si está parado, desde arriba si está acostado. */
export function direccionDeCamara(tam: THREE.Vector3): THREE.Vector3 {
  return (tam.y >= PARADO_DESDE * tam.z ? DIRECCION_DE_FRENTE : DIRECCION_PERSPECTIVA).clone();
}
const DIRECCION_ISOMETRICA = new THREE.Vector3(1, 1, 1).normalize();

/** Lo que tapa la frase nunca deja menos que esto del lienzo para el 3D. */
const FRACCION_LIBRE_MIN = 0.4;

/**
 * Hacia dónde mirar y cuánto alejarse para encuadrar una pieza (o "general").
 * `reservadoArriba` (px): franja de arriba tapada por la frase del experto. La pieza se centra
 * en lo que queda libre: `focal` va tal cual a `CameraControls.setFocalOffset(0, focal, 0)`
 * (unidades del mundo, eje "arriba" de la cámara; en camera-controls un valor positivo sube
 * los objetos en pantalla, así que para bajar la pieza es negativo).
 * En un celular en vertical el ancho es el que limita: se encuadra para que entre en los dos ejes.
 */
export function encuadre(
  escena: EscenaPreparada,
  objetivo: string,
  zoom: number,
  camara: THREE.Camera,
  tamPantalla: { width: number; height: number },
  despiece = 0,
  reservadoArriba = 0,
) {
  const nodo = escena.nodos.get(objetivo)?.nodo ?? escena.raiz;
  const caja = new THREE.Box3().setFromObject(nodo);
  const esfera = caja.getBoundingSphere(new THREE.Sphere());
  // Una pieza se encuadra con su entorno para que se entienda dónde está.
  // Con el despiece las piezas suben y se abren: se deja más margen.
  // Un equipo alto (heladera) tiene que entrar entero a lo alto; uno chato (notebook) no cambia.
  const alto = caja.getSize(new THREE.Vector3()).y / 2;
  const radio =
    nodo === escena.raiz ? Math.max(esfera.radius * (0.8 + 0.45 * despiece), alto * 1.15) : Math.max(esfera.radius * 2.6, 12);
  const objetivoPos = esfera.center;
  const { width, height } = tamPantalla;
  const reservado = Math.min(Math.max(reservadoArriba, 0), height * (1 - FRACCION_LIBRE_MIN));
  const libre = (height - reservado) / height;

  if (camara instanceof THREE.OrthographicCamera) {
    const posicion = objetivoPos.clone().addScaledVector(DIRECCION_ISOMETRICA, 200);
    const zoomOrto = (Math.min(width, height - reservado) / (2 * radio)) * zoom;
    return { posicion, objetivo: objetivoPos, zoomOrto, focal: -reservado / 2 / zoomOrto };
  }
  const fov = camara instanceof THREE.PerspectiveCamera ? camara.fov : 35;
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  // Medio ángulo que ve la cámara en lo libre (vertical) y a lo ancho.
  const mitadV = Math.atan(tanV * libre);
  const mitadH = Math.atan(tanV * (width / height));
  const distancia = Math.max(radio / Math.sin(mitadV), radio / Math.sin(mitadH)) / zoom;
  const d = Math.max(distancia, 8);
  const posicion = objetivoPos.clone().addScaledVector(escena.direccion ?? DIRECCION_PERSPECTIVA, d);
  const unidadesPorPx = (2 * d * tanV) / height;
  return { posicion, objetivo: objetivoPos, zoomOrto: null, focal: -(reservado / 2) * unidadesPorPx };
}

export type LadoEtiqueta = { h: "derecha" | "izquierda"; v: "arriba" | "abajo" };

/** Largo de la línea guía de la etiqueta, en px (horizontal y vertical). */
export const LINEA_ETIQUETA = { dx: 28, dy: 44 };
const MARGEN_ETIQUETA = 8;

/**
 * Dónde va la etiqueta respecto de la pieza (`ancla`, en px del lienzo): arriba a la derecha
 * si entra; abajo si arriba chocaría con la frase (`reservadoArriba`); a la izquierda si a la
 * derecha se sale del lienzo.
 */
export function ladoEtiqueta(
  ancla: { x: number; y: number },
  etiqueta: { ancho: number; alto: number },
  lienzo: { width: number; height: number },
  reservadoArriba = 0,
): LadoEtiqueta {
  const { dx, dy } = LINEA_ETIQUETA;
  const sobraArriba = ancla.y - dy - etiqueta.alto - (reservadoArriba + MARGEN_ETIQUETA);
  const sobraAbajo = lienzo.height - MARGEN_ETIQUETA - (ancla.y + dy + etiqueta.alto);
  const sobraDerecha = lienzo.width - MARGEN_ETIQUETA - (ancla.x + dx + etiqueta.ancho);
  const sobraIzquierda = ancla.x - dx - etiqueta.ancho - MARGEN_ETIQUETA;
  return {
    v: sobraArriba >= 0 || sobraArriba >= sobraAbajo ? "arriba" : "abajo",
    h: sobraDerecha >= 0 || sobraDerecha >= sobraIzquierda ? "derecha" : "izquierda",
  };
}
