import type { ClaseEquipo, KnowledgePack, PiezaPlano, PlanoDePiezas } from "../../../shared";
import type { PiezaPropuesta } from "../generador";
import { palabras, tipoPara } from "../biblioteca";
import { TIPOS_DE_PIEZA } from "../tipos";
import { planoNotebookBase } from "./notebook";
import {
  planoAfeitadora,
  planoAire,
  planoAspiradora,
  planoCamaraAccion,
  planoCepilloElectrico,
  planoPlanchita,
  planoPowerBank,
  planoAuriculares,
  planoAuricularesVincha,
  raizVisibleVincha,
  planoCargador,
  planoControlRemoto,
  planoMando,
  planoMouse,
  planoParlanteBluetooth,
  planoReloj,
  planoRelojRedondo,
  planoTablet,
  planoTeclado,
  planoCafetera,
  planoCelular,
  planoConsola,
  planoHeladera,
  planoImpresora,
  planoImpresoraLaser,
  planoNotebookSinVentilador,
  planoLavarropas,
  planoMicroondas,
  planoRouter,
  planoSecador,
  planoTelevisor,
} from "./equipos";

/**
 * Plantilla genérica POR TIPO de equipo: la red de seguridad cuando la IA no puede ubicar las piezas.
 * `equipos`: palabras con que la recepción nombra ese equipo; `pistas`: marcas, líneas o contexto que valen medio
 * (`galaxy` es un celular salvo que diga `tab`; `tele` en "control de la tele" es un control remoto);
 * `clase`: la clase del knowledge pack que le corresponde. `cara`: las piezas que hacen reconocible al equipo
 * (la pantalla de un TV, las puertas de una heladera): están siempre, aunque el pack no las nombre.
 * `parado`: el equipo se usa parado (TV, heladera…): su cara grande va de frente a la cámara, no acostada.
 * `opcionales`: piezas del esqueleto que el equipo puede no tener (los joysticks junto a una consola): van solo
 * si el pack las nombra, nunca como genéricas. `raizVisible`: si la raíz mide todo el equipo para escalar pero
 * es una pieza más chica (la vincha de unos auriculares), su lugar y medidas en el esqueleto.
 */
export type PlantillaDeEquipo = {
  id: string;
  nombre: string;
  plano: PlanoDePiezas;
  equipos: string[];
  pistas: string[];
  cara: string[];
  clase?: ClaseEquipo;
  parado?: boolean;
  opcionales: string[];
  raizVisible?: Pick<PiezaPlano, "pos" | "dim">;
  /** Si el tipo tiene más de una forma de pantalla (reloj cuadrado o redondo): un plano por forma y la más común. */
  formas?: FormasDePantalla;
};

export type FormaPantalla = NonNullable<KnowledgePack["formaPantalla"]>;
/** `piezas`: las del esqueleto que llevan la forma (la caja y la pantalla del reloj). */
export type FormasDePantalla = { comun: FormaPantalla; planos: Record<FormaPantalla, PlanoDePiezas>; piezas: string[] };

/** Tipos con más de una forma de pantalla (dato del pack `formaPantalla`). La común es la de más uso en el tipo. */
const FORMAS: Record<string, FormasDePantalla> = {
  reloj: { comun: "cuadrada", planos: { cuadrada: planoReloj, redonda: planoRelojRedondo }, piezas: ["caja_reloj", "pantalla_reloj"] },
};

/** La cara de cada tipo (ver `cara`): sin la pantalla, un TV visto de frente es la retroiluminación. */
const CARA: Record<string, string[]> = {
  televisor: ["pantalla_panel"],
  heladera: ["puerta_heladera", "puerta_freezer"],
  lavarropas: ["puerta_ojo_de_buey"],
  microondas: ["puerta"],
  impresora_laser: ["puerta_frontal"],
  celular: ["pantalla"],
  tablet: ["pantalla"],
};

