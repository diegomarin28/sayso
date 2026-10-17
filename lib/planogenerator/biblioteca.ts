import * as THREE from "three";
import { z } from "zod";
import type { Vec3 } from "../../shared";

/**
 * Biblioteca de piezas genéricas por TIPO (ventilador, ram, batería, compresor, carcasa…), modelada en
 * Blender (`assets/models/blender/piezas.py` → `public/models/piezas/<familia>.glb` + `indice.json`).
 * No tiene datos de ningún equipo: el plano dice dónde va cada pieza y cuánto mide, y acá
 * solo se elige una forma típica y se ajusta a esas medidas.
 */

/** Material de la parte que es "la pieza" (lleva la receta propia del id). El resto son recetas de detalle. */
export const RECETA_CUERPO = "cuerpo";

export type ParteModelo = { geometria: THREE.BufferGeometry; receta: string };
/** `equipos`: palabras de los equipos para los que es la forma (del GLB); vacío = cualquiera. */
export type ModeloPieza = { partes: ParteModelo[]; caja: THREE.Box3; equipos?: string[] };
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
    const equipos = typeof tipo.userData.equipos === "string" ? palabras(tipo.userData.equipos) : [];
    biblioteca.set(tipo.name, { partes, caja, equipos });
  }
  return biblioteca;
}

/** Un tipo puede tener variantes en el GLB: `bateria` (notebook) y `bateria@celular` son el mismo tipo. */
export const SEPARADOR_VARIANTE = "@";
export const tipoDe = (nombre: string) => nombre.split(SEPARADOR_VARIANTE)[0];

/** El tipo cuyo nombre es el prefijo más largo del id (`tornillos_ventilador` → `tornillo`), entre esos nombres. */
export function tipoPara(pieza: string, nombres: Iterable<string>): string | undefined {
  let mejor: string | undefined;
  for (const nombre of nombres) {
    const tipo = tipoDe(nombre);
    if (pieza.startsWith(tipo) && (!mejor || tipo.length > mejor.length)) mejor = tipo;
  }
  return mejor;
}

/** `public/models/piezas/indice.json`, lo escribe el script de Blender: qué familia (GLB) tiene cada tipo. */
export const IndicePiezas = z.object({
  familias: z.record(z.string(), z.string()),
  tipos: z.record(z.string(), z.object({ familia: z.string(), descripcion: z.string(), equipos: z.string() })),
});
export type IndicePiezas = z.infer<typeof IndicePiezas>;

/**
 * Los GLB que hay que bajar para estos ids: la familia de cada variante del tipo de cada id (las
 * variantes pueden estar en familias distintas y hay que tenerlas todas para elegir). Un id sin tipo
 * no pide nada: se dibuja con la primitiva.
 */
export function archivosPara(ids: Iterable<string>, indice: IndicePiezas): string[] {
  const nombres = Object.keys(indice.tipos);
  const familias = new Set<string>();
  for (const id of ids) {
    const tipo = tipoPara(id, nombres);
    if (!tipo) continue;
    for (const n of nombres) if (tipoDe(n) === tipo) familias.add(indice.tipos[n].familia);
  }
  return [...familias].flatMap((f) => (indice.familias[f] ? [indice.familias[f]] : []));
}


