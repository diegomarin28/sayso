/** Centra cada tipo y comprime su geometría sin cambiar IDs, recetas o extras. */
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Accessor, NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, getBounds, meshopt, prune, simplifyPrimitive, transformPrimitive, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const carpeta = process.argv[2] || 'public/models/piezas';
const destino = process.argv[3] || carpeta;
const informes = [];
for (const archivo of (await readdir(carpeta)).filter((f) => f.endsWith('.glb')).sort()) {
  const doc = await io.read(path.join(carpeta, archivo));
  doc.getRoot().getAsset().generator = "Sayso";
  doc.getRoot().getDefaultScene().setName("");
  for (const b of doc.getRoot().listBuffers()) b.setName("");
  for (const tipo of doc.getRoot().getDefaultScene().listChildren()) {
    const { min, max } = getBounds(tipo);
    const centro = min.map((v, i) => (v + max[i]) / 2);
    if (tipo.getExtras().recetas) throw new Error('Usá los GLB crudos recién exportados por Blender, no los ya optimizados.');
    const mesh = doc.createMesh();
    for (const hijo of tipo.listChildren()) {
      const matrix = hijo.getMatrix().slice();
      matrix[12] -= centro[0]; matrix[13] -= centro[1]; matrix[14] -= centro[2];
      for (const prim of hijo.getMesh()?.listPrimitives() || []) {
        const copia = prim.clone(); compactPrimitive(copia); transformPrimitive(copia, matrix);
        mesh.addPrimitive(copia);
      }
      tipo.removeChild(hijo); hijo.dispose();
    }
    tipo.addChild(doc.createNode().setMesh(mesh)).setTranslation([0, 0, 0]);
  }
  for (const a of doc.getRoot().listAccessors()) a.setName('');
  for (const m of doc.getRoot().listMeshes()) m.setName('');
  await doc.transform(
    dedup({ propertyTypes: [PropertyType.ACCESSOR] }),
    weld(),
    async () => {
      for (const tipo of doc.getRoot().getDefaultScene().listChildren()) {
        const protegida = /^(tramo|redondo):/.test(tipo.getExtras().ajuste || '');
        for (const p of tipo.listChildren()[0].getMesh().listPrimitives()) {
          if (protegida) continue;
          simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio: 0.1,
            error: /^(caja_reloj|pantalla@reloj|sensor_optico|bobina_carga)$/.test(tipo.getName()) ? 0.005 : archivo === 'cotidianos.glb' ? 0.055 : archivo === 'facultad.glb' ? 0.02 : 0.002 });
        }
      }
    },
    prune({ keepLeaves: true, keepAttributes: true }),
    async () => {
      // La simplificación puede cambiar levemente la caja: fijar el pivote final, no el crudo.
      for (const tipo of doc.getRoot().getDefaultScene().listChildren()) {
        const { min, max } = getBounds(tipo);
        const c = min.map((v, i) => (v + max[i]) / 2);
        const hijo = tipo.listChildren()[0];
        hijo.setTranslation(hijo.getTranslation().map((v, i) => v - c[i]));
      }
    },
    async () => {
      const buffer = doc.getRoot().listBuffers()[0];
      const paletaRecetas = [...new Set(doc.getRoot().listMaterials().map((m) => m.getName().split('.')[0]))];
      doc.getRoot().getDefaultScene().setExtras({ paletaRecetas });
      const vistaPrevia = doc.createMaterial().setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.5).setMetallicFactor(0.15);
      for (const tipo of doc.getRoot().getDefaultScene().listChildren()) {
        const mesh = tipo.listChildren()[0]?.getMesh();
        if (!mesh) continue;
        const prims = mesh.listPrimitives();
        const recetas = [...new Set(prims.map((p) => p.getMaterial().getName().split('.')[0]))];
        tipo.setExtras({ ...tipo.getExtras(), recetas: recetas.map((r) => paletaRecetas.indexOf(r)) });
        const posiciones = [], colores = [], indices = [];
        for (const p of prims) {
          const pos = p.getAttribute('POSITION');
          const offset = posiciones.length / 3;
          const receta = recetas.indexOf(p.getMaterial().getName().split('.')[0]);
          const color = p.getMaterial().getBaseColorFactor();
          for (let i = 0; i < pos.getCount(); i++) {
            const v = []; pos.getElement(i, v);
            posiciones.push(...v);
            colores.push(...color.slice(0, 3).map((c) => Math.round(c * 255)), receta);
          }
          const ind = p.getIndices();
          if (ind) for (let i = 0; i < ind.getCount(); i++) indices.push(ind.getScalar(i) + offset);
          else for (let i = 0; i < pos.getCount(); i++) indices.push(i + offset);
          mesh.removePrimitive(p);
        }
        const accesor = (type, array, normalized = false) => doc.createAccessor().setType(type).setArray(array).setNormalized(normalized).setBuffer(buffer);
        mesh.addPrimitive(doc.createPrimitive()
          .setAttribute('POSITION', accesor(Accessor.Type.VEC3, new Float32Array(posiciones)))
          .setAttribute('COLOR_0', accesor(Accessor.Type.VEC4, new Uint8Array(colores), true))
          .setIndices(accesor(Accessor.Type.SCALAR, new Uint32Array(indices)))
          .setMaterial(vistaPrevia));
      }
    },
    prune({ keepLeaves: true, keepAttributes: true }),
    meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: archivo === 'cotidianos.glb' ? 10 : archivo === 'facultad.glb' ? 12 : 16, quantizeNormal: 8 }),
  );
  // Evita decenas de dígitos residuales en las matrices de decodificación.
  const redondear = (v) => Math.round(v * (archivo === 'cotidianos.glb' ? 1e3 : 1e4)) / (archivo === 'cotidianos.glb' ? 1e3 : 1e4);
  for (const n of doc.getRoot().listNodes()) {
    n.setTranslation(n.getTranslation().map(redondear));
    n.setScale(n.getScale().map(redondear));
  }
  const datos = await io.writeBinary(doc);
  if (datos.byteLength > 200 * 1024) throw new Error(`${archivo}: ${datos.byteLength} bytes, supera 200 KiB`);
  await writeFile(path.join(destino, archivo), datos);
  informes.push({ archivo, bytes: datos.byteLength });
}
console.log(JSON.stringify(informes, null, 2));