/** Ver `opcionales`: una PS4 no trae joysticks; si el pack los nombra (un mando con drift), van al costado. */
const OPCIONALES: Record<string, string[]> = {
  consola: ["joystick_analogico_izquierdo", "joystick_analogico_derecho", "boton_gatillo_izquierdo", "boton_gatillo_derecho"],
};

/** Ver `raizVisible`: de la vincha se ve el arco de atrás, no una placa del tamaño de los auriculares. */
const RAIZ_VISIBLE: Record<string, Pick<PiezaPlano, "pos" | "dim">> = {
  auriculares_vincha: raizVisibleVincha,
};

const t = (id: string, nombre: string, plano: PlanoDePiezas, equipos: string, clase?: ClaseEquipo, parado = false, pistas = ""): PlantillaDeEquipo => ({
  id,
  nombre,
  plano,
  equipos: palabras(equipos),
  pistas: palabras(pistas),
  cara: CARA[id] ?? [],
  opcionales: OPCIONALES[id] ?? [],
  ...(RAIZ_VISIBLE[id] ? { raizVisible: RAIZ_VISIBLE[id] } : {}),
  ...(FORMAS[id] ? { formas: FORMAS[id] } : {}),
  ...(clase ? { clase } : {}),
  ...(parado ? { parado } : {}),
});

/** Lo que hace falta del pack para elegir la plantilla: su clase y los ids de sus piezas. */
export type PackParaElegir = { clase: ClaseEquipo; piezas: Array<{ id: string }>; modelo?: string; formaPantalla?: FormaPantalla; rasgos3D?: KnowledgePack["rasgos3D"] };

/**
 * La plantilla con el plano de la forma de pantalla del pack (un reloj redondo usa el esqueleto redondo).
 * Sin dato, la forma más común del tipo: queda estimada (ver `formaEstimada`).
 */
export function conFormaDePantalla(p: PlantillaDeEquipo, formaPantalla?: FormaPantalla): PlantillaDeEquipo {
  return p.formas ? { ...p, plano: p.formas.planos[formaPantalla ?? p.formas.comun] } : p;
}

/**
 * La caja (la raíz) con la forma de pantalla de hoy. Un plano de la caché se armó con otra forma (antes de que
 * el pack trajera `formaPantalla`, o con la común): un reloj redondo seguía con la caja cuadrada. Si la caja no
 * salió de una página del manual, toma la forma y las medidas del esqueleto; lo demás lo acomoda `seguirPlantilla`.
 */
export function conRaizDeLaForma(plano: PlanoDePiezas, p: PlantillaDeEquipo | undefined): PlanoDePiezas {
  const raizT = p?.formas && p.plano.piezas.find((x) => !x.padre);
  const raiz = plano.piezas.find((x) => !x.padre);
  if (!raizT || !raiz || raiz.origen === "manual" || raiz.formaBiblioteca === raizT.formaBiblioteca) return plano;
  const nueva = { ...raiz, dim: raizT.dim, origen: "plantilla" as const, ...(raizT.formaBiblioteca ? { formaBiblioteca: raizT.formaBiblioteca } : {}) };
  return { ...plano, piezas: plano.piezas.map((x) => (x === raiz ? nueva : x)) };
}

/**
 * Si el pack no trajo la forma de la pantalla y el tipo tiene varias, el 3D usó la más común: sus piezas
 * (la raíz y las del mismo tipo que las de la forma, con el id que tengan en el plano) pasan a "estimada"
 * y se avisa. Si la trajo, o el tipo tiene una sola forma, el plano no cambia.
 */
export function marcarFormaEstimada(plano: PlanoDePiezas, p: PlantillaDeEquipo | undefined, kp: { formaPantalla?: FormaPantalla }): { plano: PlanoDePiezas; avisos: string[] } {
  if (!p?.formas || kp.formaPantalla) return { plano, avisos: [] };
  const tipos = new Set(p.formas.piezas.map((id) => tipoDe(id) ?? id));
  const deLaForma = (x: PiezaPlano) => !x.padre || tipos.has(tipoDe(x.pieza) ?? x.pieza);
  return {
    plano: { ...plano, piezas: plano.piezas.map((x) => (deLaForma(x) && x.origen !== "manual" ? { ...x, origen: "estimada" as const } : x)) },
    avisos: [`La forma de la pantalla no vino en el pack: se usa la más común de ${p.nombre} (${p.formas.comun}), estimada.`],
  };
}

