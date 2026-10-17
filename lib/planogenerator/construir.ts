import * as THREE from "three";
import type { PiezaPlano, PlanoDePiezas, Vec3 } from "../../shared";
import { RECETA_CUERPO, modeloPara, partesAjustadas, type BibliotecaPiezas } from "./biblioteca";
import { SUFIJO_DETALLE, agregarDetalles } from "./detalles";
import { materialDeParte, materialPara } from "./materiales";

/**
 * Construye la escena three.js a partir de un PlanoDePiezas.
 *
 * Convención de coordenadas (unidades: cm):
 * - x a la derecha, y hacia arriba, z hacia el frente (donde está la persona).
 * - `pos` es el CENTRO de la pieza en coordenadas del mundo (no relativo al padre).
 * - `pivote` es el punto de giro, relativo al centro de la pieza.
 * - `padre` solo define la jerarquía: si el padre se mueve, el hijo lo acompaña.
 *
 * Estructura de cada pieza:
 *   Group (name = id de la pieza, ubicado en el pivote)  ← esto anima el reproductor
 *     └─ Mesh (name = `${id}__malla`, desplazada -pivote)
 *          └─ Meshes de detalle (`${id}__malla__detalle_N`: aspas, chips…), opcionales
 *
 * Con `biblioteca` (piezas.glb), cada pieza cuyo id empieza con un tipo de la biblioteca usa esa
 * forma ajustada a `dim`: la malla principal es el cuerpo y las demás partes son detalles.
 * Sin biblioteca (o tipo desconocido) se usa la primitiva de `forma` con detalles hechos en código.
 *     └─ Groups de las piezas hijas
 */

export const SUFIJO_MALLA = "__malla";

export type DatosPieza = {
  pieza: string;
  dim: Vec3;
  /** Centro de la pieza en el mundo, tal como vino en el plano. */
  centro: Vec3;
  etiquetaManual?: string;
  cita?: PiezaPlano["cita"];
};

export type EscenaConstruida = {
  raiz: THREE.Group;
  /** Nodo animable de cada pieza, por id. */
  nodos: Map<string, THREE.Group>;
  /** Problemas del plano que se toleraron (ids repetidos, padres que no existen, ciclos). */
  avisos: string[];
};

export type OpcionesEscena = { biblioteca?: BibliotecaPiezas };

export function construirEscena(plano: PlanoDePiezas, opciones: OpcionesEscena = {}): EscenaConstruida {
  const raiz = new THREE.Group();
  raiz.name = "plano";
  raiz.userData = { modelo: plano.modelo, unidades: plano.unidades };

  const nodos = new Map<string, THREE.Group>();
  const piezas = new Map<string, PiezaPlano>();
  const avisos: string[] = [];

  for (const p of plano.piezas) {
    if (piezas.has(p.pieza)) {
      avisos.push(`Pieza repetida "${p.pieza}": se usa la primera.`);
      continue;
    }
    piezas.set(p.pieza, p);
    nodos.set(p.pieza, crearNodo(p, opciones.biblioteca));
  }

  for (const [id, p] of piezas) {
    const nodo = nodos.get(id)!;
    const padreId = resolverPadre(p, piezas, avisos);
    const padre = padreId ? nodos.get(padreId)! : raiz;
    const pivotePadre = padreId ? puntoDeGiro(piezas.get(padreId)!) : ([0, 0, 0] as Vec3);
    const propio = puntoDeGiro(p);
    nodo.position.set(
      propio[0] - pivotePadre[0],
      propio[1] - pivotePadre[1],
      propio[2] - pivotePadre[2],
    );
    padre.add(nodo);
  }

  return { raiz, nodos, avisos };
}

/** Punto de giro en coordenadas del mundo. */
function puntoDeGiro(p: PiezaPlano): Vec3 {
  return [p.pos[0] + p.pivote[0], p.pos[1] + p.pivote[1], p.pos[2] + p.pivote[2]];
}

