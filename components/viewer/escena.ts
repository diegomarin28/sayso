import * as THREE from "three";
import { ES_CUBIERTA } from "../../lib/planogenerator/cubiertas";
import type { PlanoDePiezas, Vec3 } from "../../shared";
import { SUFIJO_MALLA, construirEscena, type BibliotecaPiezas, type DatosPieza } from "../../lib/planogenerator";
import { despiezado, type Cubiertas, type EstadoEscena } from "./reproductor";
import { ACTIVO_RESPALDO } from "./tema";
import { crearTween, seguir, type Tween } from "./tween";

/**
 * Escena del visor en estilo "ilustración técnica": bordes visibles, modo rayos X
 * (lo que no es del paso queda gris translúcido, la pieza activa sólida y del color de resaltado)
 * y transiciones con easing. Sin React: lo usa Visor.tsx en cada cuadro.
 */

export const COLOR_ACTIVO = ACTIVO_RESPALDO;
const ACTIVO = new THREE.Color(COLOR_ACTIVO);
const FANTASMA = new THREE.Color("#7d8894");
const OPACIDAD_FANTASMA = 0.1;
/**
 * Piezas con ubicación incierta ("estimada" o "plantilla"): contorno PUNTEADO, opacas como las demás
 * (decisión #196). Translúcidas no escriben profundidad y, con varias capas encimadas (un celular real
 * con todo estimado), se veía todo a través de todo. La señal de "no verificado" es el punteado, el chip
 * "N estimadas · N genéricas" y la etiqueta "Sin verificar" de cada pieza.
 */
/** Trazo del punteado como fracción del lado mayor de la pieza (entre 0,3 y 3 cm). */
const TRAZO_PUNTEADO = 0.08;
const BORDE = new THREE.Color("#cfd8e2");
const BORDE_FANTASMA = new THREE.Color("#a9bacb");
/** El borde de la pieza activa: el color de resaltado a un tercio del brillo (0,08 en espacio lineal ≈ 0,32 a la vista). */
const OSCURO_BORDE_ACTIVO = 0.08;
const BORDE_ACTIVO = ACTIVO.clone().multiplyScalar(OSCURO_BORDE_ACTIVO);
const ANGULO_BORDES = 30; // grados: solo aristas marcadas, no las de superficies curvas
const ANGULO_BORDES_CUBIERTA = 60;

/** Cuánto brilla la pieza activa con el naranja (por el que se ajustó el bloom). */
const BRILLO_ACTIVO = 0.9;
/**
 * Un color de resaltado claro (el cian de Sayso tiene el doble de luminancia que el naranja) brilla
 * menos, para que el bloom no lo lave a blanco: el brillo se escala a la luminancia del naranja.
 */
const LUMINANCIA_REFERENCIA = luminancia(new THREE.Color(ACTIVO_RESPALDO));
let brilloActivo = BRILLO_ACTIVO;