export const PLANTILLAS_POR_TIPO: PlantillaDeEquipo[] = [
  t("notebook", "notebook", planoNotebookBase, "notebook laptop portatil netbook ultrabook macbook", "notebook"),
  // "MacBook Air": "macbook" nombra a las dos y la pista "air" desempata. "MacBook Pro" (con ventilador)
  // empata y desempatan las piezas del pack; sin piezas que decidan, la genérica de arriba.
  t("notebook_sin_ventilador", "notebook sin ventilador", planoNotebookSinVentilador, "macbook", "notebook", false, "air"),
  t("celular", "celular", planoCelular, "celular telefono smartphone movil iphone", undefined, false, "galaxy moto motorola redmi pixel"),
  t("heladera", "heladera", planoHeladera, "heladera refrigerador freezer congelador nevera", undefined, true),
  t("aire", "aire split", planoAire, "aire split acondicionado climatizador", "split", true),
  t("televisor", "televisor", planoTelevisor, "televisor tele tv monitor", undefined, true),
  t("lavarropas", "lavarropas", planoLavarropas, "lavarropas lavarropa lavadora lavasecarropas secadora", "lavarropas", true),
  t("microondas", "microondas", planoMicroondas, "microondas", undefined, true),
  t("aspiradora", "aspiradora", planoAspiradora, "aspiradora aspirador"),
  t("secador", "secador de pelo", planoSecador, "secador"),
  t("impresora", "impresora", planoImpresora, "impresora", undefined, false, "tinta inkjet deskjet ecotank pixma chorro"),
  // "Impresora HP LaserJet" nombra a las dos; la láser suma "laserjet" y gana. "Impresora" sola: empatan y
  // desempatan las piezas del pack (tóner → láser); sin piezas que decidan, la de arriba.
  t("impresora_laser", "impresora láser", planoImpresoraLaser, "impresora laser toner", undefined, false, "laserjet"),
  t("consola", "consola", planoConsola, "consola playstation play xbox nintendo switch videojuegos"),
  t("router", "router", planoRouter, "router modem"),
  t("cafetera", "cafetera", planoCafetera, "cafetera espresso"),
  // Lo que más probablemente traiga alguien en la mano.
  t("tablet", "tablet", planoTablet, "tablet tableta ipad tab kindle"),
  t("auriculares", "auriculares", planoAuriculares, "auriculares auricular airpods earbuds buds audifono", undefined, false, "tws inalambricos estuche"),
  // "Auriculares" nombra a los dos: desempatan el modelo y las piezas del pack (copa, almohadilla de oreja → vincha).
  t("auriculares_vincha", "auriculares de vincha", planoAuricularesVincha, "auriculares auricular vincha headphones headset cascos diadema", undefined, false, "over"),
  t("reloj", "reloj inteligente", planoReloj, "reloj smartwatch watch pulsera band", undefined, false, "garmin fitbit amazfit"),
  t("mouse", "mouse", planoMouse, "mouse raton"),
  t("teclado", "teclado", planoTeclado, "teclado keyboard"),
  t("mando", "joystick", planoMando, "joystick mando gamepad control dualshock dualsense joy", undefined, false, "playstation play xbox switch"),
  t("parlante", "parlante bluetooth", planoParlanteBluetooth, "parlant altavoz", undefined, false, "bluetooth jbl echo alexa"),
  t("cargador", "cargador", planoCargador, "cargador adaptador fuente"),
  t("control_remoto", "control remoto", planoControlRemoto, "control remoto mando", undefined, false, "tele tv televisor aire distancia"),
  t("powerbank", "batería externa", planoPowerBank, "powerbank power bank", undefined, false, "externa"),
  t("camara", "cámara", planoCamaraAccion, "camara gopro filmadora videocamara", undefined, false, "hero accion fotos"),
  t("afeitadora", "afeitadora", planoAfeitadora, "afeitadora maquinita cortadora rasuradora trimmer barbera patillera"),
  t("planchita", "planchita de pelo", planoPlanchita, "planchita alisadora buclera rizador"),
  t("cepillo", "cepillo eléctrico", planoCepilloElectrico, "cepillo", undefined, false, "dientes dental oral"),
];

