/**
 * Mide qué tan bien coinciden las posiciones del plano con el diagrama del manual.
 *
 *   npx tsx lib/planogenerator/evaluacion/evaluar.ts [carpeta con plano-<modelo>.json] [--superponer]
 *
 * Con --superponer dibuja sobre manuales/<modelo>/paginas/interior.png el contorno de la
 * carcasa, la referencia (verde) y la IA (naranja) → <carpeta>/superpuesto-<modelo>.png.
 *
 * Referencia: referencias.json (píxeles leídos a ojo sobre la vista interior del manual).
 * Puntaje por pieza (escala 0–2 de docs/3d-estrategia.md): distancia entre centros en la
 * planta normalizada (x, z de -1 a 1): ≤ 0,35 → 2; ≤ 0,7 → 1; si no → 0.
 * Compara contra la plantilla sin IA como línea de base.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KnowledgePack, PlanoDePiezas } from "../../../shared";
import { planoDesdePlantilla } from "../generador";
import { aPixel, aPlanta, type Esquinas, type Punto } from "./planta";

type Caso = { paginas: number[]; esquinas: Esquinas; piezas: Record<string, Punto> };

const aqui = path.dirname(fileURLToPath(import.meta.url));
const UMBRALES = [0.35, 0.7];

function centroNormalizado(plano: PlanoDePiezas, id: string): Punto | null {
  const base = plano.piezas.find((p) => p.pieza === "base");
  const p = plano.piezas.find((q) => q.pieza === id);
  if (!base || !p) return null;
  return [p.pos[0] / (base.dim[0] / 2), p.pos[2] / (base.dim[2] / 2)];
}

const puntaje = (d: number) => (d <= UMBRALES[0] ? 2 : d <= UMBRALES[1] ? 1 : 0);

function puntuar(plano: PlanoDePiezas, caso: Caso) {
  return Object.entries(caso.piezas).map(([id, px]) => {
    const ref = aPlanta(px, caso.esquinas);
    const gen = centroNormalizado(plano, id);
    const d = gen ? Math.hypot(gen[0] - ref[0], gen[1] - ref[1]) : Infinity;
    return { id, ref, gen, d, puntos: gen ? puntaje(d) : 0 };
  });
}

const f = (p: Punto | null) => (p ? `(${p[0].toFixed(2).padStart(5)}, ${p[1].toFixed(2).padStart(5)})` : "      —       ");

function superponer(modelo: string, caso: Caso, filas: ReturnType<typeof puntuar>, carpeta: string) {
  const imagen = path.join("manuales", modelo, "paginas", "interior.png");
  if (!existsSync(imagen)) return;
  const e = caso.esquinas;
  const fuente = ["/System/Library/Fonts/Helvetica.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"].find(existsSync);
  const args = [imagen, ...(fuente ? ["-font", fuente] : []), "-fill", "none", "-stroke", "#1c7ed6", "-strokewidth", "2"];
  args.push("-draw", `polygon ${[e.BL, e.BR, e.FR, e.FL].map((p) => p.join(",")).join(" ")}`);
  for (const r of filas) {
    const [rx, ry] = caso.piezas[r.id];
    args.push("-stroke", "#2b8a3e", "-strokewidth", "3", "-draw", `circle ${rx},${ry} ${rx + 9},${ry}`);
    if (r.gen) {
      const [gx, gy] = aPixel(r.gen, e).map(Math.round);
      args.push("-stroke", "#e8590c", "-draw", `line ${rx},${ry} ${gx},${gy}`, "-draw", `rectangle ${gx - 7},${gy - 7} ${gx + 7},${gy + 7}`);
      args.push("-stroke", "none", "-fill", "#e8590c", "-pointsize", "16", "-draw", `text ${gx + 10},${gy + 5} '${r.id} ${r.puntos}'`, "-fill", "none");
    }
  }
  const salida = path.join(carpeta, `superpuesto-${modelo}.png`);
  execFileSync("magick", [...args, salida]);
  console.log(`  → ${salida}`);
}

function main() {
  const marcar = process.argv.includes("--superponer");
  const carpeta = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "manuales/resultados";
  const refs = JSON.parse(readFileSync(path.join(aqui, "referencias.json"), "utf8")) as Record<string, Caso | string>;
  const total = { ia: 0, plantilla: 0, max: 0 };
  for (const [modelo, caso] of Object.entries(refs)) {
    if (typeof caso === "string") continue;
    const archivo = path.join(carpeta, `plano-${modelo}.json`);
    if (!existsSync(archivo)) {
      console.log(`${modelo}: falta ${archivo}`);
      continue;
    }
    const ia = PlanoDePiezas.parse(JSON.parse(readFileSync(archivo, "utf8")));
    const kp = KnowledgePack.parse(JSON.parse(readFileSync(path.join(aqui, `kp-${modelo}.json`), "utf8")));
    const base = planoDesdePlantilla(kp).plano;
    const rIa = puntuar(ia, caso);
    const rBase = puntuar(base, caso);
    console.log(`\n== ${modelo} (páginas ${caso.paginas.join(", ")})`);
    console.log(`  ${"pieza".padEnd(18)} ${"referencia".padEnd(15)} ${"IA".padEnd(15)} d     pts   | plantilla pts`);
    rIa.forEach((r, i) =>
      console.log(`  ${r.id.padEnd(18)} ${f(r.ref)} ${f(r.gen)} ${r.d.toFixed(2).padStart(4)}  ${r.puntos}     | ${rBase[i].puntos}`),
    );
    const suma = (rs: typeof rIa) => rs.reduce((s, r) => s + r.puntos, 0);
    const max = rIa.length * 2;
    console.log(`  Total IA: ${suma(rIa)}/${max} · plantilla: ${suma(rBase)}/${max}`);
    if (marcar) superponer(modelo, caso, rIa, carpeta);
    total.ia += suma(rIa);
    total.plantilla += suma(rBase);
    total.max += max;
  }
  console.log(`\nTOTAL IA: ${total.ia}/${total.max} (${Math.round((100 * total.ia) / total.max)} %) · plantilla sin IA: ${total.plantilla}/${total.max} (${Math.round((100 * total.plantilla) / total.max)} %)`);
}

main();
