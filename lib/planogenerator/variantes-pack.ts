import { Rasgos3D, type KnowledgePack, type PlanoDePiezas } from '../../shared';

/** Solo datos explícitos y validados; no se consulta marca, modelo ni palabras del pack. */
export function aplicarRasgos3D(plano: PlanoDePiezas, pack: Pick<KnowledgePack,'rasgos3D'> & Partial<Pick<KnowledgePack,'piezas'>>, tipo?: string): PlanoDePiezas {
  // Un plano de caché puede conservar una forma de un pack anterior: retirar solo nuestras
  // formas explícitas antes de aplicar los datos actuales. Sin ellas, devuelve la misma referencia.
  const viejas=plano.piezas.some(p=>p.formaBiblioteca?.match(/^(pantalla_tablet_dato|carcasa_tv_dato|carcasa_auricular_dato)@/));
  if(viejas) plano={...plano,piezas:plano.piezas.map(p=>{
    if(!p.formaBiblioteca?.match(/^(pantalla_tablet_dato|carcasa_tv_dato|carcasa_auricular_dato)@/))return p;
    const {formaBiblioteca: _anterior,...base}=p;return base;
  })};
  const datos=Rasgos3D.safeParse(pack.rasgos3D);
  if(!datos.success) return plano;
  if(tipo==='auriculares_vincha' && datos.data.auriculares?.formato==='over_ear') {
    const pedidas=new Set(pack.piezas?.map(p=>p.id) ?? []);
    return {...plano,piezas:plano.piezas.filter(p=>! /^(almohadilla_silicona|contacto_resorte|bateria_estuche|placa_estuche)(_|$)/.test(p.pieza) || pedidas.has(p.pieza)).map(p=>{
      const izquierda=plano.piezas.find(c=>c.pieza==='copa_izquierda');
      const derechaCopa=plano.piezas.find(c=>c.pieza==='copa_derecha');
      if(!p.padre && izquierda && derechaCopa) {
        const escala=Math.abs(izquierda.pos[0]-derechaCopa.pos[0])/15;
        return {...p,formaBiblioteca:'carcasa_auricular_dato@diadema',dim:[19*escala,1.2*escala,10*escala],pos:[(izquierda.pos[0]+derechaCopa.pos[0])/2,p.pos[1],izquierda.pos[2]-5*escala]};
      }
      if(/^copa_/.test(p.pieza)) return {...p,formaBiblioteca:'carcasa_auricular_dato@copa'};
      if(/^almohadilla_copa_/.test(p.pieza)) return {...p,formaBiblioteca:'carcasa_auricular_dato@almohadilla'};
      if(!/^(carcasa_auricular|almohadilla_oreja|almohadilla_silicona)(_|$)/.test(p.pieza))return p;
      const derecha=/derech|right/.test(p.pieza);
      const copa=plano.piezas.find(c=>c.pieza===(derecha?'copa_derecha':'copa_izquierda'));
      if(!copa)return p;
      return {...p,formaBiblioteca:'carcasa_auricular_dato@'+(p.pieza.startsWith('carcasa_')?'copa':'almohadilla'),padre:copa.pieza,pos:[...copa.pos],dim:copa.dim.map(v=>v*(p.pieza.startsWith('carcasa_')?.65:.6)) as [number,number,number]};
    })};
  }
  if(tipo==='televisor' && datos.data.televisor?.apoyo) {
    const nombre='carcasa_tv_dato@pie_'+datos.data.televisor.apoyo;
    return {...plano,piezas:plano.piezas.map(p=>!p.padre?{...p,formaBiblioteca:nombre}:p)};
  }
  if(tipo==='tablet' && typeof datos.data.tablet?.botonFrontal==='boolean') {
    const nombre='pantalla_tablet_dato@'+(datos.data.tablet.botonFrontal?'con_boton':'sin_boton');
    return {...plano,piezas:plano.piezas.map(p=>/^pantalla(?:_|$)/.test(p.pieza)?{...p,formaBiblioteca:nombre}:p)};
  }
  return plano;
}

/** Cambiar entre estuche y diadema no reinterpreta las medidas del estuche como las de unas copas. */
export function conRaizPorRasgos(plano: PlanoDePiezas, pack: Pick<KnowledgePack,'rasgos3D'>, tipo?: {id:string;plano:PlanoDePiezas}):PlanoDePiezas {
  const raiz=plano.piezas.find(p=>!p.padre);
  const propia=raiz?.formaBiblioteca?.startsWith('carcasa_auricular_dato@');
  if((!pack.rasgos3D?.auriculares?.formato && !propia) || !tipo?.id.startsWith('auriculares'))return plano;
  const base=tipo.plano.piezas.find(p=>!p.padre);
  if(!raiz || !base || (raiz.pieza===base.pieza && !propia) || raiz.origen==='manual' || raiz.origen==='foto')return plano;
  return {...plano,piezas:plano.piezas.map(p=>p===raiz?{...p,dim:[...base.dim],pos:[...base.pos]}:p)};
}