/** Devuelve el id del padre si es válido; si no existe o forma un ciclo, cuelga de la raíz. */
function resolverPadre(
  p: PiezaPlano,
  piezas: Map<string, PiezaPlano>,
  avisos: string[],
): string | undefined {
  if (!p.padre) return undefined;
  if (!piezas.has(p.padre)) {
    avisos.push(`"${p.pieza}" tiene como padre "${p.padre}", que no existe: se cuelga de la raíz.`);
    return undefined;
  }
  const vistos = new Set([p.pieza]);
  let actual: string | undefined = p.padre;
  while (actual) {
    if (actual === p.pieza) {
      avisos.push(`Ciclo de padres en "${p.pieza}": se cuelga de la raíz.`);
      return undefined;
    }
    // Un ciclo más arriba que no incluye a esta pieza lo resuelven las piezas del ciclo.
    if (vistos.has(actual)) break;
    vistos.add(actual);
    const siguiente: string | undefined = piezas.get(actual)?.padre;
    actual = siguiente && piezas.has(siguiente) ? siguiente : undefined;
  }
  return p.padre;
}

function crearNodo(p: PiezaPlano, biblioteca?: BibliotecaPiezas): THREE.Group {
  const nodo = new THREE.Group();
  nodo.name = p.pieza;
  const datos: DatosPieza = {
    pieza: p.pieza,
    dim: p.dim,
    centro: p.pos,
    etiquetaManual: p.etiquetaManual,
    cita: p.cita,
  };
  nodo.userData = datos;

  const modelo = modeloPara(p.pieza, biblioteca);
  const malla = modelo ? mallaDeBiblioteca(p, partesAjustadas(modelo, p.dim)) : new THREE.Mesh(crearGeometria(p), materialPara(p.pieza));
  malla.name = p.pieza + SUFIJO_MALLA;
  malla.position.set(-p.pivote[0], -p.pivote[1], -p.pivote[2]);
  malla.castShadow = true;
  malla.receiveShadow = true;
  if (!modelo) agregarDetalles(p.pieza, malla, p.dim);
  nodo.add(malla);
  return nodo;
}

/** Cuerpo como malla principal y el resto de las partes como detalles (mismo origen, ya ajustadas). */
function mallaDeBiblioteca(p: PiezaPlano, partes: ReturnType<typeof partesAjustadas>): THREE.Mesh {
  const i = Math.max(partes.findIndex((x) => x.receta === RECETA_CUERPO), 0);
  const malla = new THREE.Mesh(partes[i].geometria, materialDeParte(p.pieza, partes[i].receta));
  partes.forEach((parte, j) => {
    if (j === i) return;
    const d = new THREE.Mesh(parte.geometria, materialDeParte(p.pieza, parte.receta));
    d.name = `${p.pieza}${SUFIJO_MALLA}${SUFIJO_DETALLE}_${malla.children.length}`;
    d.castShadow = true;
    d.receiveShadow = true;
    malla.add(d);
  });
  return malla;
}

/** Geometría centrada en el origen con las medidas exactas de `dim` (ancho, alto, profundidad). */
export function crearGeometria(p: Pick<PiezaPlano, "forma" | "dim">): THREE.BufferGeometry {
  const [ancho, alto, prof] = p.dim.map((v) => Math.max(v, 0.01)) as Vec3;
  switch (p.forma) {
    case "caja":
      return new THREE.BoxGeometry(ancho, alto, prof);
    case "cilindro": {
      const g = new THREE.CylinderGeometry(ancho / 2, ancho / 2, alto, 40);
      if (prof !== ancho) g.scale(1, 1, prof / ancho);
      return g;
    }
    case "extrusion": {
      // Rectángulo de esquinas redondeadas extruido hacia arriba.
      const r = Math.min(Math.max(Math.min(ancho, prof) * 0.08, 0.05), 1.5);
      const forma = rectanguloRedondeado(ancho, prof, r);
      const g = new THREE.ExtrudeGeometry(forma, { depth: alto, bevelEnabled: false, curveSegments: 8 });
      g.rotateX(-Math.PI / 2); // la extrusión pasa de +z a +y
      g.translate(0, -alto / 2, 0);
      return g;
    }
  }
}

function rectanguloRedondeado(ancho: number, prof: number, r: number): THREE.Shape {
  const x = -ancho / 2;
  const y = -prof / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + ancho - r, y);
  s.quadraticCurveTo(x + ancho, y, x + ancho, y + r);
  s.lineTo(x + ancho, y + prof - r);
  s.quadraticCurveTo(x + ancho, y + prof, x + ancho - r, y + prof);
  s.lineTo(x + r, y + prof);
  s.quadraticCurveTo(x, y + prof, x, y + prof - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
