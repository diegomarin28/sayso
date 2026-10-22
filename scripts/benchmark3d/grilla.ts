/**
 * Copia reducida de una foto con una grilla rotulada en píxeles de la ORIGINAL, para anotar a ojo las esquinas
 * y los centros de un caso (ver README.md). Necesita ImageMagick (`magick`).
 *
 *   npx tsx scripts/benchmark3d/grilla.ts scripts/benchmark3d/fotos/tv-frente.jpg /tmp/grilla.png [paso]
 *   npx tsx scripts/benchmark3d/grilla.ts foto.jpg /tmp/zoom.png 50 --recorte 800x600+1200+900   # una zona, más fina
 */
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const FUENTE = "/System/Library/Fonts/Supplemental/Arial.ttf";
const LADO = 1200;

const { positionals, values } = parseArgs({ allowPositionals: true, options: { recorte: { type: "string" } } });
const [foto, salida, pasoTexto] = positionals;
if (!foto || !salida) throw new Error("Uso: grilla.ts <foto> <salida.png> [paso] [--recorte AxB+X+Y]");

const [W, H] = execFileSync("magick", ["identify", "-format", "%w %h", foto], { encoding: "utf8" }).split(" ").map(Number);
const [rw, rh, rx, ry] = values.recorte?.match(/^(\d+)x(\d+)\+(\d+)\+(\d+)$/)?.slice(1).map(Number) ?? [W, H, 0, 0];
const escala = Math.min(1, LADO / Math.max(rw, rh));
const paso = Number(pasoTexto) || Math.max(10, Math.round(Math.max(rw, rh) / 15 / 10) * 10);

const dibujo: string[] = ["-font", FUENTE, "-pointsize", "14"];
const primera = (desde: number) => Math.ceil(desde / paso) * paso;
for (let x = primera(rx); x < rx + rw; x += paso) {
  const v = Math.round((x - rx) * escala);
  dibujo.push("-stroke", "#ff0040", "-draw", `line ${v},0 ${v},${LADO}`, "-stroke", "none", "-fill", "#ff0040", "-draw", `text ${v + 2},14 '${x}'`);
}
for (let y = primera(ry); y < ry + rh; y += paso) {
  const v = Math.round((y - ry) * escala);
  dibujo.push("-stroke", "#00a0ff", "-draw", `line 0,${v} ${LADO},${v}`, "-stroke", "none", "-fill", "#00a0ff", "-draw", `text 2,${v - 2} '${y}'`);
}
execFileSync("magick", [foto, "-crop", `${rw}x${rh}+${rx}+${ry}`, "+repage", "-resize", `${escala * 100}%`, ...dibujo, salida]);
console.log(`${W} × ${H} px; grilla cada ${paso} px${values.recorte ? ` en ${values.recorte}` : ""} → ${salida}`);
