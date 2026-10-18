"use client";

/**
 * Marca de Sayso: un celular en vista explosionada (como en un manual), separado en sus capas:
 * la pantalla, la placa y la tapa con la cámara. Un solo color (--marca, en globals.css).
 * Mientras el experto piensa, las capas se separan un poco más.
 */

export type EstadoMarca = "quieto" | "pensando";

export const NOMBRE_PRODUCTO = "Sayso";
export const LEMA = "Contale qué se rompió con tu voz. Te guío con el manual de tu equipo, en 3D.";

type P = [number, number];

/** Ejes isométricos: a lo ancho del celular y a lo largo. */
const U: P = [0.866, 0.5];
const V: P = [-0.866, 0.5];

/** Un punto de la capa: (a, b) en el plano del celular, centrado en c. */
const en = (c: P, a: number, b: number): P => [c[0] + U[0] * a + V[0] * b, c[1] + U[1] * a + V[1] * b];

/** Rectángulo del plano del celular (ancho x largo, desplazado a, b) como polígono isométrico. */
function rect(c: P, ancho: number, largo: number, a = 0, b = 0): string {
  const w = ancho / 2;
  const l = largo / 2;
  return [en(c, a - w, b - l), en(c, a + w, b - l), en(c, a + w, b + l), en(c, a - w, b + l)]
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
}

/** El canto de la capa (grosor), debajo de los dos bordes de adelante. */
function canto(c: P, ancho: number, largo: number, grosor: number): string {
  const w = ancho / 2;
  const l = largo / 2;
  const [izq, frente, der] = [en(c, -w, l), en(c, w, l), en(c, w, -l)];
  const p = [izq, frente, der, [der[0], der[1] + grosor], [frente[0], frente[1] + grosor], [izq[0], izq[1] + grosor]];
  return p.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

const ANCHO = 16;
const LARGO = 30;
const PANTALLA: P = [32, 19];
const PLACA: P = [32, 32];
const TAPA: P = [32, 45];

export function Simbolo({ estado = "quieto", tam = 44 }: { estado?: EstadoMarca; tam?: number }) {
  const capa = {
    stroke: "var(--marca)",
    strokeWidth: 2,
    strokeLinejoin: "round" as const,
    fill: "var(--superficie)",
  };
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 64 64"
      fill="none"
      className="marca shrink-0"
      data-estado={estado}
      aria-hidden
    >
      {/* tapa, con la cámara */}
      <g className="marca-capa-abajo">
        <polygon points={canto(TAPA, ANCHO, LARGO, 2)} fill="var(--marca)" fillOpacity="0.45" />
        <polygon points={rect(TAPA, ANCHO, LARGO)} {...capa} />
        <polygon points={rect(TAPA, 5, 5, 3, -9)} stroke="var(--marca)" strokeWidth="1.6" strokeLinejoin="round" />
      </g>
      {/* placa */}
      <g className="marca-capa-medio">
        <polygon points={canto(PLACA, ANCHO - 2, LARGO - 2, 1.5)} fill="var(--marca)" fillOpacity="0.45" />
        <polygon points={rect(PLACA, ANCHO - 2, LARGO - 2)} {...capa} />
        <polygon points={rect(PLACA, 5, 6, -1.5, -4)} fill="var(--marca)" />
      </g>
      {/* pantalla, con la isla de la cámara */}
      <g className="marca-capa-arriba">
        <polygon points={canto(PANTALLA, ANCHO, LARGO, 2)} fill="var(--marca)" fillOpacity="0.45" />
        <polygon points={rect(PANTALLA, ANCHO, LARGO)} {...capa} />
        <polygon points={rect(PANTALLA, 5, 1.8, 0, -11)} fill="var(--marca)" />
      </g>
    </svg>
  );
}

/** Nombre, con o sin símbolo (sin símbolo cuando ya está en el encabezado de la misma pantalla). */
export function Marca({ tam = 40, conSimbolo = true }: { tam?: number; conSimbolo?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {conSimbolo && <Simbolo tam={tam} />}
      <span className="font-titulo leading-none font-bold tracking-tight" style={{ fontSize: tam * 0.8 }}>
        {NOMBRE_PRODUCTO}
      </span>
    </span>
  );
}
