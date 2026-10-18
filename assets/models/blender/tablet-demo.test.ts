import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { DoubleSide, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { cargadorGlb } from '../../../lib/planogenerator/cargador';
import { bibliotecaDesdeEscena, partesAjustadas, type BibliotecaPiezas } from '../../../lib/planogenerator/biblioteca';
let modelos: BibliotecaPiezas;
beforeAll(async () => {
  const b = readFileSync('public/models/piezas/tablet_demo.glb');
  modelos = bibliotecaDesdeEscena((await cargadorGlb().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')).scene);
});
describe('tablet: frente arriba y desarme con el mismo modelo', () => {
  it.each([1, 1.22])('tamaño %s: carcasa, frente y batería son piezas distintas', escala => {
    for (const id of ['marco@tablet', 'tapa_trasera@tablet', 'pantalla@tablet', 'bateria@tablet']) {
      const modelo = modelos.get(id)!;
      expect(modelo, id).toBeDefined();
      for (const p of partesAjustadas(modelo, [17.5 * escala, 0.7, 25 * escala]))
        expect(Array.from(p.geometria.getAttribute('position').array).every(Number.isFinite), id).toBe(true);
    }
  });
  it('marco vacío en el centro y vidrio orientado hacia +Y del GLB', () => {
    const marco = new Group();
    for (const p of modelos.get('marco@tablet')!.partes)
      marco.add(new Mesh(p.geometria, new MeshBasicMaterial({ side: DoubleSide })));
    marco.updateMatrixWorld(true);
    expect(new Raycaster(new Vector3(0, 5, 0), new Vector3(0, -1, 0)).intersectObject(marco, true)).toHaveLength(0);
    const pantalla = modelos.get('pantalla@tablet')!;
    const vidrio = pantalla.partes.find(p => p.receta === 'vidrio')!;
    vidrio.geometria.computeBoundingBox();
    expect(vidrio.geometria.boundingBox!.getCenter(new Vector3()).y).toBeGreaterThan(0);
  });
});
