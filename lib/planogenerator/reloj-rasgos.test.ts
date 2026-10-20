import{it,expect}from'vitest';
import{KnowledgePack,PlanoDePiezas,type KnowledgePack as KP,type Rasgos3D}from'../../shared';
import{planoReloj,planoRelojRedondo}from'./plantillas/equipos';
import{generarPlano}from'./generador';
import{terminarGuardado}from'./obtener';
import{aplicarRasgos3D}from'./variantes-pack';
import{parsearContenido,type Linea}from'../knowledge/lineas';
type Reloj=NonNullable<Rasgos3D['reloj']>;
const pack=(reloj?:Reloj,formaPantalla?:'cuadrada'|'redonda',modelo='Equipo de prueba',piezas:string[]=['bateria']):KP=>KnowledgePack.parse({modelo,clase:'otro',verificado:false,fuentes:[],piezas:piezas.map(id=>({id,nombre:id,descripcion:'',ubicacion:''})),pasos:[],repuestos:[],advertencias:[],...(formaPantalla?{formaPantalla}:{}),...(reloj?{rasgos3D:{reloj}}:{})});
/** Medidas del manual, salvo la corona (de la plantilla: es la que el rasgo puede sacar). */
const escalado=(plano:PlanoDePiezas,k:number):PlanoDePiezas=>({...plano,piezas:plano.piezas.map(p=>({...p,origen:p.pieza==='corona_reloj'?'estimada' as const:'manual' as const,dim:p.dim.map(n=>n*k) as[number,number,number],pos:p.pos.map(n=>n*k) as[number,number,number]}))});
const raiz=(p:PlanoDePiezas)=>p.piezas.find(x=>!x.padre)!;
const corona=(p:PlanoDePiezas)=>p.piezas.some(x=>x.pieza==='corona_reloj');
/** Lo que se espera: sin botones y con corona es la caja de hoy; la cuadrada de hoy no tiene puerto de corona. */
const esperada=(forma:string,c:boolean,b:number)=>b||(!c&&forma==='redonda')?`caja_reloj_dato@${forma}_${c?'c':'s'}${b}`:`caja_reloj@${forma}`;

for(const forma of ['cuadrada','redonda'] as const)for(const c of [true,false])for(const b of [0,1,2] as const)for(const k of [1,0.86])it(`reloj ${forma}, corona ${c}, ${b} botones, escala ${k}: caché`,()=>{
 const kp=pack({corona:c,botonesLaterales:b},forma);
 const base=escalado(forma==='redonda'?planoRelojRedondo:planoReloj,k);
 const p=terminarGuardado(base,kp,'reloj').plano;
 expect(PlanoDePiezas.safeParse(p).success).toBe(true);
 expect(raiz(p).formaBiblioteca).toBe(esperada(forma,c,b));
 expect(corona(p)).toBe(c);
 // El cuerpo no se mueve ni cambia de tamaño: los botones agregan solo del lado +X.
 const r0=raiz(base),r=raiz(p);
 expect(r.pos[0]-r.dim[0]/2).toBeCloseTo(r0.pos[0]-r0.dim[0]/2,6);
 expect(r.dim[1]).toBeCloseTo(r0.dim[1],6);expect(r.dim[2]).toBeCloseTo(r0.dim[2],6);
 // Volver a terminar el plano guardado no acumula cambios.
 const otra=terminarGuardado(p,kp,'reloj').plano;
 expect(raiz(otra).formaBiblioteca).toBe(r.formaBiblioteca);
 for(const i of [0,1,2]){expect(raiz(otra).dim[i]).toBeCloseTo(r.dim[i],6);expect(raiz(otra).pos[i]).toBeCloseTo(r.pos[i],6);}
 // Sin el dato en un pack nuevo, la caché vuelve a la caja y la corona de hoy, con sus medidas.
 const sin=terminarGuardado(p,pack(undefined,forma),'reloj').plano;
 expect(raiz(sin).formaBiblioteca).toBe('caja_reloj@'+forma);
 expect(corona(sin)).toBe(true);
 for(const i of [0,1,2]){expect(raiz(sin).dim[i]).toBeCloseTo(r0.dim[i],6);expect(raiz(sin).pos[i]).toBeCloseTo(r0.pos[i],6);}
});

