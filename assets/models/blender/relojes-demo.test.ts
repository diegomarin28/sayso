import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { Box3, Group, Mesh, Vector3 } from 'three';
import { cargadorGlb } from '../../../lib/planogenerator/cargador';
import { bibliotecaDesdeEscena, partesAjustadas, type BibliotecaPiezas } from '../../../lib/planogenerator/biblioteca';
let modelos: BibliotecaPiezas;
beforeAll(async () => {
  const b = readFileSync('public/models/piezas/relojes_demo.glb');
  modelos = bibliotecaDesdeEscena((await cargadorGlb().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')).scene);
});
describe('formas de reloj por dato geométrico', () => {
  it.each(['redonda', 'cuadrada'])('%s: dos tamaños conservan la forma sin marca/modelo', forma => {
    for (const escala of [0.86, 1]) {
      const modelo = modelos.get('pantalla@reloj_' + forma)!;
      const grupo = new Group();
      for (const p of partesAjustadas(modelo, [4.4 * escala, 1.1 * escala, 5.2 * escala])) grupo.add(new Mesh(p.geometria));
      const dim = new Box3().setFromObject(grupo).getSize(new Vector3());
      if (forma === 'redonda') expect(dim.x).toBeCloseTo(dim.z, 2);
      else expect(dim.z / dim.x).toBeCloseTo(4.95 / 4.15, 2);
      expect(modelos.has('pantalla@reloj_' + forma)).toBe(true);
    }
  });
});
