import { Rasgos3D, type KnowledgePack, type PiezaPlano, type PlanoDePiezas } from '../../shared';
import indice from '../../public/models/piezas/indice.json';

const CAJAS:Record<string,{caja?:number[]}>=indice.tipos;
const CAJA_RELOJ=/^caja_reloj(?:_dato)?@(cuadrada|redonda)(?:_[cs][012])?$/;

/**
 * Los botones de `caja_reloj_dato@…` salen hacia +X: la caja crece solo de ese lado y el cuerpo queda del
 * mismo tamaño y en el mismo lugar que con la caja de hoy (y al revés, al volver a ella).
 */
function cambiarCaja(p:PiezaPlano,a:string):PiezaPlano {
  const de=CAJAS[p.formaBiblioteca ?? '']?.caja, hacia=CAJAS[a]?.caja;
  if(!de || !hacia) return {...p,formaBiblioteca:a};
  const dim=p.dim.map((v,i)=>v*hacia[i]/de[i]) as PiezaPlano['dim'];
  return {...p,formaBiblioteca:a,dim,pos:[p.pos[0]+(dim[0]-p.dim[0])/2,p.pos[1],p.pos[2]]};
}

/** La caja de reloj de un pack anterior vuelve a la de hoy (con sus medidas) antes de seguir la plantilla. */
export function sinCajaDeRasgos(plano: PlanoDePiezas): PlanoDePiezas {
  const raiz=plano.piezas.find(p=>!p.padre);
  const forma=raiz?.formaBiblioteca?.startsWith('caja_reloj_dato@') && CAJA_RELOJ.exec(raiz.formaBiblioteca)?.[1];
  if(!raiz || !forma) return plano;
  return {...plano,piezas:plano.piezas.map(p=>p===raiz?cambiarCaja(p,'caja_reloj@'+forma):p)};
}

/** Solo datos explícitos y validados; no se consulta marca, modelo ni palabras del pack. */
export function aplicarRasgos3D(plano: PlanoDePiezas, pack: Pick<KnowledgePack,'rasgos3D'> & Partial<Pick<KnowledgePack,'piezas'>>, tipo?: string): PlanoDePiezas {
  // Un plano de caché puede conservar una forma de un pack anterior: retirar solo nuestras
  // formas explícitas antes de aplicar los datos actuales. Sin ellas, devuelve la misma referencia.
  const viejas=plano.piezas.some(p=>p.formaBiblioteca?.match(/^(pantalla_tablet_dato|carcasa_tv_dato|carcasa_auricular_dato|camara_celular_dato|pantalla_celular_dato|marco_celular_dato)@/));
  if(viejas) plano={...plano,piezas:plano.piezas.map(p=>{
    if(!p.formaBiblioteca?.match(/^(pantalla_tablet_dato|carcasa_tv_dato|carcasa_auricular_dato|camara_celular_dato|pantalla_celular_dato|marco_celular_dato)@/))return p;
    const {formaBiblioteca: _anterior,...base}=p;return base;
  })};
  plano=sinCajaDeRasgos(plano);
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
  const celular=datos.data.celular;
  if(tipo==='celular' && celular && (celular.camarasTraseras!==undefined || typeof celular.muesca==='boolean' || celular.bordes!==undefined)) {
    return {...plano,piezas:plano.piezas.map(p=>{
      if(p.pieza==='camara_trasera' && celular.camarasTraseras!==undefined)return {...p,formaBiblioteca:'camara_celular_dato@'+celular.camarasTraseras};
      if(p.pieza==='pantalla' && typeof celular.muesca==='boolean')return {...p,formaBiblioteca:'pantalla_celular_dato@'+(celular.muesca?'con_muesca':'sin_muesca')};
      if(!p.padre && celular.bordes)return {...p,formaBiblioteca:'marco_celular_dato@'+celular.bordes};
      return p;
    })};
  }
  const reloj=datos.data.reloj;
  if(tipo==='reloj' && reloj && (typeof reloj.corona==='boolean' || reloj.botonesLaterales!==undefined)) {
    // Lo que no vino es como hoy: con corona y sin botones. La cuadrada de hoy no tiene puerto de corona.
    const corona=reloj.corona ?? true, botones=reloj.botonesLaterales ?? 0;
    const raiz=plano.piezas.find(p=>!p.padre);
    const forma=raiz?.formaBiblioteca && CAJA_RELOJ.exec(raiz.formaBiblioteca)?.[1];
    const nueva=forma && (botones || (!corona && forma==='redonda')) ? `caja_reloj_dato@${forma}_${corona?'c':'s'}${botones}` : null;
    // Sin corona se saca la de la plantilla; no la que nombra el pack ni la que se vio en el manual o una foto.
    const pedidas=new Set(pack.piezas?.map(p=>p.id) ?? []);
    const sacar=(p:PiezaPlano)=>!corona && p.pieza==='corona_reloj' && !pedidas.has(p.pieza) && p.origen!=='manual' && p.origen!=='foto';
    if(!nueva && !plano.piezas.some(sacar)) return plano;
    return {...plano,piezas:plano.piezas.filter(p=>!sacar(p)).map(p=>p===raiz && nueva?cambiarCaja(p,nueva):p)};
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
