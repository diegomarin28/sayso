/**
 * Comprime los GLB de la biblioteca de piezas con meshopt (EXT_meshopt_compression), que three lee
 * con su propio decodificador (lib/planogenerator/cargador.ts): sin archivos aparte que servir.
 *
 *   npm run modelos:comprimir            # todas las familias de public/models/piezas/indice.json
 *
 * Corre después de cada `npm run modelos:*`. Saltea los GLB que ya están comprimidos (no cuantiza dos veces).
 * Antes de cuantizar guarda en el índice la caja REAL de cada tipo (`caja`, en cm): un test compara la
 * caja que sale del GLB comprimido con esa, así nunca cambia el tamaño (y con él la elección de variante,
 * los AJUSTES ni los tramos de cables y lentes).
 * - Cuantización por malla (la escala queda en el nodo de la malla, no en el del tipo), posiciones de 16 bits.
 * - No deduplica materiales: la receta de la app sale del NOMBRE del material.
 */
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { quantize, reorder } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

const carpeta = process.argv[2] ?? "public/models/piezas";
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

const rutaIndice = join(carpeta, "indice.json");
const indice = JSON.parse(readFileSync(rutaIndice, "utf8"));

/** Producto de matrices 4×4 de glTF (por columnas). */
function por(a, b) {
  const r = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
  return r;
}

/** Caja de un tipo en el espacio de su nodo (como `bibliotecaDesdeEscena`), recorriendo los vértices. */
function cajaDe(tipo) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const recorrer = (nodo, m) => {
    const malla = nodo.getMesh();
    if (malla) {
      for (const prim of malla.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        const v = [0, 0, 0];
        for (let i = 0; i < pos.getCount(); i++) {
          pos.getElement(i, v);
          for (let e = 0; e < 3; e++) {
            const w = m[e] * v[0] + m[4 + e] * v[1] + m[8 + e] * v[2] + m[12 + e];
            min[e] = Math.min(min[e], w);
            max[e] = Math.max(max[e], w);
          }
        }
      }
    }
    for (const hijo of nodo.listChildren()) recorrer(hijo, por(m, hijo.getMatrix()));
  };
  for (const hijo of tipo.listChildren()) recorrer(hijo, hijo.getMatrix());
  if (!Number.isFinite(min[0])) return null;
  return max.map((v, e) => +(v - min[e]).toFixed(4));
}

for (const archivo of Object.values(indice.familias)) {
  const ruta = join(carpeta, archivo);
  const doc = await io.read(ruta);
  if (doc.getRoot().listExtensionsUsed().some((e) => e.extensionName === "EXT_meshopt_compression")) {
    console.log(`${archivo}: ya estaba comprimido`);
    continue;
  }
  for (const tipo of doc.getRoot().getDefaultScene().listChildren()) {
    const caja = cajaDe(tipo);
    if (caja && indice.tipos[tipo.getName()]) indice.tipos[tipo.getName()].caja = caja;
  }
  const antes = statSync(ruta).size;
  await doc.transform(
    reorder({ encoder: MeshoptEncoder }),
    quantize({ quantizationVolume: "mesh", quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: 12 }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await io.write(ruta, doc);
  console.log(`${archivo}: ${(antes / 1024).toFixed(0)} KB → ${(statSync(ruta).size / 1024).toFixed(0)} KB`);
}
writeFileSync(rutaIndice, JSON.stringify(indice, null, 1) + "\n");
