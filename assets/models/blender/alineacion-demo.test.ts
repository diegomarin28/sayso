import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { cargadorGlb } from '../../../lib/planogenerator/cargador';
import { bibliotecaDesdeEscena, modeloPara, type BibliotecaPiezas } from '../../../lib/planogenerator/biblioteca';
import { planoCelular, planoTelevisor } from '../../../lib/planogenerator/plantillas/equipos';
import { recetaPara } from '../../../lib/planogenerator/materiales';
import indice from '../../../public/models/piezas/indice.json';
let bib: BibliotecaPiezas;
beforeAll(async () => {
  bib = new Map();
  for (const file of Object.values(indice.familias)) {
    const b = readFileSync('public/models/piezas/' + file);
    const g = await cargadorGlb().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
    for (const [k,v] of bibliotecaDesdeEscena(g.scene)) bib.set(k,v);
  }
});
for (const [tipo, plano, escalas] of [ ['celular',planoCelular,[1,1.12]], ['televisor',planoTelevisor,[1,32/46]] ] as const) {
  for (const escala of escalas) it(`${tipo}: todas las piezas tienen GLB y receta, escala ${escala}`, () => {
    for (const p of plano.piezas) {
      const dim = p.dim.map(n=>n*escala) as [number,number,number];
      expect(modeloPara(p.pieza,bib,dim,tipo,p.formaBiblioteca),p.pieza).toBeDefined();
      expect(recetaPara(p.pieza),p.pieza).not.toEqual(recetaPara("pieza_sin_tipo"));
    }
    const canonicos = tipo === 'celular' ? ['camara_frontal','camara_trasera','placa_carga'] : ['carcasa_televisor','pantalla_panel','placa_control'];
    for (const id of canonicos) {
      const p = plano.piezas.find(p=>p.pieza===id)!;
      const nombre = ({placa_control:'placa@televisor',camara_frontal:'camara',camara_trasera:'camara@modulo'} as Record<string,string>)[id] ?? id;
      expect(modeloPara(id,bib,p.dim,tipo,id === 'placa_control' ? nombre : undefined)).toBe(bib.get(nombre));
    }
  });
}
it('la fuente de las formas no decide por marca o modelo',()=>{
  const src=readFileSync('assets/models/blender/alineacion_demo.py','utf8');
  expect(src).not.toMatch(/\b(if|elif)\b[^\n]*(iphone|samsung|tcl|modelo|marca)/i);
  expect(src).not.toMatch(/\b(iphone|samsung|tcl|apple)\b/i);
});
