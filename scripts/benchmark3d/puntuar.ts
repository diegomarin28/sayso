import { readFileSync, statSync } from "node:fs";
import * as THREE from "three";
import type { PlanoDePiezas } from "../../shared";
import { cajaDespiezada, encuadre, prepararEscena } from "../../components/viewer/escena";
import { piezasGenericas } from "../../components/viewer/origen";
import type { LlamarIA } from "../../lib/ia/claude";
import { IndicePiezas, archivosDeFormas, bibliotecaDesdeEscena, formasPara, modeloPara, type BibliotecaPiezas } from "../../lib/planogenerator/biblioteca";
import { cargadorGlb } from "../../lib/planogenerator/cargador";
import { generarPlano } from "../../lib/planogenerator/generador";
import type { CasoBenchmark, FotoReferencia, MedidasReferencia } from "./caso";
import {
  certeza,
  choques,
  espejadoEnX,
  flotantes,
  posiciones,
  proporciones,
  puntosEscala,
  puntosForma,
  type Certeza,
  type PiezaEnFoto,
  type Proporciones,
} from "./metricas";

/**
 * Puntaje de un plano (0–100 por eje) como lo vería la app: con las formas de la biblioteca que bajaría el visor
 * (`formasPara`, #313) y la cámara del visor. Sin IA ni red: los GLB se leen de public/models/piezas.
 */

export type Entorno = { indice: IndicePiezas; familias: Map<string, BibliotecaPiezas>; bytes: Map<string, number> };

export async function cargarEntorno(carpeta = "public/models/piezas/"): Promise<Entorno> {
  const indice = IndicePiezas.parse(JSON.parse(readFileSync(carpeta + "indice.json", "utf8")));
  const familias = new Map<string, BibliotecaPiezas>();
  const bytes = new Map<string, number>();
  for (const archivo of new Set(Object.values(indice.familias))) {
    const datos = readFileSync(carpeta + archivo);
    const escena = (await cargadorGlb().parseAsync(datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength), "")).scene;
    familias.set(archivo, bibliotecaDesdeEscena(escena));
    bytes.set(archivo, statSync(carpeta + archivo).size);
  }
  return { indice, familias, bytes };
}

/** Lo que arma `cargarBiblioteca` en el visor: solo las formas posibles, de las familias que las tienen. */
export function bibliotecaDelVisor(plano: PlanoDePiezas, tipoEquipo: string | undefined, { indice, familias }: Entorno) {
  const formas = formasPara(plano.piezas, indice, tipoEquipo);
  const archivos = archivosDeFormas(formas, indice);
  const biblioteca: BibliotecaPiezas = new Map(archivos.flatMap((a) => [...(familias.get(a) ?? [])].filter(([n]) => formas.has(n))));
  return { biblioteca, archivos };
}

/** La IA que no responde: el generador cae a la plantilla del tipo, como en la app cuando falla. */
const sinIA: LlamarIA = async () => "sin IA en el benchmark";

/** El plano que arma la app sin IA para el pack del caso (la red de seguridad: plantilla del tipo). */
export async function planoDePlantilla(caso: CasoBenchmark): Promise<PlanoDePiezas> {
  const r = await generarPlano({ casoId: `benchmark-${caso.tipo}`, knowledgePack: caso.pack, tipoEquipo: caso.tipoEquipo }, sinIA);
  return r.plano;
}

/** Celular medio (docs/3d-estrategia.md: GLB < ~5 MB, 30 fps). Pasarse resta hasta llegar a 0 con el doble. */
export const PRESUPUESTO = { bytes: 5_000_000, triangulos: 200_000, mallas: 300 } as const;
/** Lienzo del 3D en un iPhone en vertical (como despiece.test.ts) y la cámara del visor. */
export const LIENZO = { width: 390, height: 640 };
const FOV = 35;

export type Encuadre = { cortado: boolean; chico: boolean };

