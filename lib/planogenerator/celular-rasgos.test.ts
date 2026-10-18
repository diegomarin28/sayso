import{it,expect}from'vitest';
import{KnowledgePack}from'../../shared';
import{planoCelular}from'./plantillas/equipos';
import{terminarGuardado}from'./obtener';
import{aplicarRasgos3D}from'./variantes-pack';
import{parsearContenido,type Linea}from'../knowledge/lineas';
for(const camarasTraseras of [1,2,3] as const)for(const muesca of [false,true])for(const bordes of ['redondeados','rectos'] as const)for(const escala of [1,1.12])it(`celular ${camarasTraseras} cámaras, muesca ${muesca}, ${bordes}, escala ${escala}`,()=>{
 const kp=KnowledgePack.parse({modelo:'Equipo de prueba',clase:'otro',verificado:false,fuentes:[],piezas:[],pasos:[],advertencias:[],repuestos:[],rasgos3D:{celular:{camarasTraseras,muesca,bordes}}});
 const base={...planoCelular,piezas:planoCelular.piezas.map(p=>({...p,origen:'manual' as const,dim:p.dim.map(n=>n*escala) as[number,number,number],pos:p.pos.map(n=>n*escala) as[number,number,number]}))};
 const p=terminarGuardado(base,kp,'celular').plano;
 expect(p.piezas.find(p=>p.pieza==='camara_trasera')?.formaBiblioteca).toBe('camara_celular_dato@'+camarasTraseras);
 expect(p.piezas.find(p=>p.pieza==='pantalla')?.formaBiblioteca).toBe('pantalla_celular_dato@'+(muesca?'con_muesca':'sin_muesca'));
 expect(p.piezas.find(p=>!p.padre)?.formaBiblioteca).toBe('marco_celular_dato@'+bordes);
 expect(aplicarRasgos3D(base,{},'celular')).toBe(base);
 const sin=aplicarRasgos3D(p,{},'celular');
 expect(sin.piezas.every(p=>!p.formaBiblioteca?.includes('celular_dato@'))).toBe(true);
 for(const modelo of ['iPhone 13','Samsung Galaxy']){const renombrado={...kp,modelo};expect(aplicarRasgos3D(base,renombrado,'celular').piezas).toEqual(aplicarRasgos3D(base,kp,'celular').piezas);}
});
it('campos independientes y parser validado',()=>{
 const r=parsearContenido([{texto:'RASGO|celular|muesca|no',citas:[]},{texto:'RASGO|celular|camarasTraseras|2',citas:[]}] as Linea[],'fuente');
 expect(r.rasgos3D?.celular).toEqual({muesca:false,camarasTraseras:2});
 const p=aplicarRasgos3D(planoCelular,{rasgos3D:{celular:{muesca:false}}},'celular');
 expect(p.piezas.find(p=>!p.padre)?.formaBiblioteca).toBeUndefined();
 expect(p.piezas.find(p=>p.pieza==='camara_trasera')?.formaBiblioteca).toBeUndefined();
});
