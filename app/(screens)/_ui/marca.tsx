"use client";

import { useId } from "react";

/**
 * Marca de Sayso: un celular en vista explosionada (como en un manual), separado en sus capas:
 * la pantalla, la placa con sus chips y la tapa con la cámara. Mientras el experto piensa, las
 * capas se separan un poco más. Los colores salen de globals.css (--dato, --nebulosa, --acento).
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

const ANCHO = 14;
const LARGO = 28;
const PANTALLA: P = [32, 12];
const PLACA: P = [32, 31.5];
const TAPA: P = [32, 51];

/** Líneas guía de la vista explosionada: de cada esquina de la tapa a la de la pantalla. */
const GUIAS = (
  [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const
).map(([a, b]) => [en(TAPA, (a * ANCHO) / 2, (b * LARGO) / 2), en(PANTALLA, (a * ANCHO) / 2, (b * LARGO) / 2)]);

export function Simbolo({ estado = "quieto", tam = 44 }: { estado?: EstadoMarca; tam?: number }) {
  // Un id por instancia: si hay dos símbolos en pantalla, cada degradé es el suyo.
  const degrade = `sayso-${useId().replace(/:/g, "")}`;
  const linea = { strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
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
      <defs>
        <linearGradient id={degrade} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--dato)" />
          <stop offset="1" stopColor="var(--nebulosa)" />
        </linearGradient>
      </defs>
      {/* líneas guía, como en el despiece de un manual */}
      <g stroke="var(--dato)" strokeWidth="0.8" strokeDasharray="1.6 2" opacity="0.55">
        {GUIAS.map(([[x1, y1], [x2, y2]], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      {/* tapa trasera, con la cámara */}
      <g className="marca-capa-abajo" {...linea}>
        <polygon points={canto(TAPA, ANCHO, LARGO, 2.2)} fill="var(--nebulosa)" fillOpacity="0.35" />
        <polygon points={rect(TAPA, ANCHO, LARGO)} fill="var(--superficie)" stroke="var(--nebulosa)" strokeWidth="1.8" />
        <polygon points={rect(TAPA, 5, 6, 2.5, -8.5)} stroke="var(--nebulosa)" strokeWidth="1.4" />
      </g>
      {/* placa con chips */}
      <g {...linea}>
        <polygon points={canto(PLACA, ANCHO - 2, LARGO - 2, 1.4)} fill="var(--acento)" fillOpacity="0.35" />
        <polygon points={rect(PLACA, ANCHO - 2, LARGO - 2)} fill="var(--superficie)" stroke="var(--acento)" strokeWidth="1.8" />
        <polygon points={rect(PLACA, 5, 6, -2, -6)} fill="var(--acento)" />
        <polygon points={rect(PLACA, 3.5, 3.5, 2.5, 1)} fill="var(--acento)" fillOpacity="0.7" />
        <polygon points={rect(PLACA, 8, 4, 0, 8)} fill="var(--acento)" fillOpacity="0.45" />
      </g>
      {/* pantalla */}
      <g className="marca-capa-arriba" {...linea}>
        <polygon points={canto(PANTALLA, ANCHO, LARGO, 2.2)} fill={`url(#${degrade})`} fillOpacity="0.5" />
        <polygon points={rect(PANTALLA, ANCHO, LARGO)} fill="var(--superficie)" stroke={`url(#${degrade})`} strokeWidth="2" />
        <polygon points={rect(PANTALLA, ANCHO - 3.5, LARGO - 4.5)} fill={`url(#${degrade})`} fillOpacity="0.35" />
        {/* la isla de la cámara de adelante */}
        <polygon points={rect(PANTALLA, 4.5, 1.6, 0, -10.6)} fill="var(--texto)" />
      </g>
    </svg>
  );
}

/** Nombre, con o sin símbolo (sin símbolo cuando ya está en el encabezado de la misma pantalla). */
export function Marca({ tam = 40, conSimbolo = true }: { tam?: number; conSimbolo?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {conSimbolo && <Simbolo tam={tam} />}
      <span className="leading-none font-extrabold tracking-tight" style={{ fontSize: tam * 0.8 }}>
        {NOMBRE_PRODUCTO}
      </span>
    </span>
  );
}
