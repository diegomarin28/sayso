import indice from "../../public/models/piezas/indice.json";
import type { PiezaPlano, PlanoDePiezas, Vec3 } from "../../shared";
import { IndicePiezas, tipoDe, tipoPara } from "./biblioteca";
import { ES_TAPA } from "./cubiertas";
import { emparejar, equivalentes, type PlantillaDeEquipo } from "./plantillas/por-tipo";

const INDICE = IndicePiezas.parse(indice);
const NOMBRES = Object.keys(INDICE.tipos);

/**
 * Lo que no vino de una página del manual sigue al esqueleto del TIPO de equipo (reglas por tipo, nunca
 * por modelo). Para cada pieza estimada por la IA (o que falta en el plano) que tiene una pieza del mismo
 * id o del mismo tipo en la plantilla (`emparejar`), se usa el lugar y el tamaño de esa pieza, escalados a
 * la carcasa del plano. Así una retroiluminación estimada como una tira pasa a ser el panel del TV, y la
 * pantalla que la IA no ubicó va donde va la pantalla de un celular. Lo citado del manual no se toca. Las
 * piezas que cuelgan de una que se movió (y que no se mueven solas) la acompañan. Y si al plano le falta la
 * cara del equipo (`plantilla.cara`: la pantalla de un TV) y ninguna pieza es de ese tipo, se suma la del
 * esqueleto: un TV sin pantalla visto de frente no se reconoce. Y las demás piezas del esqueleto que el plano
 * no tiene (ni por id ni por tipo de pieza) también se suman, como genéricas: una láser cuyo pack nombra solo
 * el tóner igual muestra la fusora, la unidad láser, la placa y la fuente (el visor las pinta en gris, ver
 * `piezasGenericas`). Origen "plantilla".
 * Se aplica en la forma final del plano (después de `ajustarPlanoAlTipo`): al generar y al leer de la caché.
 */
export function seguirPlantilla(original: PlanoDePiezas, ids: string[], plantilla: PlantillaDeEquipo): { plano: PlanoDePiezas; avisos: string[] } {
  // Un plano guardado con otro nombre para la misma pieza (`placa_logica`, de un pack anterior) y el pack de
  // ahora que la llama `placa_madre`: se renombra, en vez de sumar una segunda placa.
  const renombradas = renombrarEquivalentes(original, ids);
  const plano = renombradas.plano;
  const raiz = plano.piezas.find((p) => !p.padre);
  const raizT = plantilla.plano.piezas.find((p) => !p.padre);
  if (!raiz || !raizT) return { plano, avisos: renombradas.avisos };

  const esta = new Set(plano.piezas.map((p) => p.pieza));
  // Las tapas no: las pone `conTapa`, sobre el plano terminado.
  const candidatas = [
    ...plano.piezas.filter((p) => p !== raiz && p.origen !== "manual").map((p) => p.pieza),
    ...ids.filter((id) => !esta.has(id)),
  ].filter((id) => !ES_TAPA.test(id));
  // La raíz del esqueleto no se empareja: una pieza no pasa a medir lo que la carcasa.
  const sinRaiz = { ...plantilla, plano: { ...plantilla.plano, piezas: plantilla.plano.piezas.filter((p) => p !== raizT && !ES_TAPA.test(p.pieza)) } };
  const { usadas } = emparejar([...new Set(candidatas)], sinRaiz);
  const tiposDelPlano = new Set([...plano.piezas.map((p) => p.pieza), ...ids].map((id) => tipoPara(id, NOMBRES)).filter(Boolean));
  const cara = plantilla.cara.filter((idT) => !usadas.has(idT) && !tiposDelPlano.has(tipoPara(idT, NOMBRES)));
  // Lo que el esqueleto tiene y el plano no: ni la misma pieza ni una del mismo tipo (dos tiras de LED de la
  // plantilla son del mismo tipo: si el plano no tiene ninguna, van todas).
  const genericas = sinRaiz.plano.piezas
    .map((t) => t.pieza)
    .filter((idT) => !usadas.has(idT) && !cara.includes(idT) && !esta.has(idT) && !ids.includes(idT) && !tiposDelPlano.has(tipoPara(idT, NOMBRES)));
  if (!usadas.size && !cara.length && !genericas.length) return { plano, avisos: renombradas.avisos };

  // Un equipo parado se ve desde atrás, abierto (+z, hacia la cámara, es la espalda: ver `pararPlano`); el
  // esqueleto lo dibuja de frente (+z es la pantalla). Por eso en un parado la profundidad va espejada.
  const escala = raizT.dim.map((v, i) => (raiz.dim[i] / Math.max(v, 1e-6)) * (plantilla.parado && i === 2 ? -1 : 1));
  const lugar = (t: PiezaPlano) => ({
    pos: t.pos.map((v, i) => +(raiz.pos[i] + (v - raizT.pos[i]) * escala[i]).toFixed(2)) as Vec3,
    dim: t.dim.map((v, i) => +(v * Math.abs(escala[i])).toFixed(2)) as Vec3,
    // La forma que eligió el esqueleto (ej. la pantalla redonda de un reloj redondo).
    ...(t.formaBiblioteca ? { formaBiblioteca: t.formaBiblioteca } : {}),
  });
  const deLaPlantilla = new Map([...usadas].map(([idT, id]) => [id, plantilla.plano.piezas.find((p) => p.pieza === idT)!]));

  // Cuánto se movió cada pieza que sigue al esqueleto, para llevar con ella a las que cuelgan de ella.
  const corrimiento = new Map<string, Vec3>();
  let piezas = plano.piezas.map((p) => {
    const t = deLaPlantilla.get(p.pieza);
    if (!t || p === raiz) return p;
    const nuevo = lugar(t);
    corrimiento.set(p.pieza, nuevo.pos.map((v, i) => v - p.pos[i]) as Vec3);
    return { ...p, ...nuevo, origen: "plantilla" as const };
  });
  const arrastre = (p: PiezaPlano): Vec3 | undefined => {
    for (let q = p.padre; q; q = plano.piezas.find((x) => x.pieza === q)?.padre) if (corrimiento.has(q)) return corrimiento.get(q);
    return undefined;
  };
  piezas = piezas.map((p) => {
    const d = deLaPlantilla.has(p.pieza) ? undefined : arrastre(p);
    return d ? { ...p, pos: p.pos.map((v, i) => +(v + d[i]).toFixed(2)) as Vec3 } : p;
  });

  const nueva = (id: string, t: PiezaPlano): PiezaPlano => ({ pieza: id, forma: t.forma, ...lugar(t), pivote: [0, 0, 0], padre: raiz.pieza, origen: "plantilla" });
  const nuevas: PiezaPlano[] = ids.filter((id) => !esta.has(id) && deLaPlantilla.has(id)).map((id) => nueva(id, deLaPlantilla.get(id)!));
  const deLaCara = cara.map((idT) => nueva(idT, plantilla.plano.piezas.find((p) => p.pieza === idT)!));
  const delEsqueleto = genericas.map((idT) => nueva(idT, plantilla.plano.piezas.find((p) => p.pieza === idT)!));

  const movidas = corrimiento.size;
  return {
    plano: { ...plano, piezas: [...piezas, ...nuevas, ...deLaCara, ...delEsqueleto] },
    avisos: [
      ...renombradas.avisos,
      ...deLaCara.map((p) => `"${p.pieza}" es parte de la cara de ${plantilla.nombre}: se suma del esqueleto.`),
      ...(delEsqueleto.length ? [`${delEsqueleto.length} pieza(s) genéricas de ${plantilla.nombre} que el pack no nombra: ${delEsqueleto.map((p) => p.pieza).join(", ")}.`] : []),
      ...(movidas ? [`${movidas} pieza(s) sin página del manual se ubicaron según el esqueleto de ${plantilla.nombre}.`] : []),
      ...nuevas.map((p) => `"${p.pieza}" no estaba en el plano: va donde la pone el esqueleto de ${plantilla.nombre}.`),
    ],
  };
}

