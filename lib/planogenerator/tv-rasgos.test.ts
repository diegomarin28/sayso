import{it,expect}from'vitest';
import{KnowledgePack,PlanoDePiezas}from'../../shared';
import{planoTelevisor}from'./plantillas/equipos';
import{terminarGuardado}from'./obtener';
import{aplicarRasgos3D}from'./variantes-pack';
import{parsearContenido,type Linea}from'../knowledge/lineas';
for(const apoyo of ['central','laterales'] as const)for(const escala of [1,32/46])it(`TV apoyo ${apoyo}, escala ${escala}`,()=>{
 const pack=KnowledgePack.parse({modelo:'Equipo sin marca',clase:'otro',verificado:false,fuentes:[],piezas:[],pasos:[],repuestos:[],advertencias:[],rasgos3D:{televisor:{apoyo}}});
 const base={...planoTelevisor,piezas:planoTelevisor.piezas.map(p=>({...p,origen:'manual' as const,dim:p.dim.map(n=>n*escala) as[number,number,number],pos:p.pos.map(n=>n*escala) as[number,number,number]}))};
 const actual=terminarGuardado(base,pack,'televisor').plano;
 expect(actual.piezas.find(p=>!p.padre)?.formaBiblioteca).toBe('carcasa_tv_dato@pie_'+apoyo);
 expect(PlanoDePiezas.safeParse(actual).success).toBe(true);
 const dato=parsearContenido([{texto:`RASGO|televisor|apoyo|${apoyo}`,citas:[]}] as Linea[],'fuente');
 expect(dato.rasgos3D?.televisor?.apoyo).toBe(apoyo);
 expect(aplicarRasgos3D(base,{},'televisor')).toBe(base);
 expect(aplicarRasgos3D(actual,{},'televisor').piezas.some(p=>p.formaBiblioteca?.startsWith('carcasa_tv_dato@'))).toBe(false);
});
