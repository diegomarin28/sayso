/**
 * Colores del visor desde las variables CSS de la app (`app/globals.css`, la única fuente de colores).
 * Lo que es HTML usa la variable directo (el fondo es `var(--escena)` detrás del lienzo transparente);
 * three no lee CSS, así que el resaltado de las piezas se lee una vez al montar el visor.
 */

/** Resaltado: cian de datos (estilo Sayso) si la app lo define; si no, el acento. */
export const CSS_ACTIVO = "var(--dato, var(--acento))";

/** Si no hay documento (SSR, tests) o la app no define las variables: el naranja de antes. */
export const ACTIVO_RESPALDO = "#E8590C";

/** `leer("--dato")` devuelve el valor de la variable, o "" si no está definida. */
export function colorActivoDesde(leer: (variable: string) => string): string {
  return leer("--dato").trim() || leer("--acento").trim() || ACTIVO_RESPALDO;
}

export function colorActivoDelDocumento(): string {
  if (typeof document === "undefined") return ACTIVO_RESPALDO;
  const estilo = getComputedStyle(document.documentElement);
  return colorActivoDesde((v) => estilo.getPropertyValue(v));
}
