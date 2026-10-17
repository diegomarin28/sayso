/**
 * Prueba real del generador del plano (B4). Llama a Claude de verdad.
 *
 *   npx tsx --env-file=.env.local lib/planogenerator/probar-plano.ts [kp.json] [pagina.png ...] [--pag 54,55] [--salida plano.json]
 *
 * Sin kp.json usa el knowledge pack del fixture. Las imágenes son páginas del manual
 * (vista explosionada o inferior); no subirlas al repo (copyright).
 * El plano generado se puede pegar en /lab/visor ("Pegar plano") para verlo.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { KnowledgePack, knowledgePackEjemplo } from "../../shared";
import type { ImagenEntrada } from "../ia/claude";
import { generarPlano } from "./generador";

const TIPOS: Record<string, ImagenEntrada["mediaType"]> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

async function main() {
  const args = process.argv.slice(2);
  const opcion = (nombre: string) => {
    const i = args.indexOf(nombre);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const paginas = opcion("--pag")?.split(",").map(Number);
  const salida = opcion("--salida");
  const kpArchivo = args.find((a) => a.endsWith(".json"));
  const kp = kpArchivo ? KnowledgePack.parse(JSON.parse(readFileSync(kpArchivo, "utf8"))) : knowledgePackEjemplo;
  const imagenes = args
    .filter((a) => /\.(png|jpe?g|webp)$/i.test(a))
    .map((a): ImagenEntrada => {
      const buf = readFileSync(a);
      if (buf.length > 5_000_000) throw new Error(`${a} pesa más de 5 MB: achicala antes.`);
      return { base64: buf.toString("base64"), mediaType: TIPOS[a.split(".").pop()!.toLowerCase()] };
    });

  console.log(`Modelo: ${kp.modelo} · ${kp.piezas.length} piezas · ${imagenes.length} imágenes\n`);
  const t0 = Date.now();
  const r = await generarPlano({ casoId: "prueba", knowledgePack: kp, imagenes, paginas });
  console.log(`Origen: ${r.origen} · ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);
  for (const p of r.propuesta?.piezas ?? []) {
    console.log(`  ${p.pieza.padEnd(22)} x=${p.x.toFixed(2).padStart(5)} z=${p.z.toFixed(2).padStart(5)} ${p.capa.padEnd(11)} n.º ${p.etiquetaManual ?? "—"} pág ${p.pagina ?? "—"} [${p.confianza}]`);
  }
  console.log(`\nAvisos (${r.avisos.length}):`);
  r.avisos.forEach((a) => console.log(`  - ${a}`));
  if (salida) {
    writeFileSync(salida, JSON.stringify(r.plano, null, 2));
    console.log(`\nPlano guardado en ${salida}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
