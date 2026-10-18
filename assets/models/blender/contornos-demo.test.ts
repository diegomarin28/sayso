import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { DoubleSide, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { cargadorGlb } from '../../../lib/planogenerator/cargador';
import { bibliotecaDesdeEscena, partesAjustadas, type BibliotecaPiezas } from '../../../lib/planogenerator/biblioteca';
let modelos: BibliotecaPiezas;
beforeAll(async () => {
  const b = readFileSync('public/models/piezas/contornos_demo.glb');
  modelos = bibliotecaDesdeEscena((await cargadorGlb().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')).scene);
});
describe('piezas grandes: borde real, centro libre', () => {
  for (const tipo of ['tablet', 'tv']) for (const pieza of ['carcasa', 'panel']) {
    it.each([0.85, 1.2])(`${pieza} ${tipo}, tamaño %s: no hay una cara opaca sobre el interior`, escala => {
      const modelo = modelos.get(pieza + '_contorno@' + tipo)!;
      const dim = modelo.caja.getSize(new Vector3()).multiplyScalar(escala).toArray() as [number, number, number];
      const grupo = new Group();
      for (const p of partesAjustadas(modelo, dim))
        grupo.add(new Mesh(p.geometria, new MeshBasicMaterial({ side: DoubleSide })));
      grupo.updateMatrixWorld(true);
      const eje = tipo === 'tablet' ? 1 : 2;
      for (const fraccion of [-0.2, 0, 0.2]) {
        const origen = new Vector3(fraccion * dim[0], 0, 0);
        origen.setComponent(eje, 1000);
        const direccion = new Vector3().setComponent(eje, -1);
        expect(new Raycaster(origen, direccion).intersectObject(grupo, true)).toHaveLength(0);
      }
      // El modelo no está vacío: el borde sí intercepta el rayo.
      const borde = new Vector3(dim[0] * 0.495, 0, 0).setComponent(eje, 1000);
      expect(new Raycaster(borde, new Vector3().setComponent(eje, -1)).intersectObject(grupo, true).length).toBeGreaterThan(0);
    });
  }
});
