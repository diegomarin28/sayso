/**
 * Mide qué tan bien coinciden las posiciones del plano con el diagrama del manual.
 *
 *   npx tsx lib/planogenerator/evaluacion/evaluar.ts manuales <carpeta con plano-<caso>-<n>.json> [--superponer]
 *
 * Puntaje por pieza (escala 0–2 de docs/3d-estrategia.md): distancia entre centros en la
 * planta normalizada (x, z de -1 a 1): ≤ 0,35 → 2; ≤ 0,7 → 1; si no → 0.
 * Compara contra la plantilla sin IA. Con varias corridas por caso informa promedio y rango.
 * Con --superponer dibuja sobre paginas/interior.png el contorno de la carcasa, la referencia
 * (verde) y la primera corrida de la IA (naranja) → <carpeta>/superpuesto-<caso>.png.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PlanoDePiezas } from "../../../shared";
import { planoDesdePlantilla } from "../generador";
import { cargarCasos, imagenes, type CasoCargado } from "./caso";
import { aPixel, aPlanta, centroNormalizado, puntaje } from "./planta";

export function puntuar(plano: PlanoDePiezas, c: CasoCargado) {
  const ref = c.caso.referencia;
  return Object.entries(ref.piezas).map(([id, px]) => {
    const enPlanta = aPlanta(px, ref.esquinas);
    const gen = centroNormalizado(plano, id);
    const d = gen ? Math.hypot(gen[0] - enPlanta[0], gen[1] - enPlanta[1]) : Infinity;
    return { id, ref: enPlanta, gen, d, puntos: gen ? puntaje(d) : 0 };
  });
}

function superponer(c: CasoCargado, filas: ReturnType<typeof puntuar>, salida: string) {
  const imagen = imagenes(c).interior;
  if (!existsSync(imagen)) return;
  const e = c.caso.referencia.esquinas;
  const fuente = ["/System/Library/Fonts/Helvetica.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"].find(existsSync);
  const args = [imagen, ...(fuente ? ["-font", fuente] : []), "-fill", "none", "-stroke", "#1c7ed6", "-strokewidth", "2"];
  args.push("-draw", `polygon ${[e.BL, e.BR, e.FR, e.FL].map((p) => p.join(",")).join(" ")}`);
  for (const r of filas) {
    const [rx, ry] = c.caso.referencia.piezas[r.id];
    args.push("-stroke", "#2b8a3e", "-strokewidth", "3", "-draw", `circle ${rx},${ry} ${rx + 9},${ry}`);
    if (!r.gen) continue;
    const [gx, gy] = aPixel(r.gen, e).map(Math.round);
    args.push("-stroke", "#e8590c", "-draw", `line ${rx},${ry} ${gx},${gy}`, "-draw", `rectangle ${gx - 7},${gy - 7} ${gx + 7},${gy + 7}`);
    args.push("-stroke", "none", "-fill", "#e8590c", "-pointsize", "16", "-draw", `text ${gx + 10},${gy + 5} '${r.id} ${r.puntos}'`, "-fill", "none");
  }
  execFileSync("magick", [...args, salida]);
}

function main() {
  const [raiz, carpeta] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!raiz || !carpeta) throw new Error("Uso: evaluar.ts <carpeta con casos> <carpeta con planos> [--superponer]");
  const marcar = process.argv.includes("--superponer");
  const archivos = readdirSync(carpeta);
  const total = { ia: [] as number[], plantilla: 0, max: 0 };

  for (const c of cargarCasos(raiz)) {
    const corridas = archivos
      .filter((a) => a.startsWith(`plano-${c.nombre}-`) && a.endsWith(".json"))
      .sort()
      .map((a) => PlanoDePiezas.parse(JSON.parse(readFileSync(path.join(carpeta, a), "utf8"))));
    if (!corridas.length) {
      console.log(`${c.nombre}: no hay planos en ${carpeta}`);
      continue;
    }
    const filas = corridas.map((p) => puntuar(p, c));
    const base = puntuar(planoDesdePlantilla(c.kp).plano, c);
    const max = base.length * 2;
    const sumas = filas.map((f) => f.reduce((s, r) => s + r.puntos, 0));
    console.log(`\n== ${c.nombre} (${corridas.length} corridas)`);
    console.log(`  ${"pieza".padEnd(18)} ${"puntos por corrida".padEnd(20)} plantilla`);
    base.forEach((b, i) => console.log(`  ${b.id.padEnd(18)} ${filas.map((f) => f[i].puntos).join(" ").padEnd(20)} ${b.puntos}`));
    console.log(`  IA: ${sumas.join(", ")} de ${max} · plantilla: ${base.reduce((s, r) => s + r.puntos, 0)} de ${max}`);
    if (marcar) superponer(c, filas[0], path.join(carpeta, `superpuesto-${c.nombre}.png`));

    // Total por corrida: la corrida n de cada caso suma con la corrida n de los demás.
    sumas.forEach((s, n) => (total.ia[n] = (total.ia[n] ?? 0) + s));
    total.plantilla += base.reduce((s, r) => s + r.puntos, 0);
    total.max += max;
  }
  const pct = (v: number) => Math.round((100 * v) / total.max);
  const media = total.ia.reduce((a, b) => a + b, 0) / total.ia.length;
  console.log(
    `\nTOTAL IA: promedio ${media.toFixed(1)}/${total.max} (${pct(media)} %), rango ${pct(Math.min(...total.ia))}–${pct(Math.max(...total.ia))} %` +
      ` · plantilla sin IA: ${total.plantilla}/${total.max} (${pct(total.plantilla)} %)`,
  );
}

main();
