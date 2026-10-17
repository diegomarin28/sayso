import { LIMITES, type EnviarMensaje } from "../ia/claude";
import { leerManual, type ManualSubido } from "./lector";
import { lineasConCitas, parsearContenido, type ClaseVista, type Vistas } from "./lineas";

/**
 * Bibliotecario: las dos páginas del manual que usa el cartógrafo (/api/plano) para ubicar
 * las piezas. Se piden dentro de la lectura del pack (sin llamada extra); si falta alguna,
 * se buscan solas reusando el manual de la caché de prompts. Se guardan en la caché de manuales.
 */

export const SIN_VISTAS: Vistas = { explosionada: null, interior: null };

/** Qué es cada vista. Lo usan la lectura del pack y la búsqueda dedicada. */
const CRITERIO: Record<ClaseVista, string> = {
  explosionada:
    "VISTA|explosionada|qué muestra → la vista explosionada GENERAL del equipo: el dibujo con todas las piezas separadas y numeradas (suele estar junto a la lista de piezas). Una sola línea.",
  interior:
    "VISTA|interior|qué muestra → un dibujo o foto del interior COMPLETO con el equipo abierto, donde se vean los bordes de la carcasa y las piezas en su lugar (en una notebook: dada vuelta y sin la tapa inferior, como en los pasos para sacar la batería o el ventilador). No sirve una vista explosionada ni el detalle de una sola pieza. Si hay varias, elegí la que muestre el equipo entero más grande, sin importar el síntoma. Una sola línea.",
};

const REGLAS =
  "En cada línea VISTA citá un texto de ESA MISMA página (el título o el epígrafe del dibujo): así se sabe el número de página. Si el manual no tiene una de esas vistas, no escribas esa línea.";

/** Instrucciones para pedir las vistas que faltan (para sumar a otra tarea o solas). */
export function instruccionesVistas(clases: ClaseVista[]): string {
  return [...clases.map((c) => CRITERIO[c]), REGLAS].join("\n");
}

export function faltantes(v: Vistas): ClaseVista[] {
  return (Object.keys(v) as ClaseVista[]).filter((c) => v[c] === null);
}

/** Mantiene lo que ya había; completa solo lo que falta. */
export function combinar(base: Vistas, extra: Vistas): Vistas {
  return { explosionada: base.explosionada ?? extra.explosionada, interior: base.interior ?? extra.interior };
}

/** Búsqueda dedicada de las vistas que faltan (sale de la caché de prompts si el manual se acaba de leer). */
export async function ubicarVistas(manual: ManualSubido, clases: ClaseVista[], enviar: EnviarMensaje): Promise<Vistas> {
  if (clases.length === 0) return SIN_VISTAS;
  const tarea = `Buscá en el manual adjunto estas páginas y escribí SOLO estas líneas, una por renglón, sin nada más:\n${instruccionesVistas(clases)}`;
  const { bloques } = await leerManual(manual, tarea, LIMITES.lectura.maxTokensVistas, enviar, "bibliotecario: ubicar vistas");
  const { vistas } = parsearContenido(lineasConCitas(bloques), manual.titulo);
  // Solo las que se pidieron.
  return { explosionada: clases.includes("explosionada") ? vistas.explosionada : null, interior: clases.includes("interior") ? vistas.interior : null };
}
