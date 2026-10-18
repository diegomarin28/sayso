/**
 * Compara dos carpetas de la biblioteca de piezas (ej. antes y después de comprimir):
 *   npx tsx assets/models/comparar.ts <carpeta-antes> public/models/piezas
 * Caja y centro de cada tipo, recetas, equipos, AJUSTES, el resultado de ajustar cada pieza a varias
 * medidas (incluye los tramos de cables y lentes) y la variante elegida con y sin tipo de equipo.
 */
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { bibliotecaDesdeEscena, modeloPara, partesAjustadas, tipoDe, type BibliotecaPiezas } from "../../lib/planogenerator/biblioteca";
import { cargadorGlb } from "../../lib/planogenerator/cargador";

async function main() {
const [dirA, dirB] = process.argv.slice(2);
const indice = JSON.parse(readFileSync(dirB + "/indice.json", "utf8"));
async function cargar(dir: string): Promise<BibliotecaPiezas> {
  const b: BibliotecaPiezas = new Map();
  for (const f of Object.values(indice.familias) as string[]) {
    const d = readFileSync(`${dir}/${f}`);
    const g = await cargadorGlb().parseAsync(d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength), "");
    for (const [k, v] of bibliotecaDesdeEscena(g.scene)) b.set(k, v);
  }
  return b;
}
const A = await cargar(dirA), B = await cargar(dirB);
const tam = (c: THREE.Box3) => c.getSize(new THREE.Vector3());
let peorCaja = 0, peorCentro = 0, peorAjuste = 0;
const distintos: string[] = [];
const malAjustadas: string[] = [];
const cajaPartes = (ps: { geometria: THREE.BufferGeometry }[]) => { const c = new THREE.Box3(); for (const p of ps) { p.geometria.computeBoundingBox(); c.union(p.geometria.boundingBox!); } return c; };
const DIMS: [number, number, number][] = [[1, 1, 1], [5, 0.5, 8], [26, 0.8, 7], [0.9, 0.3, 0.75], [30, 2, 2], [60, 10, 10], [12, 12, 3], [40, 20, 3], [100, 58, 1], [8, 12, 12], [2, 30, 2]];
for (const [k, a] of A) {
  const b = B.get(k);
  if (!b) { distintos.push(`falta ${k}`); continue; }
  const ta = tam(a.caja), tb = tam(b.caja);
  const rel = Math.max(...[0, 1, 2].map((i) => Math.abs(ta.getComponent(i) - tb.getComponent(i)) / Math.max(ta.getComponent(i), 0.01)));
  peorCaja = Math.max(peorCaja, rel);
  peorCentro = Math.max(peorCentro, a.caja.getCenter(new THREE.Vector3()).distanceTo(b.caja.getCenter(new THREE.Vector3())));
  if (JSON.stringify(a.ajuste) !== JSON.stringify(b.ajuste)) distintos.push(`ajuste ${k}`);
  if (JSON.stringify(a.equipos) !== JSON.stringify(b.equipos)) distintos.push(`equipos ${k}`);
  if (a.partes.map((p) => p.receta).sort().join() !== b.partes.map((p) => p.receta).sort().join()) distintos.push(`recetas ${k}`);
  for (const d of DIMS) {
    const ca = tam(cajaPartes(partesAjustadas(a, d))), cb = tam(cajaPartes(partesAjustadas(b, d)));
    const dif = Math.max(...[0, 1, 2].map((i) => Math.abs(ca.getComponent(i) - cb.getComponent(i)) / Math.max(d[i], 0.01)));
    if (dif > 0.01) malAjustadas.push(`${k} ${a.ajuste?.modo} [${d}]: ${ca.toArray().map((v) => v.toFixed(2))} → ${cb.toArray().map((v) => v.toFixed(2))}`);
    peorAjuste = Math.max(peorAjuste, dif);
  }
}
const nombre = (bib: BibliotecaPiezas, m?: unknown) => [...bib].find(([, v]) => v === m)?.[0];
let elecciones = 0;
for (const tipo of new Set([...A.keys()].map(tipoDe))) for (const d of DIMS) for (const eq of [undefined, "celular", "notebook", "heladera", "aire split", "televisor", "lavarropas"]) {
  elecciones++;
  const na = nombre(A, modeloPara(tipo + "_x", A, d, eq)), nb = nombre(B, modeloPara(tipo + "_x", B, d, eq));
  if (na !== nb) distintos.push(`variante ${tipo} ${d} ${eq}: ${na} → ${nb}`);
}
console.log(`tipos: ${A.size} / ${B.size}`);
console.log(`peor diferencia de caja: ${(peorCaja * 100).toFixed(3)} %`);
console.log(`peor corrimiento del centro: ${peorCentro.toFixed(4)} cm`);
console.log(`peor diferencia al ajustar a ${DIMS.length} medidas (todas las piezas, incluye tramos): ${(peorAjuste * 100).toFixed(3)} % de la medida`);
console.log(`elecciones de variante comparadas: ${elecciones}`);
if (malAjustadas.length) console.log(`AJUSTES QUE DIFIEREN MÁS DEL 1 % (${malAjustadas.length}):\n  ` + malAjustadas.slice(0, 20).join("\n  "));
console.log(distintos.length ? "DIFERENCIAS:\n  " + distintos.slice(0, 30).join("\n  ") : "sin diferencias en ajustes, equipos, recetas ni variantes");
}
main();
