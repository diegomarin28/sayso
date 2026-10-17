/**
 * Corre la batería de pruebas contra la app (IA real: GASTA SALDO).
 *
 *   npm run build && npx next start -p 3000          # en otra terminal
 *   npx tsx scripts/bateria/correr.ts                # muestra el plan, no gasta nada
 *   npx tsx scripts/bateria/correr.ts --confirmo-gasto [--base http://localhost:3000] [--tope 1] [--solo celular,split] [--salida bateria.json]
 *
 * Corta si el gasto acumulado pasa `--tope` USD (por defecto 1). Al final imprime la tabla y,
 * con `--salida`, guarda los resultados en JSON.
 */
import { writeFileSync } from "node:fs";
import { correrBateria, tabla } from "./bateria";
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

  console.log(`Batería: ${casos.length} equipos contra ${base}, tope US$ ${topeUsd}.`);
  for (const c of casos) console.log(`  - ${c.equipo}: ${c.marca} ${c.modelo}`);
  if (!process.argv.includes("--confirmo-gasto")) {
    console.log("\nNo corrí nada: usa IA real y gasta saldo. Para correrla, agregá --confirmo-gasto.");
    return;
  }

  const salud = await fetch(`${base}/api/health`).catch(() => null);
  if (!salud?.ok) throw new Error(`La app no responde en ${base} (¿está corriendo next start?)`);

  const { filas, totalUsd, cortado } = await correrBateria(casos, { base, topeUsd, log: (l) => console.log(l) });
  console.log(`\n${tabla(filas, totalUsd)}`);
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
