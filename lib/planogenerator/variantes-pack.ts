import { Rasgos3D, type KnowledgePack, type PlanoDePiezas } from '../../shared';

/** Solo datos explícitos y validados; no se consulta marca, modelo ni palabras del pack. */
export function aplicarRasgos3D(plano: PlanoDePiezas, pack: Pick<KnowledgePack,'rasgos3D'>, tipo?: string): PlanoDePiezas {
  // Un plano de caché puede conservar una forma de un pack anterior: retirar solo nuestras
  // formas explícitas antes de aplicar los datos actuales. Sin ellas, devuelve la misma referencia.
  const viejas=plano.piezas.some(p=>/^(pantalla_tablet_dato|carcasa_tv_dato)@/.test(p.formaBiblioteca ?? ''));
  if(viejas) plano={...plano,piezas:plano.piezas.map(p=>{
    if(!/^(pantalla_tablet_dato|carcasa_tv_dato)@/.test(p.formaBiblioteca ?? ''))return p;
    const {formaBiblioteca: _anterior,...base}=p;return base;
  })};
  const datos=Rasgos3D.safeParse(pack.rasgos3D);
  if(!datos.success) return plano;
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
