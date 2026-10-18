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

/** Eje del modelo en el GLB: 0 = x (derecha), 1 = y (arriba), 2 = z (frente). */
export type Eje = 0 | 1 | 2;

/**
 * Cómo se ajusta una forma a las medidas del plano. Es propiedad de la FORMA (la declara el script
 * de Blender en `AJUSTES` y viene en el GLB como `extras.ajuste`); dónde va la pieza y cuánto lugar
 * ocupa lo dice el plano. Así un ventilador sigue redondo aunque el plano le dé un hueco de 6×9.
 * - `libre`: se estira por eje (cajas que de verdad cambian de proporción: placas, baterías, carcasas).
 * - `proporcional`: escala igual en los tres ejes, lo más grande que entre, centrada en el lugar del plano.
 * - `redondo`: los dos ejes de `ejes` escalan igual (lo redondo sigue redondo); el tercero, libre.
 * - `tramo`: a lo largo de `eje` se estira solo el medio y las puntas (conectores, codos) mantienen su
 *   proporción; la sección escala libre, o igual en los dos ejes si `seccionRedonda`.
 */
export type Ajuste =
  | { modo: "libre" }
  | { modo: "proporcional" }
  | { modo: "redondo"; ejes: [Eje, Eje] }
  | { modo: "tramo"; eje: Eje; seccionRedonda: boolean };

const EJES: Record<string, Eje> = { x: 0, y: 1, z: 2 };
const AJUSTE_LIBRE: Ajuste = { modo: "libre" };

/** Lee la regla del GLB (`"redondo:xz"`, `"tramo:x:redondo"`…). Lo que no se entiende es `libre`, como antes. */
export function leerAjuste(texto: unknown): Ajuste {
  if (typeof texto !== "string") return AJUSTE_LIBRE;
  const [modo, ejes = "", extra] = texto.trim().split(":");
  if (modo === "proporcional") return { modo };
  if (modo === "redondo" && ejes.length === 2 && ejes[0] !== ejes[1] && ejes[0] in EJES && ejes[1] in EJES)
    return { modo, ejes: [EJES[ejes[0]], EJES[ejes[1]]] };
  if (modo === "tramo" && ejes in EJES) return { modo, eje: EJES[ejes], seccionRedonda: extra === "redondo" };
  return AJUSTE_LIBRE;
}

/** `equipos`: palabras de los equipos para los que es la forma (del GLB); vacío = cualquiera. `ajuste`: ver `Ajuste`. */
export type ModeloPieza = { partes: ParteModelo[]; caja: THREE.Box3; equipos?: string[]; ajuste?: Ajuste };
export type BibliotecaPiezas = Map<string, ModeloPieza>;

/**
 * Atributos en Float32 sin normalizar. Un GLB comprimido (KHR_mesh_quantization / meshopt) trae las
 * posiciones como enteros normalizados en [-1, 1] y la escala real en el nodo: si se les aplica esa
 * matriz sin convertirlas, three las vuelve a guardar en [-1, 1] y la pieza se deforma (y con ella la
 * caja, la elección de variante y los ajustes por tramo).
 */
