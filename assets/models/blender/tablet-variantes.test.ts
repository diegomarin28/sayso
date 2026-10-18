import {readFileSync,statSync} from 'node:fs';
import {beforeAll,it,expect} from 'vitest';
import {cargadorGlb} from '../../../lib/planogenerator/cargador';
import {bibliotecaDesdeEscena,archivosPara,modeloPara,IndicePiezas,type BibliotecaPiezas} from '../../../lib/planogenerator/biblioteca';
import {planoTablet} from '../../../lib/planogenerator/plantillas/equipos';
import datos from '../../../public/models/piezas/indice.json';
const indice=IndicePiezas.parse(datos);let bib:BibliotecaPiezas;
beforeAll(async()=>{bib=new Map();for(const file of Object.values(indice.familias)){const b=readFileSync('public/models/piezas/'+file);const g=await cargadorGlb().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');for(const [k,v]of bibliotecaDesdeEscena(g.scene))bib.set(k,v);}});
for(const boton of [false,true])it(`frente de tablet, botón ${boton}`,()=>{
 const nodo='pantalla_tablet_dato@'+(boton?'con_boton':'sin_boton');
 const p=planoTablet.piezas.find(p=>p.pieza==='pantalla')!;
 expect(modeloPara(p.pieza,bib,p.dim,'tablet',nodo)).toBe(bib.get(nodo));
 expect(archivosPara([nodo],indice)).toContain('tablet_variantes.glb');
});
it('sin forma explícita conserva la selección y no descarga esta familia',()=>{
 expect(archivosPara(planoTablet.piezas.map(p=>p.pieza),indice)).not.toContain('tablet_variantes.glb');
 for(const p of planoTablet.piezas)expect(modeloPara(p.pieza,bib,p.dim,'tablet',p.formaBiblioteca)).not.toBe(bib.get('pantalla_tablet_dato@con_boton'));
 expect(statSync('public/models/piezas/tablet_variantes.glb').size).toBeLessThan(200000);
 expect(readFileSync('assets/models/blender/tablet_variantes.py','utf8')).not.toMatch(/\b(ipad|apple|samsung|modelo|marca)\b/i);
});