const NOMBRES_DE_TIPO = TIPOS_DE_PIEZA.map((x) => x.tipo);
const tipoDe = (id: string) => tipoPara(id, NOMBRES_DE_TIPO);

/** Una palabra nombra el equipo si es igual, o si empieza con un nombre largo ("lavarropas" en "lavarropas"; "tele" no entra en "teléfono"). */
const nombra = (palabra: string, equipo: string) => palabra === equipo || (equipo.length >= 5 && palabra.startsWith(equipo));

/** Tipos de pieza que distinguen una plantilla: los que aparecen en una o dos (placa, cable o tornillo están en casi todas). */
const DISTINTIVOS: Map<string, Set<string>> = (() => {
  const enCuantas = new Map<string, number>();
  const porPlantilla = new Map(PLANTILLAS_POR_TIPO.map((p) => [p.id, new Set(p.plano.piezas.map((x) => tipoDe(x.pieza)).filter((x): x is string => !!x))]));
  for (const tipos of porPlantilla.values()) for (const x of tipos) enCuantas.set(x, (enCuantas.get(x) ?? 0) + 1);
  return new Map([...porPlantilla].map(([id, tipos]) => [id, new Set([...tipos].filter((x) => enCuantas.get(x)! <= 2))]));
})();
/** Con menos piezas distintivas en común no se adivina el equipo: caja genérica. */
const MIN_DISTINTIVAS = 2;

/**
 * La plantilla del tipo de equipo, de más a menos confiable: el tipo que dijo la recepción (texto
 * libre), la clase del knowledge pack, o las piezas del pack (un pack con compresor y puerta de
 * freezer es una heladera). Sin señal suficiente, `undefined`: el que llama usa la caja genérica.
 */
export function elegirPlantilla(kp: PackParaElegir, tipoEquipo?: string): PlantillaDeEquipo | undefined {
  let elegida = elegirPorTipo(kp, tipoEquipo);
  const formato = kp.rasgos3D?.auriculares?.formato;
  if (elegida && ["auriculares", "auriculares_vincha"].includes(elegida.id) && (formato === "over_ear" || formato === "in_ear")) {
    elegida = PLANTILLAS_POR_TIPO.find(p => p.id === (formato === "over_ear" ? "auriculares_vincha" : "auriculares"));
  }
  const especial = elegida && kp.modelo ? especializar(elegida, kp.modelo) : elegida;
  // Con el plano de la forma de pantalla del pack (dato del pack; sin dato, la más común del tipo).
  return especial && conFormaDePantalla(especial, kp.formaPantalla);
}

/**
 * Las formas de pantalla posibles del tipo de equipo (texto libre, ej. "reloj inteligente"): así el
 * bibliotecario pide `formaPantalla` solo para los tipos que tienen más de una. Vacío si tiene una sola.
 */
export function formasDePantallaDe(tipoEquipo: string): FormaPantalla[] {
  const formas = elegirPorTipo({ clase: "otro", piezas: [] }, tipoEquipo)?.formas;
  return formas ? (Object.keys(formas.planos) as FormaPantalla[]) : [];
}

/**
 * Dentro de la misma clase, la plantilla que mejor nombra el modelo del pack (sus palabras valen 1 y sus
 * pistas medio). La recepción dice "notebook"; el pack, "MacBook Air M1": la notebook sin ventilador. Solo
 * si nombra MÁS que la elegida: "MacBook Pro" empata y queda la genérica; "IdeaPad 3" no nombra a ninguna.
 */
