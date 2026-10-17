/**
 * Prueba real de lectura de chapas (puerta de la hora 2). Llama a Claude de verdad.
 *
 *   npx tsx --env-file=.env.local lib/intake/probar-chapas.ts C:\Users\juanm\chapas
 *
 * Opcional: un `esperado.json` en la carpeta para medir aciertos:
 *   { "foto1.jpg": { "modelo": "20XW-CTO1WW", "serie": "PF2ABC12" } }
 * Las fotos tienen números de serie: no subirlas al repo.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { Campo, Ficha } from "../../shared";
import { evaluarFoto } from "./calidad";
import { leerChapa, normalizar } from "./chapa";

const EXT = /\.(jpe?g|png|webp)$/i;
type Esperado = Record<string, Partial<Record<"marca" | "modelo" | "serie", string>>>;

/** Achica a 1568 px de lado (lo que usa Claude) y pasa a JPEG. */
async function cargar(archivo: string) {
  const buf = await sharp(archivo).rotate().resize(1568, 1568, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return { base64: buf.toString("base64"), mediaType: "image/jpeg" as const };
}

function mostrar(c: Campo) {
  return `${c.valor ?? "—"} [${c.estado}]`;
}

async function main() {
  const carpeta = process.argv[2];
  if (!carpeta || !existsSync(carpeta)) {
    console.error("Uso: npx tsx --env-file=.env.local lib/intake/probar-chapas.ts <carpeta con fotos>");
    process.exit(1);
  }
  const rutaEsperado = path.join(carpeta, "esperado.json");
  const esperado: Esperado = existsSync(rutaEsperado) ? JSON.parse(readFileSync(rutaEsperado, "utf8")) : {};
  const archivos = readdirSync(carpeta).filter((f) => EXT.test(f)).sort();
  console.log(`${archivos.length} fotos en ${carpeta}\n`);

  let comparados = 0;
  let aciertos = 0;
  let confirmadosMal = 0;

  for (const nombre of archivos) {
    const imagen = await cargar(path.join(carpeta, nombre));
    try {
      const { foto } = await evaluarFoto({ casoId: "prueba", tipoPedido: "etiqueta", imagen });
      let ficha: Ficha | null = null;
      if (foto.aceptada) ({ ficha } = await leerChapa({ casoId: "prueba", clase: "notebook", imagenes: [imagen] }));

      console.log(`■ ${nombre}  nitidez ${foto.calidad.nitidez.toFixed(2)}  ${foto.aceptada ? "ACEPTADA" : `RECHAZADA: ${foto.motivoRechazo}`}`);
      if (ficha) {
        console.log(`   marca ${mostrar(ficha.marca)} | modelo ${mostrar(ficha.modelo)} | serie ${mostrar(ficha.serie)} | año ${mostrar(ficha.anio)}`);
        for (const [campo, valor] of Object.entries(esperado[nombre] ?? {})) {
          const leido = ficha[campo as "marca" | "modelo" | "serie"];
          const ok = leido.valor !== null && normalizar(leido.valor) === normalizar(valor);
          comparados++;
          if (ok) aciertos++;
          if (!ok && leido.estado === "confirmado") confirmadosMal++;
          console.log(`   ${ok ? "✔" : "✘"} ${campo}: esperado ${valor}`);
        }
      }
    } catch (e) {
      console.log(`■ ${nombre}  ERROR: ${(e as Error).message}`);
    }
  }

  if (comparados) {
    console.log(`\nAciertos: ${aciertos}/${comparados} (${Math.round((100 * aciertos) / comparados)} %)`);
    console.log(`Confirmados que estaban mal (tiene que ser 0): ${confirmadosMal}`);
  }
}

main();
