/**
 * Mueve las fotos viejas de las personas al bucket privado (issue #330). Sin IA, no gasta nada.
 * Antes: correr la migración 010_fotos_privadas.sql en el SQL Editor.
 *
 *   npx tsx --env-file=.env.local scripts/fotos-privadas/correr.ts             # solo lista, no mueve nada
 *   npx tsx --env-file=.env.local scripts/fotos-privadas/correr.ts --aplicar   # mueve y actualiza la tabla `fotos`
 *
 * Se puede correr varias veces: lo que ya se movió no está más en el público.
 */
import { supabaseServidor } from "../../lib/supabase/cliente";
import { fotosDePersonas, moverFotos } from "./mover";

async function main() {
  const db = supabaseServidor();
  if (!db) throw new Error("Faltan las variables de Supabase (¿--env-file=.env.local?)");
  const aplicar = process.argv.includes("--aplicar");
  const rutas = await fotosDePersonas(db);
  console.log(`${rutas.length} fotos de personas en el bucket público \`fotos\`.`);
  const resultados = await moverFotos(db, rutas, aplicar);
  for (const r of resultados) console.log(`${r.estado.padEnd(9)} ${r.ruta}${r.fila ? ` (fila: ${r.fila})` : ""}${r.error ? ` — ${r.error}` : ""}`);
  const errores = resultados.filter((r) => r.estado === "error").length;
  if (!aplicar) console.log("\nNo se movió nada. Para moverlas: --aplicar");
  else console.log(`\nMovidas: ${resultados.length - errores}. Errores: ${errores}.`);
  if (errores) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
