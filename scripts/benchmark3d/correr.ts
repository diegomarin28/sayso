/**
 * Benchmark 3D por tipo de equipo, sin IA ni red (ver README.md):
 *
 *   npx tsx scripts/benchmark3d/correr.ts                         # tabla de los casos (plano sin IA)
 *   npx tsx scripts/benchmark3d/correr.ts --solo reloj,televisor --salida /tmp/bench
 *   npx tsx scripts/benchmark3d/correr.ts --actualizar            # guarda la línea de base
 *   npx tsx scripts/benchmark3d/correr.ts --superponer --salida /tmp/bench   # dibuja la anotación sobre las fotos locales
 *   npx tsx scripts/benchmark3d/correr.ts --guardados mis-casos.json         # además, los planos de la caché
 *   npx tsx scripts/benchmark3d/correr.ts --solo reloj --piezas              # el plano de cada caso (para anotar fotos)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { CasoGuardado } from "../../app/(screens)/_datos/mis-casos";
import type { PlanoDePiezas } from "../../shared";
import { CARPETA_FOTOS, cargarCasos, type CasoBenchmark, type FotoReferencia } from "./caso";
import { enFoto, enVista } from "./metricas";
import { LINEA_BASE, lineaBaseDe, tabla } from "./informe";
import { cargarEntorno, planoDePlantilla, puntuar, puntuarCaso, type Resultado } from "./puntuar";

/** Fuente para los rótulos (sin -font, ImageMagick no encuentra ninguna en macOS). */
const FUENTE = "/System/Library/Fonts/Supplemental/Arial.ttf";

/** Dibuja sobre la foto el contorno del marco, la referencia (verde) y dónde lo pone el plano (naranja). */
function superponer(foto: FotoReferencia, plano: PlanoDePiezas, fuera: readonly string[], salida: string): string | null {
  const origen = path.join(CARPETA_FOTOS, foto.archivo);
  if (!existsSync(origen)) return null;
  const { ai, ad, bd, bi } = foto.esquinas;
  // De (-1..1, -1..1) en el contorno a píxeles (bilineal, como enFoto al revés).
  const aPx = ([u, v]: [number, number]): [number, number] => {
    const [s, t] = [(u + 1) / 2, (v + 1) / 2];
    return [0, 1].map((i) => (1 - s) * (1 - t) * ai[i] + s * (1 - t) * ad[i] + s * t * bd[i] + (1 - s) * t * bi[i]) as [number, number];
  };
  const r = Math.max(6, Math.round(Math.hypot(ad[0] - ai[0], ad[1] - ai[1]) / 80));
  const dibujo: string[] = ["-font", FUENTE, "-fill", "none", "-stroke", "#00b4ff", "-strokewidth", String(Math.max(2, r / 2)), "-draw", `polygon ${[ai, ad, bd, bi].map((p) => p.join(",")).join(" ")}`];
  for (const [id, px] of Object.entries(foto.piezas)) {
    const ref = aPx(enFoto(px, foto));
    const v = enVista(plano, id, foto, fuera);
    dibujo.push("-stroke", "#00c853", "-fill", "#00c853", "-draw", `circle ${ref[0]},${ref[1]} ${ref[0] + r},${ref[1]}`);
    dibujo.push("-stroke", "none", "-pointsize", String(r * 2.2), "-draw", `text ${ref[0] + r * 1.4},${ref[1] - r} '${id}'`);
    if (v) {
      const p = aPx(v);
      dibujo.push("-stroke", "#ff6d00", "-strokewidth", String(Math.max(2, r / 2)), "-fill", "none", "-draw", `circle ${p[0]},${p[1]} ${p[0] + r},${p[1]}`);
      dibujo.push("-draw", `line ${ref[0]},${ref[1]} ${p[0]},${p[1]}`);
    }
  }
  const destino = path.join(salida, `superpuesta-${foto.archivo.replace(/\.\w+$/, "")}.png`);
  execFileSync("magick", [origen, ...dibujo, destino]);
  return destino;
}

/** Planos de la caché exportados con `scripts/bateria/correr.ts --mis-casos` (lista o `{ casos }`). */
function leerGuardados(archivo: string): CasoGuardado[] {
  const crudo = JSON.parse(readFileSync(archivo, "utf8"));
  return z.array(CasoGuardado).parse(Array.isArray(crudo) ? crudo : crudo.casos);
}

async function main() {
  const { values } = parseArgs({
    options: {
      solo: { type: "string" },
      salida: { type: "string" },
      actualizar: { type: "boolean", default: false },
      superponer: { type: "boolean", default: false },
      guardados: { type: "string" },
      piezas: { type: "boolean", default: false },
    },
  });
  const solo = values.solo?.split(",").map((s) => s.trim());
  const casos = cargarCasos().filter((c) => !solo || solo.includes(c.tipo));
  if (!casos.length) throw new Error("No hay casos (¿--solo?).");
  if (values.actualizar && solo) throw new Error("--actualizar va con todos los casos (sin --solo).");

  const entorno = await cargarEntorno();
  const resultados: Resultado[] = [];
  const planos = new Map<string, [CasoBenchmark, PlanoDePiezas]>();
  for (const caso of casos) {
    const plano = await planoDePlantilla(caso);
    resultados.push(await puntuarCaso(caso, entorno, plano));
    planos.set(caso.tipo, [caso, plano]);
  }
  for (const g of values.guardados ? leerGuardados(values.guardados) : []) {
    if (!g.guia?.plano) continue;
    resultados.push(
      puntuar(
        {
          tipo: g.tipoEquipo ?? g.caso.clase,
          equipo: g.guia.preparado.pack.modelo,
          modo: "guardado",
          tipoEquipo: g.tipoEquipo ?? undefined,
          plano: g.guia.plano.plano,
          piezasDelPack: g.guia.preparado.pack.piezas,
        },
        entorno,
      ),
    );
  }

  if (values.piezas)
    for (const [caso, plano] of planos.values()) {
      console.log(`\n## ${caso.tipo}: centro y medidas de cada pieza (cm; x derecha, y arriba, z frente)`);
      const n = (v: number[]) => v.map((x) => x.toFixed(1)).join(", ");
      for (const p of plano.piezas) console.log(`  ${p.pieza.padEnd(32)} pos ${n(p.pos).padEnd(20)} dim ${n(p.dim).padEnd(20)} ${p.padre ?? ""}`);
    }

  const informe = tabla(resultados);
  console.log(informe);
  if (values.salida) {
    mkdirSync(values.salida, { recursive: true });
    writeFileSync(path.join(values.salida, "resultado.json"), JSON.stringify(resultados, null, 2));
    writeFileSync(path.join(values.salida, "informe.md"), informe + "\n");
    console.log(`\nDetalle en ${path.join(values.salida, "resultado.json")}`);
  }
  if (values.superponer) {
    if (!values.salida) throw new Error("--superponer necesita --salida.");
    for (const [caso, plano] of planos.values())
      for (const foto of caso.fotos) {
        const hecho = superponer(foto, plano, caso.fuera, values.salida);
        console.log(hecho ? `Superpuesta: ${hecho}` : `Falta la foto ${path.join(CARPETA_FOTOS, foto.archivo)} (se baja de ${foto.url})`);
      }
  }
  if (values.actualizar) {
    writeFileSync(LINEA_BASE, JSON.stringify(lineaBaseDe(resultados.filter((r) => r.modo === "plantilla")), null, 2) + "\n");
    console.log(`\nLínea de base actualizada: ${LINEA_BASE}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
