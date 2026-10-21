import{it,expect}from'vitest';
import{KnowledgePack}from'../../shared';
import{elegirPlantilla}from'./plantillas/por-tipo';
import{planoAuriculares}from'./plantillas/equipos';
import{terminarGuardado}from'./obtener';
import{parsearContenido,type Linea}from'../knowledge/lineas';
for(const formato of ['over_ear','in_ear'] as const)for(const modelo of ['Equipo A','Equipo B'])it(`${formato} ${modelo}, decisión y caché por dato`,()=>{
 const kp=KnowledgePack.parse({modelo,clase:'otro',verificado:false,fuentes:[],piezas:['carcasa_auricular','almohadilla_oreja'].map(n=>{const id=n+(modelo==='Equipo B'?'_derecha':'');return {id,nombre:id,descripcion:'',ubicacion:''}}),pasos:[],advertencias:[],repuestos:[],rasgos3D:{auriculares:{formato}}});
 const tipo=elegirPlantilla(kp,'auriculares')!;
 expect(tipo.id).toBe(formato==='over_ear'?'auriculares_vincha':'auriculares');
 const p=terminarGuardado(planoAuriculares,kp,'auriculares').plano;
 expect(p.piezas.find(p=>!p.padre)?.pieza).toBe(formato==='over_ear'?'diadema':'estuche_auriculares');
 if(formato==='over_ear'){
  expect(p.piezas.some(p=>/^(almohadilla_silicona|contacto_resorte|bateria_estuche|placa_estuche)(_|$)/.test(p.pieza))).toBe(false);
  const copa=p.piezas.find(p=>p.pieza===(modelo==='Equipo B'?'copa_derecha':'copa_izquierda'))!;
  const carcasa=p.piezas.find(p=>p.pieza===('carcasa_auricular'+(modelo==='Equipo B'?'_derecha':'')))!;
  expect(carcasa.pos).toEqual(copa.pos);
  expect(carcasa.dim.every((v,i)=>v<=copa.dim[i])).toBe(true);
  const almohadilla=p.piezas.find(p=>p.pieza===('almohadilla_oreja'+(modelo==='Equipo B'?'_derecha':'')))!;
  const referencia=tipo.plano.piezas.find(p=>p.pieza==='almohadilla_copa_izquierda')!;
  expect(almohadilla.pos.every(Number.isFinite)).toBe(true);
  expect(Math.sign(almohadilla.pos[0])).toBe(modelo==='Equipo B'?-1:1); // la derecha en -x, la izquierda en +x (#339)
  expect(referencia).toBeDefined();
 }
 const leer=parsearContenido([{texto:`RASGO|auriculares|formato|${formato}`,citas:[]}] as Linea[],'fuente');
 expect(leer.rasgos3D?.auriculares?.formato).toBe(formato);
 const {rasgos3D:_,...sin}=kp;
 expect(elegirPlantilla(sin,'auriculares')).toEqual(elegirPlantilla({...sin,rasgos3D:{}},'auriculares'));
});
