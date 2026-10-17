/**
 * Baja el manual de cada caso y arma las imágenes (vista explosionada e interior).
 *   npx tsx lib/planogenerator/evaluacion/preparar.ts manuales
 * Requiere Ghostscript (gs) e ImageMagick (magick). Nada se sube al repo.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cargarCasos, imagenes } from "./caso";

async function main() {
  const raiz = process.argv[2];
  if (!raiz) throw new Error("Uso: preparar.ts <carpeta con casos>");
  for (const c of cargarCasos(raiz)) {
    const { fuente } = c.caso;
    const pdf = path.join(c.dir, "manual.pdf");
    if (!existsSync(pdf)) {
      const res = await fetch(fuente.url);
      if (!res.ok) throw new Error(`${c.nombre}: no se pudo bajar el manual (${res.status})`);
      writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));
    }
    mkdirSync(path.join(c.dir, "paginas"), { recursive: true });
    const img = imagenes(c);
    const pagina = (n: number, dpi: number, salida: string) =>
      execFileSync("gs", ["-q", "-dSAFER", "-dBATCH", "-dNOPAUSE", "-sDEVICE=png16m", `-r${dpi}`, `-dFirstPage=${n}`, `-dLastPage=${n}`, `-sOutputFile=${salida}`, pdf]);
    pagina(fuente.paginaExplosionada, 130, img.explosionada);
    const completa = path.join(c.dir, "paginas", "interior-pagina.png");
    pagina(fuente.paginaInterior, 220, completa);
    execFileSync("magick", [completa, "-crop", fuente.recorteInterior, "+repage", img.interior]);
    console.log(`${c.nombre}: listo`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
