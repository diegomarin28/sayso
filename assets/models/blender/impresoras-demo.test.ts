import { readFileSync, statSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { cargadorGlb } from '../../../lib/planogenerator/cargador';
import { bibliotecaDesdeEscena, modeloPara, type BibliotecaPiezas } from '../../../lib/planogenerator/biblioteca';
import { planoImpresoraLaser, planoImpresora } from '../../../lib/planogenerator/plantillas/equipos';
import { recetaPara } from '../../../lib/planogenerator/materiales';
import indice from '../../../public/models/piezas/indice.json';
let bib: BibliotecaPiezas;
beforeAll(async()=>{
  bib=new Map();
  for(const file of Object.values(indice.familias)){
    const b=readFileSync('public/models/piezas/'+file);
    const g=await cargadorGlb().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
    for(const [k,v] of bibliotecaDesdeEscena(g.scene))bib.set(k,v);
  }
});
for(const [tipo,plano] of [['laser',planoImpresoraLaser],['tinta',planoImpresora]] as const){
  it(`${tipo}: interior completo por tecnología y bandeja de papel, sin cajón de heladera`,()=>{
    for(const p of plano.piezas.filter(p=>p.pieza!=='tapa_impresora')) {
      expect(modeloPara(p.pieza,bib,p.dim,'impresora '+tipo),p.pieza).toBeDefined();
      expect(recetaPara(p.pieza),p.pieza).not.toBe(recetaPara('pieza_sin_tipo'));
    }
    const bandeja=plano.piezas.find(p=>p.pieza==='bandeja_papel')!;
    expect(modeloPara(bandeja.pieza,bib,bandeja.dim,'impresora '+tipo)).toBe(bib.get('bandeja_papel@'+tipo));
    const placa=plano.piezas.find(p=>p.pieza==='placa_control')!;
    expect(modeloPara(placa.pieza,bib,placa.dim,'impresora '+tipo)).toBe(bib.get('placa@impresora'));
    const ids=plano.piezas.map(p=>p.pieza);
    if(tipo==='laser')expect(ids).toEqual(expect.arrayContaining(['unidad_fusora','unidad_laser','cartucho_toner']));
    else for(const id of ['unidad_fusora','unidad_laser','cartucho_toner'])expect(ids).not.toContain(id);
  });
}
it('la familia aislada es liviana y no contiene decisiones comerciales',()=>{
  expect(statSync('public/models/piezas/impresoras_demo.glb').size).toBeLessThan(200_000);
  const s=readFileSync('assets/models/blender/impresoras_demo.py','utf8');
  expect(s).not.toMatch(/\b(hp|epson|canon|brother|modelo|marca)\b/i);
});
