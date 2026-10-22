import {readFileSync,statSync} from 'node:fs';
import {beforeAll,it,expect} from 'vitest';
import {cargadorGlb} from '../../../lib/planogenerator/cargador';
import {bibliotecaDesdeEscena,archivosPara,modeloPara,IndicePiezas,type BibliotecaPiezas} from '../../../lib/planogenerator/biblioteca';
import {tiposParaPrompt} from '../../../lib/planogenerator/tipos';
import {planoReloj,planoRelojRedondo} from '../../../lib/planogenerator/plantillas/equipos';
import datos from '../../../public/models/piezas/indice.json';
const indice=IndicePiezas.parse(datos);let bib:BibliotecaPiezas;
beforeAll(async()=>{bib=new Map();for(const file of Object.values(indice.familias)){const b=readFileSync('public/models/piezas/'+file);const g=await cargadorGlb().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');for(const [k,v]of bibliotecaDesdeEscena(g.scene))bib.set(k,v);}});
const NODOS=['cuadrada_c1','cuadrada_c2','cuadrada_s1','cuadrada_s2','redonda_c1','redonda_c2','redonda_s0','redonda_s1','redonda_s2'].map(n=>'caja_reloj_dato@'+n);
for(const nodo of NODOS)it(`caja de reloj ${nodo}`,()=>{
 const plano=nodo.includes('redonda')?planoRelojRedondo:planoReloj;
 const p=plano.piezas.find(p=>!p.padre)!;
 expect(modeloPara(p.pieza,bib,p.dim,'reloj inteligente',nodo)).toBe(bib.get(nodo));
 expect(archivosPara([nodo],indice)).toContain('reloj_variantes.glb');
 // Misma regla de ajuste que la caja de hoy: lo redondo sigue redondo.
 expect(indice.tipos[nodo].ajuste).toBe(indice.tipos[p.formaBiblioteca!].ajuste);
});
it('sin forma explícita conserva la selección y no descarga esta familia',()=>{
 for(const plano of [planoReloj,planoRelojRedondo]){
  expect(archivosPara(plano.piezas.map(p=>p.pieza),indice)).not.toContain('reloj_variantes.glb');
  for(const p of plano.piezas)expect(NODOS.map(n=>bib.get(n))).not.toContain(modeloPara(p.pieza,bib,p.dim,'reloj inteligente',p.formaBiblioteca));
 }
 expect(tiposParaPrompt()).not.toContain('caja_reloj_dato');
 expect(statSync('public/models/piezas/reloj_variantes.glb').size).toBeLessThan(200000);
 expect(readFileSync('assets/models/blender/reloj_variantes.py','utf8')).not.toMatch(/\b(apple|samsung|garmin|galaxy|modelo|marca)\b/i);
});
