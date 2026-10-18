import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { PlanoDePiezas, Vec3 } from "../../shared";
import { planoNotebookBase } from "../../lib/planogenerator";
import {
  planoCelular,
  planoImpresoraLaser,
  planoNotebookSinVentilador,
  planoParlanteBluetooth,
  planoTelevisor,
} from "../../lib/planogenerator/plantillas/equipos";
import { cajaDespiezada, encuadre, prepararEscena } from "./escena";
import { GALERIA_CAMPUS } from "./galeria/campus";
import { despiezado, desplazamientoDespiece } from "./reproductor";

/**
 * Despiece por TIPO (por la forma del equipo, nunca por modelo), cada tipo con al menos dos variantes.
 * Un equipo plano se abre en capas en orden físico, con el mismo escalón, y corridas para no taparse (#188).
 */

const campus = (id: string) => GALERIA_CAMPUS.find((e) => e.id === id)!.plano;
/** Mismo TV con otro tamaño de pantalla (ancho y alto escalados, la profundidad igual). */
const tvDe = (escala: number): PlanoDePiezas => ({
  ...planoTelevisor,
  piezas: planoTelevisor.piezas.map((p) => ({
    ...p,
    dim: [p.dim[0] * escala, p.dim[1] * escala, p.dim[2]] as Vec3,
    pos: [p.pos[0] * escala, p.pos[1] * escala, p.pos[2]] as Vec3,
  })),
});

const entrada = (plano: PlanoDePiezas) => plano.piezas.map((p) => ({ id: p.pieza, centro: p.pos, dim: p.dim, padre: p.padre ?? null }));

/** El corrimiento de cada pieza en ejes del equipo (sumando el de sus padres). */
function enMundo(plano: PlanoDePiezas): Map<string, Vec3> {
  const local = despiezado(entrada(plano));
  const res = new Map<string, Vec3>();
  const de = (id: string): Vec3 => {
    if (res.has(id)) return res.get(id)!;
    const p = plano.piezas.find((x) => x.pieza === id)!;
    const propio = local.get(id)!;
    const v = (p.padre ? de(p.padre).map((x, i) => x + propio[i]) : propio) as Vec3;
    res.set(id, v);
    return v;
  };
  for (const p of plano.piezas) de(p.pieza);
  return res;
}

const PLANOS: Array<[string, string, PlanoDePiezas, 0 | 1 | 2, 1 | 2]> = [
  // tipo, variante, plano, eje fino, eje del abanico
  ["celular", "plantilla", planoCelular, 1, 2],
  ["celular", "esquema iPhone", campus("iphone-esquema"), 1, 2],
  ["celular", "esquema Samsung", campus("samsung-esquema"), 1, 2],
  ["TV", '46"', planoTelevisor, 2, 1],
  ["TV", '32"', tvDe(0.7), 2, 1],
  ["notebook", "genérica", planoNotebookBase, 1, 2],
  ["notebook", "sin ventilador", planoNotebookSinVentilador, 1, 2],
];

describe("despiece de un equipo plano: capas en orden físico", () => {
  it.each(PLANOS)("%s (%s): cada pieza sube según su altura, con el mismo escalón entre capas", (_, __, plano, fino) => {
    const v = enMundo(plano);
    const raiz = plano.piezas.find((p) => !p.padre)!;
    expect(v.get(raiz.pieza)).toEqual([0, 0, 0]);
    // Orden físico: la que está más arriba (sobre el eje fino) nunca baja de una que está más abajo.
    const otras = plano.piezas.filter((p) => p !== raiz);
    for (const a of otras) for (const b of otras) if (a.pos[fino] < b.pos[fino]) expect(v.get(a.pieza)![fino], `${a.pieza} < ${b.pieza}`).toBeLessThanOrEqual(v.get(b.pieza)![fino] + 1e-9);
    // Escalón parejo: las alturas distintas (más la de la carcasa) son una escalera de paso fijo.
    const alturas = [...new Set([0, ...otras.map((p) => +v.get(p.pieza)![fino].toFixed(6))])].sort((a, b) => a - b);
    expect(alturas.length).toBeGreaterThanOrEqual(3);
    const pasos = alturas.slice(1).map((h, i) => h - alturas[i]);
    for (const p of pasos) expect(p).toBeCloseTo(pasos[0], 6);
  });

  it.each(PLANOS)("%s (%s): las capas se corren de costado y no quedan una encima de la otra (#188)", (_, __, plano, fino, abanico) => {
    const v = enMundo(plano);
    const raiz = plano.piezas.find((p) => !p.padre)!;
    const porCapa = new Map<number, number>();
    for (const p of plano.piezas) porCapa.set(+v.get(p.pieza)![fino].toFixed(6), v.get(p.pieza)![abanico]);
    const corrimientos = [...porCapa.values()].sort((a, b) => a - b);
    const paso = corrimientos.slice(1).map((c, i) => c - corrimientos[i]);
    for (const p of paso) expect(p).toBeGreaterThanOrEqual(0.25 * raiz.dim[abanico]);
  });

  it("celular: la tapa trasera queda arriba de todo, la pantalla abajo y la batería en el medio", () => {
    for (const plano of [planoCelular, campus("samsung-esquema")]) {
      const v = enMundo(plano);
      expect(v.get("tapa_trasera")![1]).toBeGreaterThan(v.get("bateria")![1]);
      expect(v.get("bateria")![1]).toBeGreaterThan(0);
      expect(v.get("pantalla")![1]).toBeLessThan(0);
    }
  });

  it("un equipo que no es plano (impresora láser, parlante) se despieza como antes", () => {
    for (const plano of [planoImpresoraLaser, planoParlanteBluetooth]) {
      const local = despiezado(entrada(plano));
      for (const p of plano.piezas) {
        const padre = plano.piezas.find((x) => x.pieza === p.padre);
        expect(local.get(p.pieza)).toEqual(desplazamientoDespiece(p.pos, padre?.pos ?? null, 1));
      }
    }
  });
});

describe("encuadre del despiece en el celular (pantalla vertical)", () => {
  const tam = { width: 390, height: 640 };
  it.each([
    ["parlante", planoParlanteBluetooth],
    ["celular", planoCelular],
    ["TV", planoTelevisor],
    ["notebook", planoNotebookBase],
  ])("%s despiezado: entra entero a lo ancho y a lo alto", (_, plano) => {
    const escena = prepararEscena(plano);
    const camara = new THREE.PerspectiveCamera(35, tam.width / tam.height, 0.1, 5000);
    const e = encuadre(escena, "general", 1, camara, tam, 1);
    camara.position.copy(e.posicion);
    camara.lookAt(e.objetivo);
    camara.updateMatrixWorld();
    const caja = cajaDespiezada(escena, 1);
    for (const x of [caja.min.x, caja.max.x])
      for (const y of [caja.min.y, caja.max.y])
        for (const z of [caja.min.z, caja.max.z]) {
          const p = new THREE.Vector3(x, y, z).project(camara);
          expect(Math.abs(p.x), `x ${x},${y},${z}`).toBeLessThanOrEqual(1.001);
          expect(Math.abs(p.y), `y ${x},${y},${z}`).toBeLessThanOrEqual(1.001);
        }
  });
});
