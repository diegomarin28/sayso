import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { KnowledgePack } from "../../shared";

/**
 * Un caso del benchmark 3D: UN equipo de referencia por TIPO (casos/<tipo>.json). El código no conoce ningún
 * equipo: solo lee estos archivos, que son datos de prueba (como los `manuales/` de evaluacion/).
 *   pack    → knowledge pack de prueba (las piezas que nombraría una guía de ese tipo)
 *   medidas → medidas reales del equipo de referencia, en ejes del plano, con su fuente (si hay una confiable)
 *   fotos   → fotos públicas anotadas a ojo. La imagen NO se sube (copyright): queda en fotos/, ignorada por git;
 *             el puntaje solo usa la anotación, así que corre igual sin las imágenes.
 */

const Punto = z.tuple([z.number(), z.number()]);
/** Eje del plano (x a la derecha, y arriba, z hacia el frente) con su sentido. */
export const EjePlano = z.enum(["+x", "-x", "+y", "-y", "+z", "-z"]);
export type EjePlano = z.infer<typeof EjePlano>;

export const FotoReferencia = z.object({
  /** Nombre del archivo en fotos/ (no se sube). */
  archivo: z.string().regex(/^[\w.-]+$/),
  /** De dónde se bajó la imagen. */
  url: z.url(),
  /** Página con el autor y la licencia. */
  pagina: z.url(),
  licencia: z.string(),
  /** Qué muestra, ej. "frente, puerta cerrada" o "por atrás, sin la tapa trasera". */
  descripcion: z.string(),
  /** Qué eje del plano va hacia la derecha y cuál hacia abajo en la foto. */
  derecha: EjePlano,
  abajo: EjePlano,
  /** Pieza del plano cuyo contorno se marcó con `esquinas` (la carcasa, el marco…), o "todo": el equipo entero. */
  marco: z.string(),
  /** Contorno de `marco` en la foto, en píxeles: arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda. */
  esquinas: z.object({ ai: Punto, ad: Punto, bd: Punto, bi: Punto }),
  /** Centro de cada pieza que se ve en la foto, en píxeles (ids del pack o de la plantilla del tipo). */
  piezas: z.record(z.string(), Punto),
  nota: z.string().optional(),
});
export type FotoReferencia = z.infer<typeof FotoReferencia>;

export const MedidasReferencia = z.object({
  /** Medidas del equipo cerrado en ejes del plano (cm): x ancho, y alto, z profundidad. */
  x: z.number().positive(),
  y: z.number().positive(),
  z: z.number().positive(),
  fuente: z.url(),
  nota: z.string().optional(),
});
export type MedidasReferencia = z.infer<typeof MedidasReferencia>;

export const CasoBenchmark = z.object({
  /** Nombre corto del tipo (= nombre del archivo). */
  tipo: z.string().regex(/^[a-z_]+$/),
  /** Cómo lo dice la recepción (texto libre): elige la plantilla y las variantes, como en la app. */
  tipoEquipo: z.string(),
  /** El equipo de referencia, solo para leer el informe. */
  equipo: z.string(),
  pack: KnowledgePack,
  /**
   * Piezas que no son del cuerpo del equipo (ids o prefijos, ej. "correa" o el pie de un TV): no entran en las
   * medidas, en los choques ni en el marco "todo" (la caja de una correa atraviesa la del reloj, la forma no).
   */
  fuera: z.array(z.string()).default([]),
  /** Sin una ficha confiable, sin medidas: la forma y la escala no se puntúan (mejor que inventarlas). */
  medidas: MedidasReferencia.optional(),
  fotos: z.array(FotoReferencia).default([]),
  nota: z.string().optional(),
});
export type CasoBenchmark = z.infer<typeof CasoBenchmark>;

export const CARPETA_CASOS = path.join("scripts", "benchmark3d", "casos");
export const CARPETA_FOTOS = path.join("scripts", "benchmark3d", "fotos");

export function cargarCasos(carpeta = CARPETA_CASOS): CasoBenchmark[] {
  return readdirSync(carpeta)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const caso = CasoBenchmark.parse(JSON.parse(readFileSync(path.join(carpeta, f), "utf8")));
      if (`${caso.tipo}.json` !== f) throw new Error(`${f}: el tipo es "${caso.tipo}"`);
      return caso;
    });
}
