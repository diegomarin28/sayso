import {it,expect} from 'vitest';
import {KnowledgePack,PlanoDePiezas,type KnowledgePack as KP} from '../../shared';
import {generarPlano} from './generador';
import {terminarGuardado} from './obtener';
import {aplicarRasgos3D} from './variantes-pack';
const pack=(boton?:boolean,modelo='Equipo de prueba'):KP=>({modelo,clase:'otro',verificado:false,fuentes:[],piezas:[{id:'bateria',nombre:'Batería',descripcion:'',ubicacion:''}],pasos:[],repuestos:[],advertencias:[],...(boton===undefined?{}:{rasgos3D:{tablet:{botonFrontal:boton}}})});
for(const boton of [false,true])for(const modelo of ['Variante compacta','Variante grande'])it(`tablet ${modelo} botón ${boton}: nuevo y caché`,async()=>{
 const p=KnowledgePack.parse(pack(boton,modelo));
 const r=await generarPlano({casoId:'c',knowledgePack:p,tipoEquipo:'tablet'},async()=> 'no es json');
 const nombre='pantalla_tablet_dato@'+(boton?'con_boton':'sin_boton');
 expect(r.plano.piezas.find(x=>x.pieza==='pantalla')?.formaBiblioteca).toBe(nombre);
 expect(PlanoDePiezas.safeParse(r.plano).success).toBe(true);
 expect(terminarGuardado(r.plano,p,'tablet').plano.piezas.find(x=>x.pieza==='pantalla')?.formaBiblioteca).toBe(nombre);
});
it('sin dato o tipo distinto: referencia idéntica y sin marca/modelo en el selector',()=>{
 const plano:PlanoDePiezas={modelo:'base',unidades:'cm',piezas:[]};
 expect(aplicarRasgos3D(plano,pack(),'tablet')).toBe(plano);
 expect(aplicarRasgos3D(plano,pack(false),'celular')).toBe(plano);
});

it('al faltar el dato en otro pack, la caché no conserva una variante anterior',async()=>{
 const anterior=await generarPlano({casoId:'c',knowledgePack:pack(true),tipoEquipo:'tablet'},async()=> 'no es json');
 const actual=terminarGuardado(anterior.plano,pack(),'tablet');
 expect(actual.plano.piezas.every(p=>!p.formaBiblioteca?.startsWith('pantalla_tablet_dato@'))).toBe(true);
});
