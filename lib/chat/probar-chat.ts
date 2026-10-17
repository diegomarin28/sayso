/**
 * Prueba real del chat. Arma (o reusa) el knowledge pack y hace preguntas.
 *
 *   npx tsx --env-file=.env.local lib/chat/probar-chat.ts <pack.json> "Lenovo" "ThinkPad E14 Gen 2" "¿Dónde está el SSD?" "..."
 *
 * Si <pack.json> no existe, lo arma (~1 USD) y lo guarda ahí (con el file_id del manual, que vence en 7 días).
 * Guardalo fuera del repo.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Ficha, KnowledgePack } from "../../shared";
import { armarKnowledgePack } from "../knowledge/armar";
import { conversar } from "./conversar";

async function main() {
  const [rutaPack, marca, modelo, ...preguntas] = process.argv.slice(2);
  if (!rutaPack || !marca || !modelo || preguntas.length === 0) {
    console.error('Uso: probar-chat.ts <pack.json> "<marca>" "<modelo>" "<pregunta>" ...');
    process.exit(1);
  }

  let guardado: { pack: KnowledgePack; manualFileId: string | null };
  if (existsSync(rutaPack)) {
    guardado = JSON.parse(readFileSync(rutaPack, "utf8"));
  } else {
    const campo = (valor: string) => ({ valor, estado: "confirmado" as const, fuente: "usuario" });
    const ficha: Ficha = {
      casoId: "prueba",
      clase: "notebook",
      marca: campo(marca),
      modelo: campo(modelo),
      serie: { valor: null, estado: "desconocido" },
      anio: { valor: null, estado: "desconocido" },
      confirmadaPorUsuario: true,
    };
    const { pack, manual } = await armarKnowledgePack({ ficha, sintoma: "guía general del equipo" });
    guardado = { pack, manualFileId: manual?.fileId ?? null };
    writeFileSync(rutaPack, JSON.stringify(guardado, null, 1));
    console.log(`Pack armado y guardado en ${rutaPack}\n`);
  }

  for (const pregunta of preguntas) {
    const t0 = Date.now();
    let primera = 0;
    console.log(`\n> ${pregunta}`);
    for await (const e of conversar({ casoId: "prueba", ...guardado, pregunta })) {
      if (!primera) primera = Date.now() - t0;
      if (e.tipo === "paso" || e.tipo === "bloqueo") {
        const c = e.coreografia;
        const cita = c.cita ? ` — ${c.cita.estado} p.${c.cita.pagina}` : " — NO VERIFICADO";
        const acciones = c.acciones.map((a) => a.t + ("pieza" in a ? `:${a.pieza}` : "objetivo" in a ? `:${a.objetivo}` : "")).join(" ");
        console.log(`  ${e.tipo === "bloqueo" ? "⛔" : "·"} ${c.dice}${cita}${acciones ? `   {${acciones}}` : ""}`);
      } else if (e.tipo === "error") console.log(`  ERROR ${e.mensaje}`);
    }
    console.log(`  (primer evento ${(primera / 1000).toFixed(1)} s, total ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