function especializar(elegida: PlantillaDeEquipo, modelo: string): PlantillaDeEquipo {
  if (!elegida.clase) return elegida;
  const delModelo = palabras(modelo);
  const puntos = (p: PlantillaDeEquipo) =>
    delModelo.reduce((n, d) => n + (p.equipos.some((e) => nombra(d, e)) ? 1 : p.pistas.some((e) => nombra(d, e)) ? 0.5 : 0), 0);
  let mejor = { p: elegida, n: puntos(elegida) };
  for (const p of PLANTILLAS_POR_TIPO) {
    if (p === elegida || p.clase !== elegida.clase) continue;
    const n = puntos(p);
    if (n > mejor.n) mejor = { p, n };
  }
  return mejor.p;
}

function elegirPorTipo(kp: PackParaElegir, tipoEquipo?: string): PlantillaDeEquipo | undefined {
  // Por nombre: la que más palabras comparte con lo que dijo la recepción, las pistas valen medio
  // ("control remoto" no es un joystick; "control de PlayStation", sí). Empate: la nombrada primero
  // ("cargador de celular" es un cargador: en español el sustantivo va adelante); si no, la primera de la lista.
  const dichas = tipoEquipo ? palabras(tipoEquipo) : [];
  const candidatas: { p: PlantillaDeEquipo; n: number; primera: number }[] = [];
  let porNombre: { p: PlantillaDeEquipo; n: number; primera: number } | undefined;
  for (const p of PLANTILLAS_POR_TIPO) {
    const peso = (d: string) => (p.equipos.some((e) => nombra(d, e)) ? 1 : p.pistas.some((e) => nombra(d, e)) ? 0.5 : 0);
    const posiciones = dichas.flatMap((d, i) => (peso(d) ? [i] : []));
    if (!posiciones.length) continue;
    const cand = { p, n: dichas.reduce((n, d) => n + peso(d), 0), primera: posiciones[0] };
    candidatas.push(cand);
    if (!porNombre || cand.n > porNombre.n || (cand.n === porNombre.n && cand.primera < porNombre.primera)) porNombre = cand;
  }
  if (porNombre) {
    // Empate de verdad (misma palabra, mismo peso: "impresora" nombra a la de tinta y a la láser): desempatan
    // las piezas del pack. Gana la que tiene en el pack más tipos de pieza que las otras empatadas no tienen
    // (tóner o fusora → láser; cabezal o cartucho de tinta → tinta). Sin piezas que decidan, la primera de la lista.
    // Antes que las piezas, el modelo del pack ("Epson EcoTank L3250" → tinta), con las mismas palabras y pistas.
    const empatadas = candidatas.filter((c) => c.n === porNombre!.n && c.primera === porNombre!.primera).map((c) => c.p);
    return empatadas.length > 1 ? (porModelo(empatadas, kp.modelo) ?? porPiezasPropias(empatadas, kp) ?? porPalabrasPropias(empatadas, kp) ?? porNombre.p) : porNombre.p;
  }
  const porClase = PLANTILLAS_POR_TIPO.find((p) => p.clase && p.clase === kp.clase);
  if (porClase) return porClase;
  const tiposDelPack = kp.piezas.map((p) => tipoDe(p.id)).filter((x): x is string => !!x);
  let mejor: { p: PlantillaDeEquipo; n: number } | undefined;
  for (const p of PLANTILLAS_POR_TIPO) {
    const distintivos = DISTINTIVOS.get(p.id)!;
    const n = tiposDelPack.filter((x) => distintivos.has(x)).length;
    if (n >= MIN_DISTINTIVAS && (!mejor || n > mejor.n)) mejor = { p, n };
  }
  return mejor?.p;
}