/** Cada id del pack que falta en el plano toma el lugar de una pieza equivalente que el pack no nombra. */
function renombrarEquivalentes(plano: PlanoDePiezas, ids: string[]): { plano: PlanoDePiezas; avisos: string[] } {
  const esta = new Set(plano.piezas.map((p) => p.pieza));
  const delPack = new Set(ids);
  const nombres = new Map<string, string>();
  for (const id of ids) {
    if (esta.has(id)) continue;
    const vieja = plano.piezas.find((p) => p.padre && !delPack.has(p.pieza) && !nombres.has(p.pieza) && equivalentes(p.pieza, id));
    if (vieja) nombres.set(vieja.pieza, id);
  }
  if (!nombres.size) return { plano, avisos: [] };
  const nuevo = (id?: string) => (id && nombres.get(id)) ?? id;
  return {
    plano: { ...plano, piezas: plano.piezas.map((p) => ({ ...p, pieza: nuevo(p.pieza)!, ...(p.padre ? { padre: nuevo(p.padre) } : {}) })) },
    avisos: [...nombres].map(([v, n]) => `"${v}" del plano guardado es "${n}" en el pack: se usa ese nombre.`),
  };
}

/** Una pieza no puede medir más que esto por el tamaño más grande que tiene su forma en la biblioteca. */
export const VECES_LA_FORMA = 2.5;

/**
 * Medidas con sentido: una pieza estimada mucho más grande que cualquier variante de su forma (un
 * tornillo de 5 cm) se achica parejo, sin cambiar su proporción ni su centro. Por tipo de pieza: las
 * medidas reales de la biblioteca (`caja` del índice). Lo citado del manual no se toca.
 */
export function acotarMedidas(plano: PlanoDePiezas): { plano: PlanoDePiezas; avisos: string[] } {
  const avisos: string[] = [];
  const piezas = plano.piezas.map((p) => {
    if (!p.padre || p.origen === "manual") return p;
    const tipo = tipoPara(p.pieza, NOMBRES);
    const cajas = tipo ? NOMBRES.filter((n) => tipoDe(n) === tipo).flatMap((n) => INDICE.tipos[n].caja ?? []) : [];
    if (!cajas.length) return p;
    const tope = Math.max(...cajas) * VECES_LA_FORMA;
    const mayor = Math.max(...p.dim);
    if (mayor <= tope) return p;
    const f = tope / mayor;
    avisos.push(`"${p.pieza}" medía ${mayor.toFixed(1)} cm, demasiado para un(a) ${tipo}: se achicó a ${tope.toFixed(1)} cm.`);
    return { ...p, dim: p.dim.map((v) => +(v * f).toFixed(3)) as Vec3 };
  });
  return { plano: avisos.length ? { ...plano, piezas } : plano, avisos };
}
