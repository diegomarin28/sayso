import type { ClaseEquipo, KnowledgePack, PiezaPlano, PlanoDePiezas } from "../../../shared";
import { palabras, tipoPara } from "../biblioteca";
import { TIPOS_DE_PIEZA } from "../tipos";
import { planoNotebookBase } from "./notebook";
import {
  planoAire,
  planoAspiradora,
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
 * `equipos`: palabras con que la recepción nombra ese equipo; `clase`: la clase del knowledge pack que le corresponde.
 * `parado`: el equipo se usa parado (TV, heladera…): su cara grande va de frente a la cámara, no acostada.
 */
export type PlantillaDeEquipo = { id: string; nombre: string; plano: PlanoDePiezas; equipos: string[]; clase?: ClaseEquipo; parado?: boolean };

const t = (id: string, nombre: string, plano: PlanoDePiezas, equipos: string, clase?: ClaseEquipo, parado = false): PlantillaDeEquipo => ({
  id,
  nombre,
  plano,
  equipos: palabras(equipos),
  ...(clase ? { clase } : {}),
  ...(parado ? { parado } : {}),
});

export const PLANTILLAS_POR_TIPO: PlantillaDeEquipo[] = [
  t("notebook", "notebook", planoNotebookBase, "notebook laptop portatil netbook ultrabook macbook", "notebook"),
  t("celular", "celular", planoCelular, "celular telefono smartphone movil iphone"),
  t("heladera", "heladera", planoHeladera, "heladera refrigerador freezer congelador nevera", undefined, true),
  t("aire", "aire split", planoAire, "aire split acondicionado climatizador", "split", true),
  t("televisor", "televisor", planoTelevisor, "televisor tele tv smart monitor", undefined, true),
  t("lavarropas", "lavarropas", planoLavarropas, "lavarropas lavarropa lavadora lavasecarropas", "lavarropas", true),
  t("microondas", "microondas", planoMicroondas, "microondas", undefined, true),
  t("aspiradora", "aspiradora", planoAspiradora, "aspiradora aspirador"),
  t("secador", "secador de pelo", planoSecador, "secador pelo"),
  t("impresora", "impresora", planoImpresora, "impresora"),
  t("consola", "consola", planoConsola, "consola playstation xbox nintendo videojuegos"),
  t("router", "router", planoRouter, "router modem"),
  t("cafetera", "cafetera", planoCafetera, "cafetera espresso"),
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
  const dichas = tipoEquipo ? palabras(tipoEquipo) : [];
  const porNombre = PLANTILLAS_POR_TIPO.find((p) => dichas.some((d) => p.equipos.some((e) => nombra(d, e))));
  if (porNombre) return porNombre;
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
 * Sin IA, con la plantilla del tipo de equipo: la pieza raíz (carcasa o placa principal) y, para
 * cada pieza del knowledge pack, la de la plantilla con el mismo id o, si no, del mismo tipo (con
 * el id del pack, así la guía la puede nombrar). Todo con origen "plantilla": ni las ubicaciones
 * ni las medidas vienen del manual. Lo que no tiene lugar en la plantilla no aparece (queda en `avisos`).
 */
export function planoDesdePlantillaDeTipo(kp: KnowledgePack, plantilla: PlantillaDeEquipo): { plano: PlanoDePiezas; avisos: string[] } {
  const piezas = plantilla.plano.piezas;
  const raiz = piezas.find((p) => !p.padre) ?? piezas[0];
  const usadas = new Map<string, string>(); // id en la plantilla → id en el plano (el del pack)
  const avisos: string[] = [];
  const delPack = kp.piezas.filter((p) => !["base", "tapa_inferior"].includes(p.id) || plantilla.id === "notebook");

  // Primero los ids iguales, después por tipo (cada pieza de la plantilla se usa una sola vez).
  const libres = () => piezas.filter((p) => !usadas.has(p.pieza));
  const pendientes = delPack.filter((k) => {
    const igual = libres().find((p) => p.pieza === k.id);
    if (igual) usadas.set(igual.pieza, k.id);
    return !igual;
  });
  for (const k of pendientes) {
    const tipo = tipoDe(k.id);
    const mismaForma = tipo ? libres().find((p) => tipoDe(p.pieza) === tipo) : undefined;
    if (mismaForma) usadas.set(mismaForma.pieza, k.id);
    else avisos.push(`"${k.id}" no está en el esquema genérico de ${plantilla.nombre}: no aparece en el 3D.`);
  }
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