/** Entre plantillas empatadas por nombre, la única que el modelo del pack nombra más que las otras. */
function porModelo(empatadas: PlantillaDeEquipo[], modelo?: string): PlantillaDeEquipo | undefined {
  if (!modelo) return undefined;
  const delModelo = palabras(modelo);
  const puntos = empatadas.map((p) => delModelo.reduce((n, d) => n + (p.equipos.some((e) => nombra(d, e)) ? 1 : p.pistas.some((e) => nombra(d, e)) ? 0.5 : 0), 0));
  const max = Math.max(...puntos);
  return max > 0 && puntos.filter((n) => n === max).length === 1 ? empatadas[puntos.indexOf(max)] : undefined;
}

const CARCASA = /^carcasa(_|$)/;

/**
 * Entre plantillas empatadas por nombre, la que tiene en el pack más tipos de pieza que no tienen las otras.
 * Una pieza sin forma en la biblioteca cuenta por su primera palabra ("copa_izquierda" → copa).
 */
function porPiezasPropias(empatadas: PlantillaDeEquipo[], kp: PackParaElegir): PlantillaDeEquipo | undefined {
  const tipoORaiz = (id: string) => tipoDe(id) ?? id.split("_")[0];
  const tipos = (p: PlantillaDeEquipo) => new Set(p.plano.piezas.map((x) => tipoORaiz(x.pieza)));
  const delPack = new Set(kp.piezas.map((p) => tipoORaiz(p.id)));
  let mejor: { p: PlantillaDeEquipo; n: number } | undefined;
  for (const p of empatadas) {
    const otras = new Set(empatadas.filter((q) => q !== p).flatMap((q) => [...tipos(q)]));
    // La carcasa la tiene cualquier variante (en unos de vincha es la copa): no desempata.
    const n = [...tipos(p)].filter((x) => !otras.has(x) && !CARCASA.test(x) && delPack.has(x)).length;
    if (n > 0 && (!mejor || n > mejor.n)) mejor = { p, n };
  }
  return mejor?.p;
}

/**
 * Si las piezas no deciden: la única que tiene en el pack más palabras que son la primera de alguna de sus
 * piezas y de ninguna de las otras ("tornillo_copa" → copa → vincha; "contacto_carga" → contacto → in-ear).
 */
function porPalabrasPropias(empatadas: PlantillaDeEquipo[], kp: PackParaElegir): PlantillaDeEquipo | undefined {
  const primeras = (p: PlantillaDeEquipo) => new Set(p.plano.piezas.map((x) => x.pieza.split("_")[0]).filter((w) => !CARCASA.test(w)));
  const delPack = new Set(kp.piezas.flatMap((p) => p.id.split("_")));
  const puntos = empatadas.map((p) => {
    const otras = new Set(empatadas.filter((q) => q !== p).flatMap((q) => [...primeras(q)]));
    return [...primeras(p)].filter((w) => !otras.has(w) && delPack.has(w)).length;
  });
  const max = Math.max(...puntos);
  return max > 0 && puntos.filter((n) => n === max).length === 1 ? empatadas[puntos.indexOf(max)] : undefined;
}

/**
 * Las piezas que probablemente dibuje el 3D, antes de tener el plano: las del pack y las del
 * esqueleto de su tipo de equipo (que completa lo que la IA no ubica). Sirve solo con el tipo
 * (todavía sin pack) o solo con el pack. Para precargar sus formas (`usePrecargaPiezas`).
 */
export function piezasProbables(tipoEquipo?: string | null, pack?: PackParaElegir | null): string[] {
  const kp = pack ?? { clase: "otro" as const, piezas: [] };
  const plantilla = elegirPlantilla(kp, tipoEquipo ?? undefined);
  return [...new Set([...kp.piezas.map((p) => p.id), ...(plantilla?.plano.piezas.map((p) => p.pieza) ?? [])])];
}

/**
 * Nombres que los manuales usan para la MISMA pieza (por tipo, no por modelo): la placa principal es
 * "placa madre" en una notebook, "placa lógica" en un iPhone, "placa principal" en un TV.
 */
