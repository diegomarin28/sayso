import type { ClaseEquipo, KnowledgePack, PiezaPlano, PlanoDePiezas } from "../../../shared";
import type { PiezaPropuesta } from "../generador";
import { palabras, tipoPara } from "../biblioteca";
import { TIPOS_DE_PIEZA } from "../tipos";
import { planoNotebookBase } from "./notebook";
import {
  planoAire,
  planoAspiradora,
  planoAuriculares,
  planoCargador,
  planoControlRemoto,
  planoMando,
  planoMouse,
  planoParlanteBluetooth,
  planoReloj,
  planoTablet,
  planoTeclado,
  planoCafetera,
  planoCelular,
  planoConsola,
  planoHeladera,
  planoImpresora,
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
 * `clase`: la clase del knowledge pack que le corresponde.
 * `parado`: el equipo se usa parado (TV, heladera…): su cara grande va de frente a la cámara, no acostada.
 */
export type PlantillaDeEquipo = { id: string; nombre: string; plano: PlanoDePiezas; equipos: string[]; pistas: string[]; clase?: ClaseEquipo; parado?: boolean };

const t = (id: string, nombre: string, plano: PlanoDePiezas, equipos: string, clase?: ClaseEquipo, parado = false, pistas = ""): PlantillaDeEquipo => ({
  id,
  nombre,
  plano,
  equipos: palabras(equipos),
  pistas: palabras(pistas),
  ...(clase ? { clase } : {}),
  ...(parado ? { parado } : {}),
});

export const PLANTILLAS_POR_TIPO: PlantillaDeEquipo[] = [
  t("notebook", "notebook", planoNotebookBase, "notebook laptop portatil netbook ultrabook macbook", "notebook"),
  t("celular", "celular", planoCelular, "celular telefono smartphone movil iphone", undefined, false, "galaxy moto motorola redmi pixel"),
  t("heladera", "heladera", planoHeladera, "heladera refrigerador freezer congelador nevera", undefined, true),
  t("aire", "aire split", planoAire, "aire split acondicionado climatizador", "split", true),
  t("televisor", "televisor", planoTelevisor, "televisor tele tv monitor", undefined, true),
  t("lavarropas", "lavarropas", planoLavarropas, "lavarropas lavarropa lavadora lavasecarropas secadora", "lavarropas", true),
  t("microondas", "microondas", planoMicroondas, "microondas", undefined, true),
  t("aspiradora", "aspiradora", planoAspiradora, "aspiradora aspirador"),
  t("secador", "secador de pelo", planoSecador, "secador"),
  t("impresora", "impresora", planoImpresora, "impresora"),
  t("consola", "consola", planoConsola, "consola playstation play xbox nintendo switch videojuegos"),
  t("router", "router", planoRouter, "router modem"),
  t("cafetera", "cafetera", planoCafetera, "cafetera espresso"),
  // Lo que más probablemente traiga alguien en la mano.
  t("tablet", "tablet", planoTablet, "tablet tableta ipad tab kindle"),
  t("auriculares", "auriculares", planoAuriculares, "auriculares auricular airpods earbuds buds audifono headphones headset cascos vincha"),
  t("reloj", "reloj inteligente", planoReloj, "reloj smartwatch watch pulsera band", undefined, false, "garmin fitbit amazfit"),
  t("mouse", "mouse", planoMouse, "mouse raton"),
  t("teclado", "teclado", planoTeclado, "teclado keyboard"),
  t("mando", "joystick", planoMando, "joystick mando gamepad control dualshock dualsense joy", undefined, false, "playstation play xbox switch"),
  t("parlante", "parlante bluetooth", planoParlanteBluetooth, "parlant altavoz", undefined, false, "bluetooth jbl echo alexa"),
  t("cargador", "cargador", planoCargador, "cargador adaptador fuente"),
  t("control_remoto", "control remoto", planoControlRemoto, "control remoto mando", undefined, false, "tele tv televisor aire distancia"),
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
export function elegirPlantilla(kp: KnowledgePack, tipoEquipo?: string): PlantillaDeEquipo | undefined {
  // Por nombre: la que más palabras comparte con lo que dijo la recepción, las pistas valen medio
  // ("control remoto" no es un joystick; "control de PlayStation", sí). Empate: la nombrada primero
  // ("cargador de celular" es un cargador: en español el sustantivo va adelante); si no, la primera de la lista.
  const dichas = tipoEquipo ? palabras(tipoEquipo) : [];
  let porNombre: { p: PlantillaDeEquipo; n: number; primera: number } | undefined;
  for (const p of PLANTILLAS_POR_TIPO) {
    const peso = (d: string) => (p.equipos.some((e) => nombra(d, e)) ? 1 : p.pistas.some((e) => nombra(d, e)) ? 0.5 : 0);
    const posiciones = dichas.flatMap((d, i) => (peso(d) ? [i] : []));
    if (!posiciones.length) continue;
    const cand = { p, n: dichas.reduce((n, d) => n + peso(d), 0), primera: posiciones[0] };
    if (!porNombre || cand.n > porNombre.n || (cand.n === porNombre.n && cand.primera < porNombre.primera)) porNombre = cand;
  }
  if (porNombre) return porNombre.p;
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

/**
 * Qué pieza de la plantilla le toca a cada id del pack: primero los ids iguales, después del mismo
 * tipo de pieza (`placa_principal` del pack ↔ `placa_control` de la plantilla). Cada pieza de la
 * plantilla se usa una sola vez. Devuelve id en la plantilla → id del pack, y los ids sin lugar.
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
  for (const id of pendientes) {
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
  const avisos = sinLugar.map((id) => `"${id}" no está en el esquema genérico de ${plantilla.nombre}: no aparece en el 3D.`);
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
