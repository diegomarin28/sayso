/** Contraste de color según WCAG 2.x (razón de luminancias relativas). Sin DOM: se prueba en Node. */

type Rgb = [number, number, number];

export function aRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function luminancia([r, g, b]: Rgb): number {
  const canal = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Razón de contraste entre dos colores (1 a 21). */
export function contraste(a: string, b: string): number {
  const [la, lb] = [luminancia(aRgb(a)), luminancia(aRgb(b))];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** El color `frente` con `alfa` (0 a 1) sobre `fondo`, como queda a la vista. */
export function mezclar(frente: string, fondo: string, alfa: number): string {
  const [f, g] = [aRgb(frente), aRgb(fondo)];
  return "#" + f.map((c, i) => Math.round(c * alfa + g[i] * (1 - alfa)).toString(16).padStart(2, "0")).join("");
}
