import {it,expect} from 'vitest';
import {parsearContenido,type Linea} from './lineas';
const leer=(textos:string[])=>parsearContenido(textos.map(texto=>({texto,citas:[]})) as Linea[],'fuente');
it('tablet con y sin botón llega como dato opcional validado, no como inferencia',()=>{
 for(const [texto,valor] of [['si',true],['no',false]] as const)expect(leer(['RASGO|tablet|botonFrontal|'+texto]).rasgos3D).toEqual({tablet:{botonFrontal:valor}});
 for(const texto of ['tal vez','1',''])expect(leer(['RASGO|tablet|botonFrontal|'+texto]).rasgos3D).toBeUndefined();
 expect(leer(['PIEZA|bateria|Batería|centro']).rasgos3D).toBeUndefined();
 expect(leer(['RASGO|tablet|botonFrontal|no','RASGO|tablet|botonFrontal|si']).rasgos3D?.tablet?.botonFrontal).toBe(false);
});