/** Minúsculas, sin tildes, separado en palabras: "Teléfono celular" → ["telefono", "celular"]. */
export function palabras(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** ¿El tipo de equipo (texto libre de la recepción) nombra alguno de los equipos de la variante? */
function esPara(modelo: ModeloPieza, equipo: string[]): boolean {
  return (modelo.equipos ?? []).some((e) => equipo.some((p) => p.startsWith(e)));
}

/**
 * El tipo cuyo nombre es el prefijo más largo del id (`tornillos_ventilador` → `tornillo`).
 * Si el tipo tiene variantes:
 * - con `tipoEquipo` (texto libre de la recepción, ej. "celular Samsung") que nombra un equipo que la
 *   biblioteca conoce, se descartan las variantes marcadas para otro equipo (las sin marca quedan);
 * - con `dim`, de las que quedan, la que menos se deforma (una batería de 26 cm usa la de notebook;
 *   una de 6 cm, la de celular). Sin `dim`, la base.
 */
export function modeloPara(pieza: string, biblioteca?: BibliotecaPiezas, dim?: Vec3, tipoEquipo?: string): ModeloPieza | undefined {
  if (!biblioteca) return undefined;
  const mejor = tipoPara(pieza, biblioteca.keys());
  if (!mejor) return undefined;
  let variantes = [...biblioteca].filter(([nombre]) => tipoDe(nombre) === mejor);
  const equipo = tipoEquipo ? palabras(tipoEquipo) : [];
  // Solo si la biblioteca conoce ese equipo (alguna variante lo nombra): "MacBook" no descarta nada.
  if (equipo.length && [...biblioteca.values()].some((m) => esPara(m, equipo))) {
    const aplicables = variantes.filter(([, m]) => !m.equipos?.length || esPara(m, equipo));
    if (aplicables.length) variantes = aplicables;
  }
  if (!dim || variantes.length === 1) return (variantes.find(([nombre]) => nombre === mejor) ?? variantes[0])[1];
  return variantes.reduce((a, b) => (deformacion(b[1], dim) < deformacion(a[1], dim) ? b : a))[1];
}

/** Si los dos lados de la planta difieren en más que esto, se respeta la orientación. */
const MEJORA_MINIMA = 2 * Math.log(1.25);

/** Las 6 formas de apoyar una caja: qué eje del modelo va a cada eje del plano (x, y, z). La primera es "como está". */
const ORIENTACIONES: Vec3[] = [
  [0, 1, 2],
  [2, 1, 0],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
];

const costo = (tam: number[], dim: number[], o: Vec3) =>
  o.reduce((s, eje, i) => s + Math.abs(Math.log(dim[i] / Math.max(tam[eje], 0.01))), 0);

/** La orientación que menos deforma; la del modelo salvo que otra mejore claramente (si no, dejaría de verse "derecha"). */
function orientacion(tam: number[], dim: number[]): Vec3 {
  const mejor = ORIENTACIONES.reduce((a, b) => (costo(tam, dim, b) < costo(tam, dim, a) ? b : a));
  return costo(tam, dim, ORIENTACIONES[0]) - costo(tam, dim, mejor) > MEJORA_MINIMA ? mejor : ORIENTACIONES[0];
}

const ejes = (v: THREE.Vector3) => [v.x, v.y, v.z];
const medidas = (dim: Vec3) => dim.map((v) => Math.max(v, 0.01));

/**
 * Cuánto hay que estirar el modelo para que mida `dim`, en la orientación en que se va a dibujar:
 * suma de |log(escala)| por eje. Los modelos están en cm reales, así que cuenta el tamaño y la proporción: 0 = calza justo.
 */
export function deformacion(modelo: ModeloPieza, dim: Vec3): number {
  const tam = ejes(modelo.caja.getSize(new THREE.Vector3()));
  const d = medidas(dim);
  return costo(tam, d, orientacion(tam, d));
}

/**
 * Copia las partes del modelo centradas en el origen y estiradas para que el conjunto mida
 * exactamente `dim`. Si el plano pone la pieza en otra posición que el modelo (una RAM más
 * profunda que ancha, un ventilador parado en vez de acostado), primero la gira para no deformarla.
 */
export function partesAjustadas(modelo: ModeloPieza, dim: Vec3): ParteModelo[] {
  const tam = ejes(modelo.caja.getSize(new THREE.Vector3()));
  const centro = modelo.caja.getCenter(new THREE.Vector3());
  const d = medidas(dim);
  const o = orientacion(tam, d);

  // Rotación de 90° que lleva el eje o[i] del modelo al eje i del plano (sin espejar).
  const rot = new THREE.Matrix4().makeBasis(
    ...([0, 1, 2].map((j) => new THREE.Vector3(...(o.map((eje) => (eje === j ? 1 : 0)) as Vec3))) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]),
  );
  if (rot.determinant() < 0) rot.premultiply(new THREE.Matrix4().makeScale(-1, 1, 1));

  const m = new THREE.Matrix4().makeTranslation(-centro.x, -centro.y, -centro.z);
  m.premultiply(rot);
  m.premultiply(new THREE.Matrix4().makeScale(...(o.map((eje, i) => d[i] / Math.max(tam[eje], 1e-6)) as Vec3)));
  return modelo.partes.map((p) => ({ receta: p.receta, geometria: p.geometria.clone().applyMatrix4(m) }));
}
