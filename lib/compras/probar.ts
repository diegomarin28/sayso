/**
 * Prueba real del agente de compras. Llama a Claude de verdad (búsqueda y lectura web, ~0,04 USD).
 *
 *   npx tsx --env-file=.env.local lib/compras/probar.ts "ventilador" "5F10S13875" "ThinkPad E14 Gen 2" "Lenovo"
 */
import { buscarOpciones } from "./agente";

async function main() {
  const [pieza, numeroParte, modelo, marca] = process.argv.slice(2);
  if (!pieza || !modelo) {
    console.error('Uso: probar.ts "<pieza>" "<número de parte o ->" "<modelo>" ["<marca>"]');
    process.exit(1);
  }
  const r = await buscarOpciones({ pieza, numeroParte: numeroParte === "-" ? null : numeroParte, modelo, marca });
  for (const o of r.opciones) {
    console.log(
      `\n[${o.compatibilidad}] ${o.titulo} — ${o.tienda}\n  ${o.precio.moneda} ${o.precio.monto} (${o.precio.estado}) + envío ${o.envio.monto ?? "?"} (${o.envio.estado}) = ${o.totalUyu ?? "?"} UYU\n  ${o.url}`,
    );
  }
  if (!r.opciones.length) console.log("Sin opciones.");
  console.log("\nCotización:", r.cotizacion ?? "ninguna");
  console.log("Descartados:", r.descartados.length ? `\n  ${r.descartados.join("\n  ")}` : "ninguno");
  console.log("Costo:", r.costo);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
