/** GLB de revisión con la geometría publicada y las mismas recetas que el visor. */
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize, prune } from "@gltf-transform/functions";
import { MeshoptDecoder } from "meshoptimizer";
import { BufferAttribute, BufferGeometry, Color } from "three";
import { RECETAS_DETALLE, recetaPara, type Receta } from "../../../lib/planogenerator/materiales";

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const [entrada, salida] = process.argv.slice(2);
if (!entrada || !salida) throw new Error("Uso: tsx decodificar.ts carpeta-glb carpeta-revision");
await mkdir(salida, { recursive: true });
for (const archivo of (await readdir(entrada)).filter((f) => f.endsWith(".glb"))) {
  const doc = await io.read(path.join(entrada, archivo));
  await doc.transform(dequantize());
  for (const tipo of doc.getRoot().getDefaultScene()!.listChildren()) {
    const catalogo = doc.getRoot().getDefaultScene()!.getExtras().paletaRecetas as string[] | undefined;
    const recetas = (tipo.getExtras().recetas as Array<string | number> | undefined)?.map((r) =>
      typeof r === "number" ? catalogo![r] : r);
    if (!recetas) continue;
    const mesh = tipo.listChildren()[0].getMesh()!;
    const p = mesh.listPrimitives()[0];
    if (!p.getAttribute("NORMAL")) {
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(p.getAttribute("POSITION")!.getArray() as Float32Array, 3));
      g.setIndex(new BufferAttribute(p.getIndices()!.getArray() as Uint32Array, 1));
      g.computeVertexNormals();
      p.setAttribute("NORMAL", doc.createAccessor().setType("VEC3")
        .setArray(new Float32Array(g.getAttribute("normal").array)).setBuffer(p.getAttribute("POSITION")!.getBuffer()));
    }
    const etiquetas = p.getAttribute("COLOR_0")!;
    const etiqueta = (i: number) => Math.round(etiquetas.getElement(i, [0, 0, 0, 0])[3] * 255);
    const indices = p.getIndices()!;
    mesh.removePrimitive(p);
    for (let r = 0; r < recetas.length; r++) {
      const elegidos: number[] = [];
      for (let i = 0; i < indices.getCount(); i += 3) {
        if (etiqueta(indices.getScalar(i)) === r)
          elegidos.push(indices.getScalar(i), indices.getScalar(i + 1), indices.getScalar(i + 2));
      }
      if (!elegidos.length) continue;
      const receta = recetas[r];
      const propia = recetaPara(tipo.getName());
      const detalle = RECETAS_DETALLE[receta as keyof typeof RECETAS_DETALLE];
      const datos: Receta = receta === "cuerpo" ? propia : propia.opacity === undefined ? detalle : { ...detalle, opacity: Math.min(1, propia.opacity * 2) };
      if (!datos) throw new Error("Receta desconocida: " + receta);
      const color = new Color(datos.color);
      const mat = doc.createMaterial(receta === "cuerpo" ? `cuerpo.${tipo.getName().split("@")[0]}` : receta)
        .setBaseColorFactor([color.r, color.g, color.b, datos.opacity ?? 1])
        .setMetallicFactor(datos.metalness).setRoughnessFactor(datos.roughness)
        .setAlphaMode(datos.opacity === undefined ? "OPAQUE" : "BLEND");
      const parte = p.clone().setMaterial(mat).setAttribute("COLOR_0", null).setAttribute("_RECETA", null);
      parte.setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(elegidos)).setBuffer(indices.getBuffer()));
      mesh.addPrimitive(parte);
    }
  }
  for (const ext of doc.getRoot().listExtensionsUsed()) if (ext.extensionName.includes("meshopt")) ext.dispose();
  await doc.transform(prune({ keepLeaves: true }));
  await io.write(path.join(salida, archivo), doc);
}