for(const forma of ['cuadrada','redonda'] as const)for(const modelo of ['Variante compacta','Variante grande'])it(`reloj ${forma} ${modelo}: plano nuevo`,async()=>{
 const kp=pack({corona:false,botonesLaterales:2},forma,modelo);
 const r=await generarPlano({casoId:'c',knowledgePack:kp,tipoEquipo:'reloj'},async()=>'no es json');
 expect(raiz(r.plano).formaBiblioteca).toBe(`caja_reloj_dato@${forma}_s2`);
 expect(corona(r.plano)).toBe(false);
 expect(PlanoDePiezas.safeParse(r.plano).success).toBe(true);
});

it('sin dato o de otro tipo: misma referencia; marca y modelo no cambian nada',()=>{
 for(const plano of [planoReloj,planoRelojRedondo]){
  expect(aplicarRasgos3D(plano,pack(),'reloj')).toBe(plano);
  expect(aplicarRasgos3D(plano,pack({}),'reloj')).toBe(plano);
  expect(aplicarRasgos3D(plano,pack({corona:true,botonesLaterales:0}),'reloj')).toBe(plano);
  expect(aplicarRasgos3D(plano,pack({corona:false,botonesLaterales:2}),'celular')).toBe(plano);
 }
 // Lo que no vino es como hoy: solo botones conserva la corona; solo "sin corona" no agrega botones.
 expect(raiz(aplicarRasgos3D(planoReloj,pack({botonesLaterales:1}),'reloj')).formaBiblioteca).toBe('caja_reloj_dato@cuadrada_c1');
 expect(corona(aplicarRasgos3D(planoReloj,pack({botonesLaterales:1}),'reloj'))).toBe(true);
 const sinCorona=aplicarRasgos3D(planoReloj,pack({corona:false}),'reloj');
 expect(raiz(sinCorona).formaBiblioteca).toBe('caja_reloj@cuadrada');
 expect(corona(sinCorona)).toBe(false);
 for(const modelo of ['Watch Series 9','Galaxy Watch 6','Forerunner 265']){
  const a=aplicarRasgos3D(planoRelojRedondo,pack({corona:false,botonesLaterales:2},undefined,modelo),'reloj');
  expect(a.piezas).toEqual(aplicarRasgos3D(planoRelojRedondo,pack({corona:false,botonesLaterales:2}),'reloj').piezas);
 }
 // Una caja que no es la de reloj de hoy (otra forma elegida) no se cambia.
 const ajena={...planoReloj,piezas:planoReloj.piezas.map(p=>p.padre?p:{...p,formaBiblioteca:'carcasa@otra'})};
 expect(raiz(aplicarRasgos3D(ajena,pack({botonesLaterales:2}),'reloj')).formaBiblioteca).toBe('carcasa@otra');
});

it('sin corona no se saca la que nombra el pack ni la que se vio en el manual',()=>{
 expect(corona(aplicarRasgos3D(planoReloj,pack({corona:false},undefined,undefined,['corona_reloj']),'reloj'))).toBe(true);
 const vista={...planoReloj,piezas:planoReloj.piezas.map(p=>p.pieza==='corona_reloj'?{...p,origen:'manual' as const}:p)};
 expect(corona(aplicarRasgos3D(vista,pack({corona:false}),'reloj'))).toBe(true);
});

it('RASGO del reloj: valores validados, el primero gana, lo desconocido se descarta',()=>{
 const leer=(textos:string[])=>parsearContenido(textos.map(texto=>({texto,citas:[]})) as Linea[],'fuente');
 expect(leer(['RASGO|reloj|corona|no','RASGO|reloj|botonesLaterales|0']).rasgos3D).toEqual({reloj:{corona:false,botonesLaterales:0}});
 expect(leer(['RASGO|reloj|corona|si','RASGO|reloj|botonesLaterales|2']).rasgos3D).toEqual({reloj:{corona:true,botonesLaterales:2}});
 for(const texto of ['3','tal vez','dos',''])expect(leer(['RASGO|reloj|botonesLaterales|'+texto]).rasgos3D).toBeUndefined();
 expect(leer(['RASGO|reloj|corona|2']).rasgos3D).toBeUndefined();
 expect(leer(['RASGO|reloj|botonesLaterales|1','RASGO|reloj|botonesLaterales|2']).rasgos3D?.reloj?.botonesLaterales).toBe(1);
 // El 0 no abre cámaras de celular inválidas.
 expect(leer(['RASGO|celular|camarasTraseras|0']).rasgos3D).toBeUndefined();
});
