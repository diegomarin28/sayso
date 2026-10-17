import * as THREE from "three";
import type { Vec3 } from "../../shared";

/**
 * Biblioteca de piezas genéricas por TIPO (ventilador, ram, batería…), modelada en Blender
 * (`assets/models/blender/piezas.py` → `public/models/piezas.glb`).
 * No tiene datos de ningún equipo: el plano dice dónde va cada pieza y cuánto mide, y acá
 * solo se elige una forma típica y se ajusta a esas medidas.
 */

/** Material de la parte que es "la pieza" (lleva la receta propia del id). El resto son recetas de detalle. */
export const RECETA_CUERPO = "cuerpo";

export type ParteModelo = { geometria: THREE.BufferGeometry; receta: string };
export type ModeloPieza = { partes: ParteModelo[]; caja: THREE.Box3 };
export type BibliotecaPiezas = Map<string, ModeloPieza>;

/**
 * Arma la biblioteca desde la escena del GLB: cada hijo de la raíz es un tipo y sus mallas son
 * las partes. La receta sale del nombre del material, antes del punto (`cuerpo.ventilador` → `cuerpo`).
 */
export function bibliotecaDesdeEscena(escena: THREE.Object3D): BibliotecaPiezas {
  escena.updateMatrixWorld(true);
  const biblioteca: BibliotecaPiezas = new Map();
  for (const tipo of escena.children) {
    const aLocal = tipo.matrixWorld.clone().invert();
    const partes: ParteModelo[] = [];
    tipo.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const geometria = (o.geometry as THREE.BufferGeometry).clone();
      geometria.applyMatrix4(new THREE.Matrix4().multiplyMatrices(aLocal, o.matrixWorld));
      const material = Array.isArray(o.material) ? o.material[0] : o.material;
      partes.push({ geometria, receta: material?.name?.split(".")[0] || RECETA_CUERPO });
    });
    if (partes.length === 0) continue;
    const caja = new THREE.Box3();
    for (const p of partes) {
      p.geometria.computeBoundingBox();
      caja.union(p.geometria.boundingBox!);
    }
    biblioteca.set(tipo.name, { partes, caja });
  }
  return biblioteca;
}

/** El tipo cuyo nombre es el prefijo más largo del id (`tornillos_ventilador` → `tornillo`). */
export function modeloPara(pieza: string, biblioteca?: BibliotecaPiezas): ModeloPieza | undefined {
  if (!biblioteca) return undefined;
  let mejor: string | undefined;
  for (const tipo of biblioteca.keys()) {
    if (pieza.startsWith(tipo) && (!mejor || tipo.length > mejor.length)) mejor = tipo;
  }
  return mejor ? biblioteca.get(mejor) : undefined;
}

/** Si los dos lados de la planta difieren en más que esto, se respeta la orientación. */
const ASPECTO_MINIMO = 1.25;

/**
 * Copia las partes del modelo centradas en el origen y estiradas para que el conjunto mida
 * exactamente `dim`. Si el plano pone la pieza "acostada" al revés que el modelo (ej. una RAM
 * más profunda que ancha), primero la gira 90° para no deformarla.
 */
export function partesAjustadas(modelo: ModeloPieza, dim: Vec3): ParteModelo[] {
  const tam = modelo.caja.getSize(new THREE.Vector3());
  const centro = modelo.caja.getCenter(new THREE.Vector3());
  const [ancho, alto, prof] = dim.map((v) => Math.max(v, 0.01)) as Vec3;
  const alargada = (a: number, b: number) => Math.max(a, b) / Math.min(a, b) >= ASPECTO_MINIMO;
  const girar = alargada(tam.x, tam.z) && alargada(ancho, prof) && tam.x > tam.z !== ancho > prof;

  const m = new THREE.Matrix4().makeTranslation(-centro.x, -centro.y, -centro.z);
  if (girar) m.premultiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  const [sx, sz] = girar ? [tam.z, tam.x] : [tam.x, tam.z];
  m.premultiply(new THREE.Matrix4().makeScale(ancho / Math.max(sx, 1e-6), alto / Math.max(tam.y, 1e-6), prof / Math.max(sz, 1e-6)));

  return modelo.partes.map((p) => ({ receta: p.receta, geometria: p.geometria.clone().applyMatrix4(m) }));
}
