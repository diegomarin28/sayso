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
 *
 * Precalentar (solo /api/knowledge y /api/plano, sin chat; deja todo en la caché de Supabase; tope 0,50 USD):
 *   npx tsx scripts/bateria/correr.ts --precalentar --confirmo-gasto [--equipos "HP|250 G9|notebook; Samsung|Galaxy A15|celular"] [--tope 0.5]
 * Seguridad, SIN IA (no hace falta la app ni gasta nada): qué pedidos peligrosos frena el código
 * y que las preguntas normales no se bloqueen de más:
 *   npx tsx scripts/bateria/correr.ts --seguridad
 *
 * Ensayo general de la demo (los 4 equipos de CASOS_DEMO, IA real):
 *   npx tsx --env-file=.env.local scripts/bateria/correr.ts --demo --confirmo-gasto --sin-comparar --tope 0.45
 *
 * "Mis casos" con lo que ya está en la caché, SIN IA (para ver la guía y el 3D en el celular; ver mis-casos.ts):
 *   npx tsx --env-file=.env.local scripts/bateria/correr.ts --mis-casos --demo --salida mis-casos.json
 *
 * `--demo` con `--precalentar`: los equipos de la demo (EQUIPOS_DEMO en precalentar.ts). Sin `--equipos` ni `--demo`,
 * precalienta los equipos de la batería (`--solo` también vale).
 */
import { writeFileSync } from "node:fs";
import { correrBateria, tabla, tablaPlano } from "./bateria";
import { CASOS, CASOS_DEMO } from "./casos";
import { revisarSeguridad, tablaSeguridad } from "./seguridad";
import { EQUIPOS_DEMO, leerEquipos, precalentar, SINTOMA_PRECALENTAR, tablaPrecalentar, type EquipoPrecalentar } from "./precalentar";

function opcion(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Tope por defecto: la batería completa, 1 USD; el precalentado, 0,50 USD. */
const TOPE_BATERIA_USD = 1;
const TOPE_PRECALENTAR_USD = 0.5;

async function main() {
  if (process.argv.includes("--seguridad")) {
    console.log(tablaSeguridad(revisarSeguridad()));
    return;
  }
  const base = (opcion("--base") ?? "http://localhost:3000").replace(/\/$/, "");
  const modoPrecalentar = process.argv.includes("--precalentar");
  const topeUsd = Number(opcion("--tope") ?? (modoPrecalentar ? TOPE_PRECALENTAR_USD : TOPE_BATERIA_USD));
  if (!Number.isFinite(topeUsd) || topeUsd <= 0) throw new Error("--tope tiene que ser un número de USD mayor que 0");
  // --demo: los equipos de la demo (ensayo general); si no, los 9 de la batería.
  const todos = process.argv.includes("--demo") ? CASOS_DEMO : CASOS;
  const solo = opcion("--solo")?.split(",");
  const casos = solo ? todos.filter((c) => solo.includes(c.id)) : todos;
  if (casos.length === 0) throw new Error(`--solo no coincide con ningún caso (${todos.map((c) => c.id).join(", ")})`);

  if (process.argv.includes("--mis-casos")) {
    const salida = opcion("--salida");
    if (!salida) throw new Error("--mis-casos necesita --salida archivo.json");
    // Import tardío: trae el cliente de Supabase del servidor.
    const { supabaseServidor } = await import("../../lib/supabase/cliente");
    const { misCasosDeLaCache } = await import("./mis-casos");
    const db = supabaseServidor();
    if (!db) throw new Error("Sin Supabase: corré con `npx tsx --env-file=.env.local …`.");
    const r = await misCasosDeLaCache(db, casos);
    for (const c of r.casos) console.log(`  ✓ ${c.ficha?.marca.valor} ${c.ficha?.modelo.valor}: ${c.guia?.preparado.pack.pasos.length} pasos, ${c.guia?.plano.plano.piezas.length} piezas`);
    for (const f of r.faltan) console.log(`  ✗ ${f.id}: ${f.falta}`);
    writeFileSync(salida, JSON.stringify(r.casos, null, 2));
    console.log(`${r.casos.length} casos en ${salida}: cargalos en localStorage["sayso:mis-casos:v1"] y abrí "Mis casos".`);
    return;
  }

  if (modoPrecalentar) {
    const lista = process.argv.includes("--demo") ? EQUIPOS_DEMO : opcion("--equipos");
    const equipos: EquipoPrecalentar[] = lista
      ? leerEquipos(lista)
      : casos.map((c) => ({ marca: c.marca, modelo: c.modelo, tipoEquipo: c.tipoEquipo, clase: c.clase }));
    console.log(`Precalentar: ${equipos.length} equipos contra ${base} (solo knowledge y plano), tope US$ ${topeUsd}.`);
    for (const e of equipos) console.log(`  - ${e.marca} ${e.modelo} (${e.tipoEquipo}, clase ${e.clase})`);
    console.log(`  Síntoma con el que se guarda el pack: "${SINTOMA_PRECALENTAR}"`);
    if (!process.argv.includes("--confirmo-gasto")) {
      console.log("\nNo corrí nada: usa IA real y gasta saldo. Para correrlo, agregá --confirmo-gasto.");
      return;
    }
    const salud = await fetch(`${base}/api/health`).catch(() => null);
    if (!salud?.ok) throw new Error(`La app no responde en ${base} (¿está corriendo next start?)`);
    const r = await precalentar(equipos, { base, topeUsd, log: (l) => console.log(l) });
    console.log(`\n${tablaPrecalentar(r.filas, r.totalUsd)}`);
    if (r.cortado) console.log(`\nSe cortó por el tope de US$ ${topeUsd} (o la IA en pausa): los equipos sin correr quedan marcados.`);
    const salida = opcion("--salida");
    if (salida) {
      writeFileSync(salida, JSON.stringify({ base, topeUsd, ...r }, null, 2));
      console.log(`Resultados en ${salida}`);
    }
    return;
  }

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
