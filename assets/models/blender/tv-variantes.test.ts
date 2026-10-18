import {readFileSync,statSync} from 'node:fs';
import {beforeAll,it,expect} from 'vitest';
import {cargadorGlb} from '../../../lib/planogenerator/cargador';
import {bibliotecaDesdeEscena,archivosPara,modeloPara,IndicePiezas,type BibliotecaPiezas} from '../../../lib/planogenerator/biblioteca';
import {planoTelevisor} from '../../../lib/planogenerator/plantillas/equipos';
import datos from '../../../public/models/piezas/indice.json';
const indice=IndicePiezas.parse(datos);let bib:BibliotecaPiezas;
beforeAll(async()=>{bib=new Map();for(const file of Object.values(indice.familias)){const b=readFileSync('public/models/piezas/'+file);const g=await cargadorGlb().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');for(const [k,v]of bibliotecaDesdeEscena(g.scene))bib.set(k,v);}});
for(const pie of ['central','laterales'])it(`apoyo TV ${pie}`,()=>{
 const nodo='carcasa_tv_dato@pie_'+pie;
 const p=planoTelevisor.piezas.find(p=>!p.padre)!;
 expect(modeloPara(p.pieza,bib,p.dim,'televisor',nodo)).toBe(bib.get(nodo));
 expect(archivosPara([nodo],indice)).toContain('tv_variantes.glb');
});
it('sin forma explícita conserva la selección y no descarga esta familia',()=>{
 expect(archivosPara(planoTelevisor.piezas.map(p=>p.pieza),indice)).not.toContain('tv_variantes.glb');
 for(const p of planoTelevisor.piezas)expect(modeloPara(p.pieza,bib,p.dim,'televisor',p.formaBiblioteca)).not.toBe(bib.get('carcasa_tv_dato@pie_central'));
 expect(statSync('public/models/piezas/tv_variantes.glb').size).toBeLessThan(200000);
 expect(readFileSync('assets/models/blender/tv_variantes.py','utf8')).not.toMatch(/\b(tcl|lg|samsung|modelo|marca)\b/i);
});
