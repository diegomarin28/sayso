/**
 * Corre el generador con la IA real sobre cada caso, N veces (gasta créditos).
 *   npx tsx --env-file=.env.local lib/planogenerator/evaluacion/correr.ts manuales <salida> [--veces 3] [--pdf]
 * Guarda <salida>/plano-<caso>-<n>.json.
 * Sin --pdf manda las dos imágenes recortadas; con --pdf sube el manual completo a la Files
 * API y le pasa solo la página de la vista explosionada, como en producción (/api/plano).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { subirArchivo } from "../../ia/claude";
import { generarPlano, type EntradaGenerador } from "../generador";
import { cargarCasos, imagenes } from "./caso";

const png = (archivo: string) => ({ base64: readFileSync(archivo).toString("base64"), mediaType: "image/png" as const });

async function main() {
  const [raiz, salida] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const i = process.argv.indexOf("--veces");
  const veces = i >= 0 ? Number(process.argv[i + 1]) : 1;
  const conPdf = process.argv.includes("--pdf");
  if (!raiz || !salida) throw new Error("Uso: correr.ts <carpeta con casos> <salida> [--veces N]");
  mkdirSync(salida, { recursive: true });
  for (const c of cargarCasos(raiz)) {
    const img = imagenes(c);
    const base: EntradaGenerador = { casoId: `eval-${c.nombre}`, knowledgePack: c.kp };
    const entrada: EntradaGenerador = conPdf
      ? {
          ...base,
          manual: {
            fileId: await subirArchivo(readFileSync(path.join(c.dir, "manual.pdf")), "manual.pdf"),
            paginasVistaExplosionada: [c.caso.fuente.paginaExplosionada],
          },
        }
      : {
          ...base,
          imagenes: [png(img.explosionada), png(img.interior)],
          paginas: [c.caso.fuente.paginaExplosionada, c.caso.fuente.paginaInterior],
        };
    for (let n = 1; n <= veces; n++) {
      const t0 = Date.now();
      const r = await generarPlano(entrada);
      writeFileSync(path.join(salida, `plano-${c.nombre}-${n}.json`), JSON.stringify(r.plano, null, 2));
      console.log(`${c.nombre} #${n}: ${r.origen}, ${((Date.now() - t0) / 1000).toFixed(1)} s, ${r.avisos.length} avisos`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