const EQUIVALENTES: string[][] = [
  ["placa_madre", "placa_logica", "placa_principal", "placa_base", "placa_control", "motherboard", "logic_board"],
  ["parlante", "altavoz", "speaker", "loudspeaker"],
  ["conector_carga", "puerto_carga", "puerto_usb", "conector_usb", "conector_lightning"],
  // Auriculares de vincha: la almohadilla de la copa es la de la oreja.
  ["almohadilla_copa", "almohadilla_oreja"],
];
const grupoDe = (id: string) => EQUIVALENTES.find((g) => g.some((n) => id === n || id.startsWith(`${n}_`)));
/** "izquierd" o "derech" si el id dice de qué lado va ("copa_derecha", "almohadilla_oreja_izquierda"). */
export const lado = (id: string) => id.match(/_(izquierd|derech)[oa]?(_|$)/)?.[1];

/** ¿Dos ids nombran la misma pieza? (`placa_logica` y `placa_madre`: sí; `placa_madre` y `placa_carga`: no). */
export function equivalentes(a: string, b: string): boolean {
  const g = grupoDe(a);
  return a === b || (!!g && g === grupoDe(b));
}

/**
 * Qué pieza de la plantilla le toca a cada id del pack: primero los ids iguales; después un nombre
 * equivalente (`placa_logica` del pack ↔ `placa_madre` de la plantilla, no la placa de carga); después
 * del mismo tipo de pieza (`placa_principal_x` ↔ `placa_control`). Cada pieza de la plantilla se usa una
 * sola vez. Devuelve id en la plantilla → id del pack, y los ids sin lugar.
 */
export function emparejar(ids: string[], plantilla: PlantillaDeEquipo): { usadas: Map<string, string>; sinLugar: string[] } {
  const piezas = plantilla.plano.piezas;
  const usadas = new Map<string, string>();
  const libres = () => piezas.filter((p) => !usadas.has(p.pieza));
  const pendientes = ids.filter((id) => {
    const igual = libres().find((p) => p.pieza === id);
    if (igual) usadas.set(igual.pieza, id);
    return !igual;
  });
  const sinLugar: string[] = [];
  const porTipo = pendientes.filter((id) => {
    const grupo = grupoDe(id);
    // Del mismo lado si el id lo dice ("almohadilla_oreja_derecha" → la de la copa derecha).
    const delGrupo = grupo ? libres().filter((p) => grupoDe(p.pieza) === grupo) : [];
    const equivalente = delGrupo.find((p) => lado(p.pieza) === lado(id)) ?? delGrupo[0];
    if (equivalente) usadas.set(equivalente.pieza, id);
    return !equivalente;
  });
  for (const id of porTipo) {
    const tipo = tipoDe(id);
    const mismaForma = tipo ? libres().find((p) => tipoDe(p.pieza) === tipo) : undefined;
    if (mismaForma) usadas.set(mismaForma.pieza, id);
    else sinLugar.push(id);
  }
  return { usadas, sinLugar };
}

/**
 * Sin IA, con la plantilla del tipo de equipo: la pieza raíz (carcasa o placa principal) y, para
 * cada pieza del knowledge pack, la de la plantilla con el mismo id o, si no, del mismo tipo (con
 * el id del pack, así la guía la puede nombrar). Todo con origen "plantilla": ni las ubicaciones
 * ni las medidas vienen del manual. Lo que no tiene lugar en la plantilla no aparece (queda en `avisos`).
 */
