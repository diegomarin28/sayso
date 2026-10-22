/**
 * Accesibilidad del visor 3D (sin three.js, para poder testearla): qué dice la región del 3D, qué se
 * anuncia al resaltar una pieza, qué hace cada tecla con la cámara y cuándo se reduce el movimiento.
 */

/** Descripción de la región del 3D para un lector de pantalla: qué es, de dónde salen las ubicaciones y cómo moverlo. */
export function descripcionVisor(origen: string, piezas: number): string {
  const cuantas = piezas === 1 ? "1 pieza" : `${piezas} piezas`;
  return `Modelo 3D del equipo con ${cuantas}. Ubicaciones: ${origen}. Con el teclado: flechas para girar, más y menos para acercar o alejar, Escape para volver a la vista de la guía.`;
}

/**
 * Lo que se anuncia al cambiar las piezas resaltadas: solo el nombre y de dónde sale la ubicación, sin
 * repetir el texto del paso (que ya se lee en la guía). Sin piezas resaltadas no se anuncia nada.
 */
export function anuncioResaltadas(piezas: { nombre: string; origen: string | null }[]): string {
  if (!piezas.length) return "";
  const lista = piezas.map((p) => (p.origen ? `${p.nombre} (${p.origen})` : p.nombre)).join(", ");
  return `${piezas.length === 1 ? "Pieza resaltada" : "Piezas resaltadas"} en el 3D: ${lista}.`;
}

/** Cuánto gira o se acerca la cámara con cada toque de tecla. */
export const PASO_TECLADO = { giro: Math.PI / 12, acercar: 6 };

export type AccionTeclado =
  | { t: "girar"; horizontal: number; vertical: number }
  | { t: "acercar"; delta: number }
  | { t: "volver" };

/** Qué hace una tecla con la cámara; null si no es de las nuestras (ej. Tab, que debe seguir de largo). */
export function accionDeTecla(tecla: string): AccionTeclado | null {
  const { giro, acercar } = PASO_TECLADO;
  switch (tecla) {
    case "ArrowLeft":
      return { t: "girar", horizontal: -giro, vertical: 0 };
    case "ArrowRight":
      return { t: "girar", horizontal: giro, vertical: 0 };
    case "ArrowUp":
      return { t: "girar", horizontal: 0, vertical: -giro };
    case "ArrowDown":
      return { t: "girar", horizontal: 0, vertical: giro };
    case "+":
    case "=":
      return { t: "acercar", delta: acercar };
    case "-":
    case "_":
      return { t: "acercar", delta: -acercar };
    case "Escape":
      return { t: "volver" };
    default:
      return null;
  }
}

/** Consulta del sistema: la persona pidió menos movimiento. */
export const CONSULTA_MENOS_MOVIMIENTO = "(prefers-reduced-motion: reduce)";

/** Tiempos de las transiciones del 3D: con menos movimiento todo salta al estado final. */
export function conMenosMovimiento<T extends Record<string, number>>(duraciones: T, reducido: boolean): T {
  if (!reducido) return duraciones;
  return Object.fromEntries(Object.keys(duraciones).map((k) => [k, 0])) as T;
}
