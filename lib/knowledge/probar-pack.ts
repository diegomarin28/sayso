/**
 * Prueba real del knowledge pack. Llama a Claude de verdad (búsqueda web + lectura del PDF).
 *
 *   npx tsx --env-file=.env.local lib/knowledge/probar-pack.ts "Lenovo" "ThinkPad E14 Gen 2" "se apaga sola y el ventilador suena fuerte"
 *   npx tsx --env-file=.env.local lib/knowledge/probar-pack.ts --solo-buscar "Lenovo" "ThinkPad E14 Gen 2"
 */
import type { Ficha } from "../../shared";
import { armarKnowledgePack } from "./armar";
import { buscarManual } from "./buscar";
import { descargarPdf } from "./descargar";

async function main() {
  const args = process.argv.slice(2);
  const soloBuscar = args[0] === "--solo-buscar";
  const [marca, modelo, sintoma = "no prende"] = soloBuscar ? args.slice(1) : args;
  if (!marca || !modelo) {
    console.error('Uso: probar-pack.ts [--solo-buscar] "<marca>" "<modelo>" "<síntoma>"');
    process.exit(1);
  }

  if (soloBuscar) {
    const candidatos = await buscarManual({ marca, modelo, clase: "notebook" });
    for (const c of candidatos) {
      const pdf = await descargarPdf(c.url);
      console.log(`${pdf ? "PDF ✔" : "no PDF"}  [${c.fuente}${c.modeloExacto ? ", exacto" : ""}] ${c.titulo}\n        ${c.url}`);
    }
    return;
  }

  const ficha: Ficha = {
    casoId: "prueba",
    clase: "notebook",
    marca: { valor: marca, estado: "confirmado", fuente: "usuario" },
    modelo: { valor: modelo, estado: "confirmado", fuente: "usuario" },
    serie: { valor: null, estado: "desconocido" },
    anio: { valor: null, estado: "desconocido" },
    confirmadaPorUsuario: true,
  };
  const t0 = Date.now();
  const { pack, manual, eventos } = await armarKnowledgePack({ ficha, sintoma });
  for (const e of eventos) console.log(`· ${e.mensaje}`);
  console.log(`\nManual: ${manual ? `${manual.url} (${(manual.bytes / 1e6).toFixed(1)} MB)` : "ninguno"}  verificado=${pack.verificado}`);
  console.log("\nPiezas:");
  for (const p of pack.piezas) console.log(`  ${p.id.padEnd(20)} ${p.ubicacion}${p.etiquetaManual ? `  (#${p.etiquetaManual})` : ""}`);
  console.log("\nPasos:");
  for (const p of pack.pasos) {
    const cita = p.cita ? `${p.cita.estado} p.${p.cita.pagina ?? "-"}` : "NO VERIFICADO";
    console.log(`  ${p.orden}. [${p.riesgo}] ${p.texto}  — ${cita}`);
  }
  console.log("\nRepuestos:", pack.repuestos.map((r) => `${r.pieza}=${r.numeroParte} (p.${r.cita.pagina})`).join(", ") || "ninguno");
  console.log("Advertencias:", pack.advertencias.length);
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

main().catch((e) => {
  console.error("ERROR:", e.message, e.detalle ?? "");
  process.exit(1);
});