export function planoDesdePlantillaDeTipo(kp: KnowledgePack, plantilla: PlantillaDeEquipo): { plano: PlanoDePiezas; avisos: string[] } {
  const piezas = plantilla.plano.piezas;
  const raiz = piezas.find((p) => !p.padre) ?? piezas[0];
  const delPack = kp.piezas.filter((p) => !["base", "tapa_inferior"].includes(p.id) || plantilla.id === "notebook");
  const { usadas, sinLugar } = emparejar(delPack.map((p) => p.id), plantilla);
  const avisos = sinLugar.map((id) => `"${id}" no está en el esquema genérico de ${plantilla.nombre}.`);
  if (!usadas.has(raiz.pieza)) usadas.set(raiz.pieza, raiz.pieza);

  const etiqueta = new Map(kp.piezas.map((p) => [p.id, p.etiquetaManual]));
  const idRaiz = usadas.get(raiz.pieza)!;
  const resultado: PiezaPlano[] = piezas
    .filter((p) => usadas.has(p.pieza))
    .map((p) => {
      const id = usadas.get(p.pieza)!;
      const padre = p === raiz ? undefined : p.padre && usadas.has(p.padre) ? usadas.get(p.padre) : idRaiz;
      const numero = etiqueta.get(id);
      return {
        pieza: id,
        forma: p.forma,
        dim: [...p.dim],
        pos: [...p.pos],
        pivote: [...p.pivote],
        ...(padre ? { padre } : {}),
        ...(numero ? { etiquetaManual: numero } : {}),
        ...(p.formaBiblioteca ? { formaBiblioteca: p.formaBiblioteca } : {}),
        origen: "plantilla" as const,
      };
    });
  return {
    plano: { modelo: kp.modelo, unidades: "cm", piezas: resultado, medidas: { ancho: "plantilla", prof: "plantilla" } },
    avisos,
  };
}

/** Alto / ancho de la cara grande de un equipo parado, según su plantilla (TV 0,66; heladera 2,9…). */
export function proporcionDeLaCara(plantilla: PlantillaDeEquipo): number {
  const raiz = plantilla.plano.piezas.find((p) => !p.padre) ?? plantilla.plano.piezas[0];
  return raiz.dim[1] / raiz.dim[0];
}

/** Medidas típicas (ancho × alto, cm) de la cara de un equipo parado, de su plantilla. */
export function caraTipica(plantilla: PlantillaDeEquipo): { ancho: number; alto: number } {
  const raiz = plantilla.plano.piezas.find((p) => !p.padre) ?? plantilla.plano.piezas[0];
  return { ancho: raiz.dim[0], alto: raiz.dim[1] };
}

/**
 * Para completar lo que la IA no ubicó: la posición de cada pieza del pack en la plantilla de su tipo,
 * en el formato de la propuesta (planta de -1 a 1, tamaños relativos). En un equipo parado la planta es
 * la cara (x, y): lo de arriba de la plantilla queda arriba (z = -1). Todo en confianza baja.
 */
export function propuestaDePlantillaDeTipo(ids: string[], plantilla: PlantillaDeEquipo): PiezaPropuesta[] {
  const piezas = plantilla.plano.piezas;
  const raiz = piezas.find((p) => !p.padre) ?? piezas[0];
  const { usadas } = emparejar(ids, plantilla);
  const [W, H, D] = raiz.dim;
  const res: PiezaPropuesta[] = [];
  for (const p of piezas) {
    const id = usadas.get(p.pieza);
    if (!id || p === raiz) continue;
    const [x, y, z] = [p.pos[0] - raiz.pos[0], p.pos[1] - raiz.pos[1], p.pos[2] - raiz.pos[2]];
    const enPlanta = plantilla.parado
      ? { x: x / (W / 2), z: -y / (H / 2), ancho: p.dim[0] / W, prof: p.dim[1] / H, alto: p.dim[2] }
      : { x: x / (W / 2), z: z / (D / 2), ancho: p.dim[0] / W, prof: p.dim[2] / D, alto: p.dim[1] };
    res.push({
      pieza: id,
      x: enPlanta.x,
      z: enPlanta.z,
      ancho: enPlanta.ancho,
      prof: enPlanta.prof,
      alto_cm: enPlanta.alto,
      capa: "sobre_base",
      sobre: null,
      forma: p.forma,
      etiquetaManual: null,
      pagina: null,
      confianza: "baja",
    });
  }
  return res;
}
