/**
 * Retención de 90 días (docs/login.md §5, issue #347). Sin IA, no gasta nada. BORRADO PERMANENTE.
 * Antes: la migración 012_login.sql.
 *
 *   npx tsx --env-file=.env.local scripts/retencion/correr.ts             # solo cuenta, no borra nada
 *   npx tsx --env-file=.env.local scripts/retencion/correr.ts --aplicar   # borra
 *
 * Solo muestra cantidades: nunca emails, ids ni contenido de los casos. Se puede correr varias veces.
 */
import { supabaseServidor } from "../../lib/supabase/cliente";
import { DIAS, retencion } from "./vencidos";

async function main() {
  const db = supabaseServidor();
  if (!db) throw new Error("Faltan las variables de Supabase (¿--env-file=.env.local?)");
  const aplicar = process.argv.includes("--aplicar");
  const r = await retencion(db, { aplicar });
  const verbo = aplicar ? "Borradas" : "Se borrarían";
  console.log(`${verbo}: ${r.sesiones} sesiones anónimas sin actividad en ${DIAS} días, con ${r.casosDeSesiones} casos.`);
  console.log(`${aplicar ? "Borrados" : "Se borrarían"}: ${r.casosHuerfanos} casos huérfanos (sin dueño ni dispositivo) de más de ${DIAS} días.`);
  if (!aplicar) {
    console.log("\nNo se borró nada. Para borrar: --aplicar");
    return;
  }
  console.log(`Archivos borrados de fotos-usuarios: ${r.archivos}.`);
  if (r.salteadas) console.log(`Salteadas (volvieron a usar la app o guardaron sus casos): ${r.salteadas}.`);
  console.log(`Errores: ${r.errores.length}.`);
  for (const e of r.errores) console.log(`  — ${e}`);
  if (r.errores.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
