import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { DoubleSide, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { cargadorGlb } from '../../../lib/planogenerator/cargador';
import { bibliotecaDesdeEscena, partesAjustadas, type BibliotecaPiezas } from '../../../lib/planogenerator/biblioteca';
let modelos: BibliotecaPiezas;
beforeAll(async () => {
  const b = readFileSync('public/models/piezas/notebook_demo.glb');
  modelos = bibliotecaDesdeEscena((await cargadorGlb().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')).scene);
});
describe('notebook abierta por tipo, no por marca', () => {
  it.each([1, 1.14])('tamaño %s: teclas separadas, P seleccionable y geometría finita', escala => {
    for (const letra of 'qwertyuiopasdfghjklzxcvbnm') {
      const modelo = modelos.get('tecla@' + letra);
      expect(modelo, letra).toBeDefined();
      for (const parte of partesAjustadas(modelo!, [1.55 * escala, 0.2 * escala, 1.45 * escala]))
        expect(Array.from(parte.geometria.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    }
    for (const id of ['carcasa_pantalla@notebook', 'pantalla@notebook', 'carcasa_superior@notebook', 'teclado@bandeja_notebook'])
      expect(modelos.has(id), id).toBe(true);
  });
  it('el palmrest tiene un hueco real: no tapa teclado ni trackpad', () => {
    const grupo = new Group();
    for (const p of modelos.get('carcasa_superior@notebook')!.partes)
      grupo.add(new Mesh(p.geometria, new MeshBasicMaterial({ side: DoubleSide })));
    grupo.updateMatrixWorld(true);
    for (const z of [-3.3, 6.3]) {
      const rayo = new Raycaster(new Vector3(0, 5, z), new Vector3(0, -1, 0));
      expect(rayo.intersectObject(grupo, true), `hueco z=${z}`).toHaveLength(0);
    }
  });
});