/** Luminancia relativa (espacio lineal). */
function luminancia(c: THREE.Color) {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/**
 * Color de resaltado (tema.ts lo lee de las variables CSS). Se llama antes de preparar la escena:
 * las mallas preparadas antes conservan el brillo del color anterior.
 */
export function usarColorActivo(color: string) {
  ACTIVO.set(color);
  BORDE_ACTIVO.copy(ACTIVO).multiplyScalar(OSCURO_BORDE_ACTIVO);
  brilloActivo = BRILLO_ACTIVO * Math.min(1, LUMINANCIA_REFERENCIA / Math.max(luminancia(ACTIVO), 1e-3));
}

/** Una pieza que ocupa al menos esta parte de la planta del equipo es "grande" (ver `NodoAnimable.grande`). */
export const FRACCION_PIEZA_GRANDE = 0.5;
/** Resaltada, una pieza grande queda así de translúcida: se ve que es ella y se ve lo de adentro (#231). */
export const OPACIDAD_GRANDE_ACTIVA = 0.3;
/** Y brilla menos que una pieza chica: con tanta superficie, el brillo entero lava todo a celeste. */
const BRILLO_GRANDE = 0.45;

const DURACION = { mover: 750, girar: 750, fundido: 450, foco: 400, despiece: 650 };
const ESCALON_DESPIECE_MS = 70;

type MallaAnimable = {
  malla: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  /** LineDashedMaterial si la ubicación es incierta. */
  borde: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  incierta: boolean;
  /** De una tapa o carcasa: menos aristas, sin punteado, y casi sin bordes con el equipo abierto. */
  cubierta: boolean;
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
  /** Cuánto se mueve en el despiece completo, en ejes del padre (`despiezado`: capas en un equipo plano). */
  despiezado: Vec3;
  /** Tapa, puerta o carcasa: opaca con el equipo cerrado, translúcida cuando se abre. */
  cubierta: boolean;
  /**
   * Pieza grande (una cubierta, o que ocupa al menos `FRACCION_PIEZA_GRANDE` de la planta del equipo: el panel
   * frontal de una tablet, la carcasa trasera): resaltada no se rellena opaca, que taparía todo (#231).
   */
  grande: boolean;
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
  /** Qué piezas tapan el equipo (para `estadoInicial`: arranca cerrado). */
  cubiertas: Cubiertas;
  /** Fundido entre cerrado (0) y abierto (1). */
  apertura: Tween;
};


/** Gris de las piezas genéricas (`piezasGenericas`: el esqueleto del tipo las suma, el pack no las nombra). */
const GRIS_GENERICA = new THREE.Color("#8d96a1");

/** `genericas`: piezas que se pintan en gris, sin su receta (ver `piezasGenericas` en origen.ts). */
export function prepararEscena(
  plano: PlanoDePiezas,
  biblioteca?: BibliotecaPiezas,
  tipoEquipo?: string,
  genericas: ReadonlySet<string> = new Set(),
): EscenaPreparada {
  const { raiz, nodos, avisos } = construirEscena(plano, { biblioteca, tipoEquipo });
  const animables = new Map<string, NodoAnimable>();
  const ids = [...nodos.keys()];
  const profundidad = (id: string) => ancestrosDe(nodos.get(id)!, raiz).length;
  const enOrden = [...ids].sort((a, b) => profundidad(a) - profundidad(b) || ids.indexOf(a) - ids.indexOf(b));
  const despiece = despiezado(plano.piezas.map((p) => ({ id: p.pieza, centro: p.pos, dim: p.dim, padre: p.padre ?? null })));

  for (const [id, nodo] of nodos) {
    const padre = nodo.parent?.userData as Partial<DatosPieza> | undefined;
    animables.set(id, {
      id,
      nodo,
      principal: nodo.getObjectByName(id + SUFIJO_MALLA) as THREE.Mesh,
      mallas: mallasPropias(nodo).map((m) => prepararMalla(m, esIncierta(nodo.userData as DatosPieza), genericas.has(id), ES_CUBIERTA.test(id))),
      reposo: nodo.position.clone(),
      centroPadre: padre?.centro ?? null,
      ancestros: ancestrosDe(nodo, raiz),
      orden: enOrden.indexOf(id),
      despiezado: despiece.get(id) ?? [0, 0, 0],
      cubierta: ES_CUBIERTA.test(id),
      grande: false, // se calcula abajo, con la caja del equipo entero
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
  const planta = (c: THREE.Box3) => {
    const [a, b] = c.getSize(new THREE.Vector3()).toArray().sort((x, y) => y - x);
    return a * b;
  };
  const plantaEquipo = planta(caja);
  for (const a of animables.values()) {
    a.grande = a.cubierta || (!!a.principal && planta(new THREE.Box3().setFromObject(a.principal)) >= FRACCION_PIEZA_GRANDE * plantaEquipo);
  }
  const radio = Math.max(caja.getBoundingSphere(new THREE.Sphere()).radius, 1);
  const direccion = direccionDeCamara(caja.getSize(new THREE.Vector3()));
  const cubiertas: Cubiertas = {};
  for (const a of animables.values()) if (a.cubierta) cubiertas[a.id] = a.ancestros.length === 0 ? "raiz" : "tapa";
  return {
    raiz,
    nodos: animables,
    avisos,
    radio,
    piso: caja.min.y,
    despiece: { ultimo: 0, subiendo: true },
    direccion,
    cubiertas,
    apertura: crearTween([0]),
  };
}

/**
 * Como `prepararEscena`, pero si las piezas de Blender rompen algo, arma la escena con las
 * primitivas (cajas y cilindros) y lo avisa: el 3D nunca queda vacío por culpa del GLB.
 */
export function prepararEscenaSegura(
  plano: PlanoDePiezas,
  biblioteca?: BibliotecaPiezas | null,
  tipoEquipo?: string,
  genericas?: ReadonlySet<string>,
): EscenaPreparada {
  if (!biblioteca) return prepararEscena(plano, undefined, tipoEquipo, genericas);
  try {
    return prepararEscena(plano, biblioteca, tipoEquipo, genericas);
  } catch (e) {
    console.warn("[visor] las piezas de Blender fallaron, uso primitivas:", e);
    const escena = prepararEscena(plano, undefined, tipoEquipo, genericas);
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

function prepararMalla(m: THREE.Mesh, incierta: boolean, generica = false, cubierta = false): MallaAnimable {
  const malla = m as MallaAnimable["malla"];
  const mat = malla.material;
  if (generica) {
    mat.color.copy(GRIS_GENERICA);
    mat.metalness = 0.1;
    mat.roughness = 0.7;
  }
  mat.emissive.copy(ACTIVO);
  mat.emissiveIntensity = 0;
  // Una carcasa tiene biseles, nervios y rejillas: con 30° era una maraña de líneas finas al abrirla.
  const geometria = new THREE.EdgesGeometry(malla.geometry, cubierta ? ANGULO_BORDES_CUBIERTA : ANGULO_BORDES);
  let material: THREE.LineBasicMaterial;
  if (incierta && !cubierta) {
    geometria.computeBoundingBox();
    const lado = geometria.boundingBox!.getSize(new THREE.Vector3()).toArray().reduce((a, b) => Math.max(a, b), 0);
    const trazo = Math.min(Math.max(lado * TRAZO_PUNTEADO, 0.3), 3);
    material = new THREE.LineDashedMaterial({ color: BORDE, transparent: true, opacity: 0.6, dashSize: trazo, gapSize: trazo * 0.7 });
  } else {
    material = new THREE.LineBasicMaterial({ color: BORDE, transparent: true, opacity: 0.6 });
  }
  const borde = new THREE.LineSegments(geometria, material);
  if (incierta && !cubierta) borde.computeLineDistances(); // sin esto, el punteado no se dibuja
  borde.name = `${malla.name}__borde`;
  borde.raycast = () => {};
  malla.add(borde);
  return {
    malla,
    borde,
    incierta,
    cubierta,
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
  const soloGrandes = activos.size > 0 && [...activos].every((id) => escena.nodos.get(id)?.grande);
  const latido = 1 + 0.25 * Math.sin(ahora / 260);
  const [apertura] = seguir(escena.apertura, [estado.abierto ? 1 : 0], ahora, DURACION.fundido);
  const total = escena.nodos.size;

  for (const [id, a] of escena.nodos) {
    const e = estado.piezas[id];
    if (!e) continue;

    // Posición y giro.
    const escalon = escena.despiece.subiendo ? a.orden : total - 1 - a.orden;
    const despiece = seguir(
      a.tw.despiece,
      a.despiezado.map((v) => v * estado.despiece) as Vec3,
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
    // Si lo resaltado es solo una pieza grande (el panel, la carcasa), lo de adentro sigue a la vista (#231);
    // las otras grandes sí pasan a fantasma: la tapa trasera sólida taparía el panel frontal resaltado.
    const esFantasma = activos.size > 0 && (!soloGrandes || a.grande) && !esActiva && !a.ancestros.some((p) => activos.has(p));
    const [foco] = seguir(a.tw.foco, [esActiva ? 1 : 0], ahora, DURACION.foco);
    const [fantasma] = seguir(a.tw.fantasma, [esFantasma ? 1 : 0], ahora, DURACION.foco);
    const [visible] = seguir(a.tw.visible, [e.visible ? 1 : 0], ahora, DURACION.fundido);

    for (const m of a.mallas) pintar(m, foco, fantasma, visible, latido, a.cubierta ? 1 - apertura : null, a.grande);
  }
}

/** Una cubierta con el equipo abierto se ve así de translúcida como mucho (aunque su receta sea opaca, ej. una puerta). */
const OPACIDAD_CUBIERTA_ABIERTA = 0.12;
/** Con el equipo abierto, los bordes de una tapa o carcasa se ven a esta fracción: no tapan lo de adentro. */
const BORDE_CUBIERTA_ABIERTA = 0.45;

/**
 * `cerrada`: null si no es una cubierta; si lo es, 1 = equipo cerrado (opaca aunque su receta o su
 * la hagan translúcida) y 0 = abierto (translúcida, para ver adentro).
 */
function pintar(
  m: MallaAnimable,
  foco: number,
  fantasma: number,
  visible: number,
  latido: number,
  cubierta: number | null = null,
  grande = false,
) {
  const cerrada = cubierta ?? 0;
  const mat = m.malla.material;
  mat.color.copy(m.color).lerp(FANTASMA, fantasma).lerp(ACTIVO, foco);
  mat.metalness = lerp(m.metalness, 0.1, foco);
  mat.roughness = lerp(m.roughness, 0.45, foco);
  mat.emissiveIntensity = foco * brilloActivo * latido * (grande ? BRILLO_GRANDE : 1);

  // Una pieza chica resaltada se ve sólida; una grande, translúcida con contorno: no tapa lo de adentro (#231).
  const base = cubierta === null ? m.opacidad : lerp(Math.min(m.opacidad, OPACIDAD_CUBIERTA_ABIERTA), 1, cerrada);
  const opacidad = lerp(lerp(base, OPACIDAD_FANTASMA, fantasma), grande ? OPACIDAD_GRANDE_ACTIVA : 1, foco) * visible;
  mat.opacity = opacidad;
  const transparente = (m.transparente && cerrada < 0.999) || opacidad < 0.999;
  if (mat.transparent !== transparente) {
    mat.transparent = transparente;
    mat.needsUpdate = true;
  }
  mat.depthWrite = !transparente;
  m.malla.visible = opacidad > 0.01;

  const b = m.borde.material;
  // El contorno de una pieza grande resaltada va en el color de resaltado pleno: es lo que la marca.
  b.color.copy(BORDE).lerp(BORDE_FANTASMA, fantasma).lerp(grande ? ACTIVO : BORDE_ACTIVO, foco);
  // El punteado se marca un poco más que el borde sólido: es la señal de "no verificado".
  const punteado = m.incierta && !m.cubierta;
  const bordeCubierta = m.cubierta && cubierta !== null ? lerp(BORDE_CUBIERTA_ABIERTA, 1, cerrada) : 1;
  b.opacity = lerp(lerp(punteado ? 0.45 : 0.22, 0.4, fantasma), grande ? 1 : punteado ? 0.85 : 0.7, foco) * visible * (grande ? lerp(bordeCubierta, 1, foco) : bordeCubierta);
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

/** Radio mínimo con que se encuadra una pieza (su entorno), en cm: en un equipo grande. */
const ENTORNO_PIEZA_CM = 12;
/** En un equipo chico, el entorno mínimo es esta parte de su radio (un celular: ~4 cm alrededor de la pieza). */
const FRACCION_ENTORNO_PIEZA = 0.45;

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
/** Con el despiece, el radio del equipo entero se toma casi completo (sin recortar las puntas). */
const MARGEN_DESPIECE = 1;

/** La caja del equipo con cada pieza donde la deja el despiece (`cantidad`), sin moverlas de verdad. */
export function cajaDespiezada(escena: EscenaPreparada, cantidad: number): THREE.Box3 {
  const antes = new Map<NodoAnimable, THREE.Vector3>();
  for (const a of escena.nodos.values()) {
    antes.set(a, a.nodo.position.clone());
    a.nodo.position.set(a.reposo.x + a.despiezado[0] * cantidad, a.reposo.y + a.despiezado[1] * cantidad, a.reposo.z + a.despiezado[2] * cantidad);
  }
  escena.raiz.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(escena.raiz);
  for (const [a, p] of antes) a.nodo.position.copy(p);
  escena.raiz.updateMatrixWorld(true);
  return caja;
}

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
  // Despiezado, el equipo entero se mide con cada pieza en su lugar final (no un margen fijo): lo que se
  // abre hacia los costados (los aros de un parlante, las capas de un celular) entra en la pantalla.
  const cajaEquipo = () => (despiece > 0 ? cajaDespiezada(escena, despiece) : new THREE.Box3().setFromObject(escena.raiz));
  const caja = nodo === escena.raiz ? cajaEquipo() : new THREE.Box3().setFromObject(nodo);
  const esfera = caja.getBoundingSphere(new THREE.Sphere());
  // Una pieza se encuadra con su entorno para que se entienda dónde está.
  // Con el despiece las piezas suben y se abren: se deja más margen.
  // Un equipo alto (heladera) tiene que entrar entero a lo alto; uno chato (notebook) no cambia.
  // En una pantalla vertical (celular) la vista general va con el radio entero: con 0,8 un celular se salía por los costados.
  // Una pieza nunca se encuadra más lejos que el equipo entero. El mínimo (para que se vea su entorno) es
  // 12 cm en un equipo grande, pero en uno chico es una parte del equipo (`FRACCION_ENTORNO_PIEZA`): con
  // 12 cm, un conector de celular quedaba como un puntito al borde del celular entero (prueba real).
  const { width, height } = tamPantalla;
  const ajusteGeneral = width < height ? 1 : 0.8;
  // Despiezado no se recorta nada (en horizontal, 0,8 cortaba las puntas del despiece).
  const ajuste = despiece > 0 ? Math.max(ajusteGeneral, MARGEN_DESPIECE) : ajusteGeneral;
  const radioGeneral = (c: THREE.Box3, e: THREE.Sphere) => Math.max(e.radius * ajuste, (c.getSize(new THREE.Vector3()).y / 2) * 1.15);
  let radio: number;
  if (nodo === escena.raiz) radio = radioGeneral(caja, esfera);
  else {
    const equipo = cajaEquipo();
    const esferaEquipo = equipo.getBoundingSphere(new THREE.Sphere());
    const entorno = Math.min(ENTORNO_PIEZA_CM, esferaEquipo.radius * FRACCION_ENTORNO_PIEZA);
    radio = Math.min(Math.max(esfera.radius * 2.6, entorno), radioGeneral(equipo, esferaEquipo));
  }
  const objetivoPos = esfera.center;
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
 * Para cambiar de lado al girar, el lado actual tiene que pasarse del lienzo por más que esto Y el otro
 * tiene que entrar al menos esto mejor (px): un cambio claro, no por unos píxeles.
 */
export const MARGEN_CAMBIO_ETIQUETA = 40;
/** Y nunca dos cambios de lado (en el mismo eje) en menos que esto (ms): la etiqueta no "baila". */
export const TIEMPO_MIN_LADO_MS = 1000;
/** Suavizado del movimiento de la etiqueta (ms): llega al 63 % del camino en este tiempo. */
const SUAVIZADO_ETIQUETA_MS = 90;

/** Cuándo cambió de lado por última vez cada eje (ms), para `TIEMPO_MIN_LADO_MS`. */
export type CambioLado = { h: number; v: number };

export type UbicacionEtiqueta = {
  lado: LadoEtiqueta;
  /** Cuándo cambió de lado cada eje (lo que hay que pasar en el próximo cuadro). */
  cambio: CambioLado;
  /** Esquina superior izquierda del recuadro, en px relativos a la pieza (`ancla`). */
  caja: { x: number; y: number };
  /** Punta de la línea guía (la esquina del recuadro más cercana a la pieza), relativa a la pieza. */
  punta: { x: number; y: number };
};

/**
 * Dónde dibujar la etiqueta: el lado de `ladoEtiqueta` la primera vez y después el mismo, salvo un cambio
 * claro (el actual se pasa por más de `MARGEN_CAMBIO_ETIQUETA` y el otro entra por lo menos eso mejor) y
 * nunca dos cambios en menos de `TIEMPO_MIN_LADO_MS` (con `tiempo`). Al girar el modelo no salta de lado
 * en lado. Siempre ADENTRO del lienzo y debajo de la franja reservada (si no entra, se corre hasta que
 * entre: nunca se corta en el borde).
 */
export function colocarEtiqueta(
  ancla: { x: number; y: number },
  etiqueta: { ancho: number; alto: number },
  lienzo: { width: number; height: number },
  reservadoArriba = 0,
  anterior?: LadoEtiqueta,
  tiempo?: { ahora: number; cambio: CambioLado },
): UbicacionEtiqueta {
  const { dx, dy } = LINEA_ETIQUETA;
  const M = MARGEN_ETIQUETA;
  const sobra = {
    arriba: ancla.y - dy - etiqueta.alto - (reservadoArriba + M),
    abajo: lienzo.height - M - (ancla.y + dy + etiqueta.alto),
    derecha: lienzo.width - M - (ancla.x + dx + etiqueta.ancho),
    izquierda: ancla.x - dx - etiqueta.ancho - M,
  };
  const nuevo = ladoEtiqueta(ancla, etiqueta, lienzo, reservadoArriba);
  const ahora = tiempo?.ahora ?? 0;
  const cambio: CambioLado = { ...(tiempo?.cambio ?? { h: -Infinity, v: -Infinity }) };
  const eje = <K extends "h" | "v">(k: K): LadoEtiqueta[K] => {
    const actual = anterior?.[k];
    const candidato = nuevo[k];
    if (!actual) return candidato;
    const claro = sobra[actual] < -MARGEN_CAMBIO_ETIQUETA && sobra[candidato] - sobra[actual] > MARGEN_CAMBIO_ETIQUETA;
    const pasoElTiempo = !tiempo || ahora - cambio[k] >= TIEMPO_MIN_LADO_MS;
    if (candidato === actual || !claro || !pasoElTiempo) return actual;
    cambio[k] = ahora;
    return candidato;
  };
  const lado: LadoEtiqueta = { v: eje("v"), h: eje("h") };
  const sx = lado.h === "derecha" ? 1 : -1;
  const sy = lado.v === "arriba" ? -1 : 1;
  // Recuadro en el lado elegido y, si igual se sale, corrido hasta que entre (en px del lienzo).
  const x0 = ancla.x + (sx > 0 ? dx : -dx - etiqueta.ancho);
  const y0 = ancla.y + (sy < 0 ? -dy - etiqueta.alto : dy);
  const dentro = (v: number, min: number, max: number) => (max < min ? min : Math.min(Math.max(v, min), max));
  const x = dentro(x0, M, lienzo.width - M - etiqueta.ancho);
  const y = dentro(y0, reservadoArriba + M, lienzo.height - M - etiqueta.alto);
  const caja = { x: x - ancla.x, y: y - ancla.y };
  return {
    lado,
    cambio,
    caja,
    punta: { x: sx > 0 ? caja.x : caja.x + etiqueta.ancho, y: sy < 0 ? caja.y + etiqueta.alto : caja.y },
  };
}

/** Un paso del suavizado de la etiqueta: de `actual` hacia `objetivo` según el tiempo del cuadro (sin `actual`, salta). */
export function suavizar(actual: { x: number; y: number } | null, objetivo: { x: number; y: number }, dtMs: number) {
  if (!actual) return objetivo;
  const k = 1 - Math.exp(-Math.max(dtMs, 0) / SUAVIZADO_ETIQUETA_MS);
  return { x: actual.x + (objetivo.x - actual.x) * k, y: actual.y + (objetivo.y - actual.y) * k };
}

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

/** Recuadro de una etiqueta en px del lienzo. */
export type RectEtiqueta = { x: number; y: number; ancho: number; alto: number };
/** Separación mínima entre dos etiquetas (px). */
const SEPARACION_ETIQUETAS = 4;

/**
 * Varias piezas resaltadas a la vez: que sus etiquetas no se pisen (#179). En orden, cada recuadro que
 * choca con uno ya puesto se corre en vertical lo mínimo (arriba o abajo de alguno de los puestos) sin
 * salirse del lienzo ni meterse en la franja reservada. Si no hay lugar libre, queda donde estaba.
 */
export function separarEtiquetas(rects: RectEtiqueta[], lienzo: { width: number; height: number }, reservadoArriba = 0): RectEtiqueta[] {
  const S = SEPARACION_ETIQUETAS;
  const choca = (a: RectEtiqueta, b: RectEtiqueta) =>
    a.x < b.x + b.ancho + S && b.x < a.x + a.ancho + S && a.y < b.y + b.alto + S && b.y < a.y + a.alto + S;
  const minY = reservadoArriba + MARGEN_ETIQUETA;
  const puestos: RectEtiqueta[] = [];
  for (const r of rects) {
    if (puestos.some((p) => choca(r, p))) {
      const opciones = puestos
        .flatMap((p) => [p.y + p.alto + S, p.y - r.alto - S])
        .filter((y) => y >= minY && y + r.alto <= lienzo.height - MARGEN_ETIQUETA)
        .sort((a, b) => Math.abs(a - r.y) - Math.abs(b - r.y));
      const y = opciones.find((y) => !puestos.some((p) => choca({ ...r, y }, p)));
      puestos.push(y === undefined ? r : { ...r, y });
    } else puestos.push(r);
  }
  return puestos;
}