/** El equipo en la vista general, cerrado (0) o despiezado (1): ¿se sale de la pantalla o queda chico? */
function medirEncuadre(plano: PlanoDePiezas, biblioteca: BibliotecaPiezas, tipoEquipo: string | undefined, despiece: 0 | 1): Encuadre {
  const escena = prepararEscena(plano, biblioteca, tipoEquipo);
  const camara = new THREE.PerspectiveCamera(FOV, LIENZO.width / LIENZO.height, 0.1, 5000);
  const e = encuadre(escena, "general", 1, camara, LIENZO, despiece);
  camara.position.copy(e.posicion);
  camara.lookAt(e.objetivo);
  camara.updateMatrixWorld();
  const caja = cajaDespiezada(escena, despiece);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const x of [caja.min.x, caja.max.x])
    for (const y of [caja.min.y, caja.max.y])
      for (const z of [caja.min.z, caja.max.z]) {
        const p = new THREE.Vector3(x, y, z).project(camara);
        xs.push(p.x);
        ys.push(p.y);
      }
  const ancho = Math.max(...xs) - Math.min(...xs);
  const alto = Math.max(...ys) - Math.min(...ys);
  // Como galeria3d/analisis.ts: cortado si se sale; chico si ocupa menos de un tercio a lo ancho y a lo alto.
  return { cortado: [...xs, ...ys].some((v) => Math.abs(v) > 1.001), chico: ancho < 2 / 3 && alto < 2 / 3 };
}

export type Rendimiento = { bytes: number; archivos: string[]; triangulos: number; mallas: number; cerrado: Encuadre; despiezado: Encuadre };

function rendimiento(plano: PlanoDePiezas, tipoEquipo: string | undefined, entorno: Entorno): Rendimiento {
  const { biblioteca, archivos } = bibliotecaDelVisor(plano, tipoEquipo, entorno);
  const escena = prepararEscena(plano, biblioteca, tipoEquipo);
  let triangulos = 0;
  let mallas = 0;
  escena.raiz.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const g = o.geometry as THREE.BufferGeometry;
    triangulos += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
    mallas++;
  });
  return {
    bytes: archivos.reduce((s, a) => s + (entorno.bytes.get(a) ?? 0), 0),
    archivos,
    triangulos: Math.round(triangulos),
    mallas,
    cerrado: medirEncuadre(plano, biblioteca, tipoEquipo, 0),
    despiezado: medirEncuadre(plano, biblioteca, tipoEquipo, 1),
  };
}

export type Puntajes = {
  geometria: number;
  /** Sin fotos anotadas: null. */
  posicion: number | null;
  /** Coherencia de lo que el plano dice saber (100 = nada sin respaldo). */
  certeza: number;
  /** Parte de las piezas ubicadas con el manual o con fotos (informativo: sin IA es 0). */
  evidencia: number;
  rendimiento: number;
};

export type Resultado = {
  tipo: string;
  equipo: string;
  modo: "plantilla" | "guardado";
  puntajes: Puntajes;
  detalle: {
    proporciones: Proporciones | null;
    choques: Array<[string, string, number]>;
    flotantes: string[];
    /** Piezas del pack que el plano no tiene. */
    faltantes: string[];
    /** Piezas sin forma en la biblioteca: el visor las dibuja como una caja o un cilindro. */
    sinForma: string[];
    posiciones: PiezaEnFoto[];
    /** La posición con el plano reflejado en x (informativo): si sube mucho, el 3D quedó espejado. */
    posicionEspejada: number | null;
    certeza: Certeza;
    /** Piezas que el visor pinta en gris (el esqueleto las suma y el pack no las nombra). */
    genericas: string[];
    rendimiento: Rendimiento;
  };
};

/** Pesos de la geometría (suman 1). Sin medidas de referencia, se reparten entre los demás. */
export const PESOS_GEOMETRIA = { forma: 0.3, escala: 0.1, choques: 0.2, flotantes: 0.15, cobertura: 0.25 } as const;

const pct = (x: number) => Math.round(100 * x);
const dentroDe = (v: number, tope: number) => (v <= tope ? 1 : Math.max(0, 2 - v / tope));

export type EntradaPuntuar = {
  tipo: string;
  equipo: string;
  modo: Resultado["modo"];
  tipoEquipo?: string;
  plano: PlanoDePiezas;
  piezasDelPack: ReadonlyArray<{ id: string }>;
  medidas?: MedidasReferencia;
  fuera?: readonly string[];
  fotos?: readonly FotoReferencia[];
};

