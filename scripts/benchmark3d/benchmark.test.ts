import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { elegirPlantilla } from "../../lib/planogenerator/plantillas/por-tipo";
import { cargarCasos } from "./caso";
import { LINEA_BASE, LineaBase, bajas } from "./informe";
import { MARCO_TODO } from "./metricas";
import { cargarEntorno, puntuarCaso, type Entorno, type Resultado } from "./puntuar";

/**
 * Benchmark 3D (sin IA ni red): cada caso con el plano que arma la app sin IA, contra la línea de base.
 * Si un cambio mejora un puntaje, se actualiza a propósito con `npx tsx scripts/benchmark3d/correr.ts --actualizar`
 * (y se dice en el PR); si lo empeora, este test falla con lo que bajó.
 */

const casos = cargarCasos();
const base = LineaBase.parse(JSON.parse(readFileSync(LINEA_BASE, "utf8")));
let entorno: Entorno;
let resultados: Resultado[];

beforeAll(async () => {
  entorno = await cargarEntorno();
  resultados = [];
  for (const caso of casos) resultados.push(await puntuarCaso(caso, entorno));
}, 60000);

describe("casos del benchmark 3D", () => {
  it("uno por tipo, casi todos con medidas de una ficha real y fotos anotadas", () => {
    expect(casos.length).toBeGreaterThanOrEqual(9);
    expect(new Set(casos.map((c) => c.tipo)).size).toBe(casos.length);
    for (const c of casos) if (c.medidas) expect(new URL(c.medidas.fuente).hostname, c.tipo).not.toMatch(/example\.(com|invalid)$/);
    expect(casos.filter((c) => c.medidas).length).toBeGreaterThanOrEqual(casos.length - 1);
    for (const c of casos) expect(c.fotos.length, c.tipo).toBeGreaterThan(0);
  });

  it.each(casos.map((c) => [c.tipo, c] as const))("%s: lo anotado en las fotos existe en el pack o en la plantilla del tipo", (_, c) => {
    const plantilla = elegirPlantilla(c.pack, c.tipoEquipo);
    const conocidas = new Set([...c.pack.piezas.map((p) => p.id), ...(plantilla?.plano.piezas.map((p) => p.pieza) ?? [])]);
    for (const f of c.fotos) {
      if (f.marco !== MARCO_TODO) expect(conocidas, `${f.archivo}: marco`).toContain(f.marco);
      for (const id of Object.keys(f.piezas)) expect(conocidas, `${f.archivo}: ${id}`).toContain(id);
    }
  });
});

describe("línea de base", () => {
  it("cada caso tiene línea de base y la línea de base no tiene casos que ya no existen", () => {
    expect(Object.keys(base).sort()).toEqual(casos.map((c) => c.tipo).sort());
  });

  it("ningún puntaje bajó, ni creció el peso o los triángulos (más de 10 %)", () => {
    expect(bajas(base, resultados)).toEqual([]);
  });

  it("es reproducible: la misma corrida da lo mismo", async () => {
    const otra = await puntuarCaso(casos[0], entorno);
    expect(otra).toEqual(resultados[0]);
  });

  it("sin IA el 3D es una aproximación y lo dice: nada sin respaldo y ninguna pieza del manual o de fotos", () => {
    for (const r of resultados) {
      expect(r.detalle.certeza.incoherencias, r.tipo).toEqual([]);
      expect(r.puntajes.evidencia, r.tipo).toBe(0);
    }
  });
});
