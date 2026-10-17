/**
 * Corre la batería de pruebas contra la app (IA real: GASTA SALDO).
 *
 *   npm run build && npx next start -p 3000          # en otra terminal
 *   npx tsx --env-file=.env.local scripts/bateria/correr.ts                  # muestra el plan, no gasta nada
 *   npx tsx --env-file=.env.local scripts/bateria/correr.ts --confirmo-gasto [--base http://localhost:3000] [--tope 1] [--solo celular,split] [--salida bateria.json] [--sin-comparar]
 *
 * Corta si el gasto acumulado pasa `--tope` USD (por defecto 1). Por defecto también compara el
 * plano 3D con Sonnet y con Haiku (corre en este proceso: necesita la clave de .env.local; cuenta
 * para el tope); `--sin-comparar` lo saltea. Al final imprime las tablas y, con `--salida`,
 * guarda los resultados en JSON.
 */
import { writeFileSync } from "node:fs";
import { correrBateria, tabla, tablaPlano } from "./bateria";
import { CASOS } from "./casos";

function opcion(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const base = (opcion("--base") ?? "http://localhost:3000").replace(/\/$/, "");
  const topeUsd = Number(opcion("--tope") ?? 1);
  if (!Number.isFinite(topeUsd) || topeUsd <= 0) throw new Error("--tope tiene que ser un número de USD mayor que 0");
  const solo = opcion("--solo")?.split(",");
  const casos = solo ? CASOS.filter((c) => solo.includes(c.id)) : CASOS;
  if (casos.length === 0) throw new Error(`--solo no coincide con ningún caso (${CASOS.map((c) => c.id).join(", ")})`);

  const comparar = !process.argv.includes("--sin-comparar");
  console.log(`Batería: ${casos.length} equipos contra ${base}, tope US$ ${topeUsd}${comparar ? ", con el plano 3D en Sonnet y en Haiku" : ""}.`);
  for (const c of casos) console.log(`  - ${c.equipo}: ${c.marca} ${c.modelo}`);
  if (!process.argv.includes("--confirmo-gasto")) {
    console.log("\nNo corrí nada: usa IA real y gasta saldo. Para correrla, agregá --confirmo-gasto.");
    return;
  }

  const salud = await fetch(`${base}/api/health`).catch(() => null);
  if (!salud?.ok) throw new Error(`La app no responde en ${base} (¿está corriendo next start?)`);
  if (comparar && !process.env.ANTHROPIC_API_KEY) {
    throw new Error("Para comparar el plano hace falta la clave: corré con `npx tsx --env-file=.env.local …` (o usá --sin-comparar).");
  }
  // Import tardío: el comparador trae el código del servidor (IA y Supabase) solo si se usa.
  const compararPlano = comparar ? (await import("./comparar-plano")).compararPlano : undefined;

  const { filas, totalUsd, cortado } = await correrBateria(casos, { base, topeUsd, log: (l) => console.log(l), compararPlano });
  console.log(`\n${tabla(filas, totalUsd)}`);
  if (comparar) console.log(`\nPlano 3D: Sonnet vs Haiku\n\n${tablaPlano(filas)}`);
  if (cortado) console.log(`\nSe cortó por el tope de US$ ${topeUsd} (o la IA en pausa): los equipos sin correr quedan marcados.`);
  const salida = opcion("--salida");
  if (salida) {
    writeFileSync(salida, JSON.stringify({ base, topeUsd, totalUsd, cortado, filas }, null, 2));
    console.log(`Resultados en ${salida}`);
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