export function puntuar(e: EntradaPuntuar, entorno: Entorno): Resultado {
  const { plano, tipoEquipo } = e;
  const ids = new Set(plano.piezas.map((p) => p.pieza));
  const total = plano.piezas.length;

  const prop = e.medidas ? proporciones(plano, e.medidas, e.fuera) : null;
  const ch = choques(plano, e.fuera);
  const enChoque = new Set(ch.flatMap(([a, b]) => [a, b]));
  const flot = flotantes(plano);
  const faltantes = e.piezasDelPack.map((p) => p.id).filter((id) => !ids.has(id));
  const { biblioteca } = bibliotecaDelVisor(plano, tipoEquipo, entorno);
  const sinForma = plano.piezas.filter((p) => !modeloPara(p.pieza, biblioteca, p.dim, tipoEquipo, p.formaBiblioteca)).map((p) => p.pieza);
  const delPack = e.piezasDelPack.length ? e.piezasDelPack.map((p) => p.id) : [...ids];
  const cubiertas = delPack.filter((id) => ids.has(id) && !sinForma.includes(id)).length / delPack.length;

  type Parte = [keyof typeof PESOS_GEOMETRIA, number];
  const partes: Parte[] = [
    ...(prop ? ([["forma", puntosForma(prop)], ["escala", puntosEscala(prop)]] satisfies Parte[]) : []),
    ["choques", 1 - enChoque.size / total],
    ["flotantes", 1 - flot.length / total],
    ["cobertura", cubiertas],
  ];
  const pesos = partes.reduce((s, [k]) => s + PESOS_GEOMETRIA[k], 0);
  const geometria = partes.reduce((s, [k, v]) => s + PESOS_GEOMETRIA[k] * v, 0) / pesos;

  const pos = posiciones(plano, e.fotos ?? [], e.fuera);
  const enPuntos = (ps: PiezaEnFoto[]) => (ps.length ? pct(ps.reduce((s, p) => s + p.puntos, 0) / (2 * ps.length)) : null);
  const cert = certeza(plano);
  const rend = rendimiento(plano, tipoEquipo, entorno);
  const encuadres = [rend.cerrado, rend.despiezado].flatMap((x) => [!x.cortado, !x.chico]);
  const puntosRend =
    (dentroDe(rend.bytes, PRESUPUESTO.bytes) + dentroDe(rend.triangulos, PRESUPUESTO.triangulos) + dentroDe(rend.mallas, PRESUPUESTO.mallas)) / 4 +
    encuadres.filter(Boolean).length / encuadres.length / 4;

  return {
    tipo: e.tipo,
    equipo: e.equipo,
    modo: e.modo,
    puntajes: {
      geometria: pct(geometria),
      posicion: enPuntos(pos),
      certeza: pct(1 - cert.incoherencias.length / total),
      evidencia: pct((cert.origen.manual + cert.origen.foto) / total),
      rendimiento: pct(puntosRend),
    },
    detalle: {
      proporciones: prop,
      choques: ch,
      flotantes: flot,
      faltantes,
      sinForma,
      posiciones: pos,
      posicionEspejada: enPuntos(posiciones(espejadoEnX(plano), e.fotos ?? [], e.fuera)),
      certeza: cert,
      genericas: [...piezasGenericas(plano, e.piezasDelPack)],
      rendimiento: rend,
    },
  };
}

/** El caso con el plano que arma la app sin IA (o el que se pase). */
export async function puntuarCaso(caso: CasoBenchmark, entorno: Entorno, plano?: PlanoDePiezas): Promise<Resultado> {
  return puntuar(
    {
      tipo: caso.tipo,
      equipo: caso.equipo,
      modo: "plantilla",
      tipoEquipo: caso.tipoEquipo,
      plano: plano ?? (await planoDePlantilla(caso)),
      piezasDelPack: caso.pack.piezas,
      medidas: caso.medidas,
      fuera: caso.fuera,
      fotos: caso.fotos,
    },
    entorno,
  );
}