export function enFloat(g: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const [nombre, a] of Object.entries(g.attributes)) {
    if (a.array instanceof Float32Array && !a.normalized && !("isInterleavedBufferAttribute" in a)) continue;
    const valores = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) valores[i * a.itemSize + c] = a.getComponent(i, c);
    g.setAttribute(nombre, new THREE.BufferAttribute(valores, a.itemSize));
  }
  return g;
}

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
      const geometria = enFloat((o.geometry as THREE.BufferGeometry).clone());
      if (!geometria.getAttribute("normal")) geometria.computeVertexNormals();
      geometria.applyMatrix4(new THREE.Matrix4().multiplyMatrices(aLocal, o.matrixWorld));
      const catalogo = escena.userData.paletaRecetas;
      const recetas = Array.isArray(tipo.userData.recetas) ? tipo.userData.recetas.map((r: unknown) =>
        typeof r === "number" && Array.isArray(catalogo) ? catalogo[r] : r) : undefined;
      // RGB permite previsualización estándar; A codifica la receta (material OPAQUE).
      const colores = geometria.getAttribute("color");
      const etiquetas = colores?.itemSize === 4 && Array.isArray(recetas) ? colores : undefined;
      const etiqueta = (i: number) => Math.round(etiquetas!.getW(i) * 255);
      if (etiquetas && Array.isArray(recetas)) {
        // Una primitiva compacta en el GLB; partes por receta en el visor, como antes.
        const indices = geometria.getIndex();
        const grupos = new Map<number, number[]>();
        const total = indices?.count ?? etiquetas.count;
        for (let i = 0; i < total; i += 3) {
          const triangulo = [0, 1, 2].map((j) => indices ? indices.getX(i + j) : i + j);
          const receta = etiqueta(triangulo[0]);
          if (triangulo.some((v) => etiqueta(v) !== receta) || typeof recetas[receta] !== "string")
            throw new Error(`Receta de triángulo inválida: ${tipo.name}`);
          const grupo = grupos.get(receta) ?? [];
          grupo.push(...triangulo);
          grupos.set(receta, grupo);
        }
        for (const [receta, grupo] of grupos) {
          const parte = new THREE.BufferGeometry();
          // Compactar también los vértices: las cajas de cada parte no incluyen otras recetas.
          const usados = [...new Set(grupo)];
          const remap = new Map(usados.map((v, i) => [v, i]));
          for (const nombre of ["position", "normal"]) {
            const src = geometria.getAttribute(nombre);
            const datos = new Float32Array(usados.length * src.itemSize);
            usados.forEach((v, i) => {
              datos[i * 3] = src.getX(v); datos[i * 3 + 1] = src.getY(v); datos[i * 3 + 2] = src.getZ(v);
            });
            parte.setAttribute(nombre, new THREE.BufferAttribute(datos, src.itemSize));
          }
          parte.setIndex(grupo.map((v) => remap.get(v)!));
          partes.push({ geometria: parte, receta: recetas[receta] });
        }
        geometria.dispose();
      } else {
        const material = Array.isArray(o.material) ? o.material[0] : o.material;
        partes.push({ geometria, receta: material?.name?.split(".")[0] || RECETA_CUERPO });
      }
    });
    if (partes.length === 0) continue;
    const caja = new THREE.Box3();
    for (const p of partes) {
      p.geometria.computeBoundingBox();
      caja.union(p.geometria.boundingBox!);
    }
    const equipos = typeof tipo.userData.equipos === "string" ? palabras(tipo.userData.equipos) : [];
    biblioteca.set(tipo.name, { partes, caja, equipos, ajuste: leerAjuste(tipo.userData.ajuste) });
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
  tipos: z.record(
    z.string(),
    z.object({
      familia: z.string(),
      descripcion: z.string(),
      equipos: z.string(),
      ajuste: z.string().default("libre"),
      /** Medidas reales del tipo (cm) antes de comprimir el GLB (assets/models/comprimir.mjs). */
      caja: z.array(z.number()).length(3).optional(),
    }),
  ),
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
  return variantes.reduce((a, b) => (deformacion(b[1], dim) < deformacion(a[1], dim) - EMPATE ? b : a))[1];
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

/**
 * Diferencias de costo menores que esto (≈1 %) son un empate y gana la primera opción. Sin esto, una
 * pieza simétrica (un capacitor mide lo mismo en x que en z) cambia de orientación o de variante por
 * una diferencia de medida mínima, como la que deja comprimir el GLB (0,2 %).
 */
const EMPATE = 0.01;

/** La orientación que menos deforma; la del modelo salvo que otra mejore claramente (si no, dejaría de verse "derecha"). */
function orientacion(tam: number[], dim: number[]): Vec3 {
  const mejor = ORIENTACIONES.reduce((a, b) => (costo(tam, dim, b) < costo(tam, dim, a) - EMPATE ? b : a));
  // Con margen: justo en el límite, una diferencia de medida mínima no la hace girar de un lado o del otro.
  return costo(tam, dim, ORIENTACIONES[0]) - costo(tam, dim, mejor) > MEJORA_MINIMA + EMPATE ? mejor : ORIENTACIONES[0];
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

/** En `tramo`, cada punta es este tanto del largo del modelo: no se estira, solo escala como la sección. */
const PUNTA_TRAMO = 0.25;

/**
 * Escala de cada eje DEL MODELO según la regla de la forma. `s` es lo que haría falta para medir
 * justo `dim` en cada eje; las reglas lo achican donde estirar deformaría (nunca agrandan: la
 * pieza siempre entra en el lugar que le da el plano).
 */
export function escalasPorRegla(s: Vec3, ajuste: Ajuste = AJUSTE_LIBRE): Vec3 {
  const r = [...s] as Vec3;
  switch (ajuste.modo) {
    case "proporcional":
      return [Math.min(...s), Math.min(...s), Math.min(...s)];
    case "redondo": {
      const [a, b] = ajuste.ejes;
      r[a] = r[b] = Math.min(s[a], s[b]);
      return r;
    }
    case "tramo": {
      if (ajuste.seccionRedonda) {
        const [a, b] = ([0, 1, 2] as Eje[]).filter((e) => e !== ajuste.eje);
        r[a] = r[b] = Math.min(s[a], s[b]);
      }
      return r; // el eje del tramo se resuelve aparte (`estirarTramo`)
    }
    default:
      return r;
  }
}

/** En `tramo`, un objeto suelto más corto que esto (del largo del modelo) se mueve entero: no se estira. */
const CHICO_TRAMO = 0.15;

/**
 * Objetos sueltos de la malla (lentes, aros, fichas): cada vértice recibe el número de su objeto.
 * Primero suelda los vértices en la misma posición (el GLB los duplica en las aristas vivas) y
 * después une los de cada triángulo.
 */
function objetosSueltos(g: THREE.BufferGeometry): Int32Array {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const padre = new Int32Array(pos.count).map((_, i) => i);
  const raiz = (i: number): number => (padre[i] === i ? i : (padre[i] = raiz(padre[i])));
  const unir = (a: number, b: number) => {
    const [ra, rb] = [raiz(a), raiz(b)];
    if (ra !== rb) padre[ra] = rb;
  };
  const vistos = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const clave = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    const otro = vistos.get(clave);
    if (otro === undefined) vistos.set(clave, i);
    else unir(i, otro);
  }
  const indice = g.getIndex();
  const n = indice ? indice.count : pos.count;
  const v = (k: number) => (indice ? indice.getX(k) : k);
  for (let k = 0; k + 2 < n; k += 3) {
    unir(v(k), v(k + 1));
    unir(v(k), v(k + 2));
  }
  return padre.map((_, i) => raiz(i));
}

/**
 * Estira solo el medio de la geometría a lo largo de `eje` (ya centrada, en coordenadas del plano):
 * las puntas (`PUNTA_TRAMO` del largo del modelo, cada una) escalan `k` (como la sección) y el medio
 * se alarga o acorta hasta que el total mida `largo`. Los objetos sueltos chicos (lentes de una tira de
 * LED, aros, fichas) no se estiran: se mueven enteros a donde cae su centro. Si ni las puntas entran,
 * escala todo parejo.
 */
function estirarTramo(g: THREE.BufferGeometry, eje: Eje, largoModelo: number, largo: number, k: number) {
  const punta = PUNTA_TRAMO * largoModelo;
  const medioModelo = largoModelo - 2 * punta;
  const medio = largo - 2 * punta * k;
  const llevar = (u: number) => {
    if (medio <= 0 || medioModelo <= 0) return u * (largo / largoModelo);
    if (Math.abs(u) <= medioModelo / 2) return u * (medio / medioModelo);
    return Math.sign(u) * (medio / 2 + (Math.abs(u) - medioModelo / 2) * k);
  };
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const objeto = objetosSueltos(g);
  const extremos = new Map<number, [number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getComponent(i, eje);
    const [min, max] = extremos.get(objeto[i]) ?? [Infinity, -Infinity];
    extremos.set(objeto[i], [Math.min(min, u), Math.max(max, u)]);
  }
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getComponent(i, eje);
    const [min, max] = extremos.get(objeto[i])!;
    const centro = (min + max) / 2;
    const entero = max - min < CHICO_TRAMO * largoModelo && medio > 0;
    pos.setComponent(i, eje, entero ? llevar(centro) + (u - centro) * k : llevar(u));
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingBox();
}

/**
 * Copia las partes del modelo centradas en el origen y ajustadas al lugar que les da el plano (`dim`),
 * según la regla de la forma (`modelo.ajuste`): con `libre` el conjunto mide exactamente `dim`; con las
 * demás nunca se deforma lo que no debe y queda centrada dentro de `dim`. Si el plano pone la pieza en
 * otra posición que el modelo (una RAM más profunda que ancha, un ventilador parado en vez de
 * acostado), primero la gira para no deformarla.
 */
export function partesAjustadas(modelo: ModeloPieza, dim: Vec3): ParteModelo[] {
  const tam = ejes(modelo.caja.getSize(new THREE.Vector3()));
  const centro = modelo.caja.getCenter(new THREE.Vector3());
  const d = medidas(dim);
  const o = orientacion(tam, d);
  const ajuste = modelo.ajuste ?? AJUSTE_LIBRE;

  // Rotación de 90° que lleva el eje o[i] del modelo al eje i del plano (sin espejar).
  const rot = new THREE.Matrix4().makeBasis(
    ...([0, 1, 2].map((j) => new THREE.Vector3(...(o.map((eje) => (eje === j ? 1 : 0)) as Vec3))) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]),
  );
  if (rot.determinant() < 0) rot.premultiply(new THREE.Matrix4().makeScale(-1, 1, 1));

  // Escala por eje del modelo: lo justo para `dim`, corregido por la regla de la forma.
  const justo = [0, 0, 0] as Vec3;
  o.forEach((eje, i) => (justo[eje] = d[i] / Math.max(tam[eje], 1e-6)));
  const s = escalasPorRegla(justo, ajuste);
  const tramo = ajuste.modo === "tramo" ? ajuste.eje : null;
  if (tramo !== null) s[tramo] = 1;

  const m = new THREE.Matrix4().makeTranslation(-centro.x, -centro.y, -centro.z);
  m.premultiply(new THREE.Matrix4().makeScale(...s));
  m.premultiply(rot);
  return modelo.partes.map((p) => {
    const geometria = p.geometria.clone().applyMatrix4(m);
    if (tramo !== null) {
      const otros = ([0, 1, 2] as Eje[]).filter((e) => e !== tramo);
      const k = Math.sqrt(s[otros[0]] * s[otros[1]]); // las puntas escalan como la sección
      estirarTramo(geometria, o.indexOf(tramo) as Eje, tam[tramo], d[o.indexOf(tramo)], k);
    }
    return { receta: p.receta, geometria };
  });
}
