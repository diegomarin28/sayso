"use client";

import { useId } from "react";

/**
 * Marca de Sayso: una burbuja de voz (lo que la persona cuenta hablando) con una pieza en 3D
 * adentro (lo que el experto le muestra). Mientras el experto piensa, la pieza flota.
 * Los colores salen de las variables de globals.css (--dato, --nebulosa, --acento).
 */

export type EstadoMarca = "quieto" | "pensando";

export const NOMBRE_PRODUCTO = "Sayso";
export const LEMA = "Contale qué se rompió con tu voz. Te guío con el manual de tu equipo, en 3D.";

/** El símbolo solo (para el encabezado, el ícono de la app y las cargas). */
export function Simbolo({ estado = "quieto", tam = 44 }: { estado?: EstadoMarca; tam?: number }) {
  // Un id por instancia: si hay dos símbolos en pantalla, cada degradé es el suyo.
  const degrade = `sayso-${useId().replace(/:/g, "")}`;
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
      {/* burbuja de voz */}
      <path
        d="M14 8h36a8 8 0 0 1 8 8v24a8 8 0 0 1-8 8H30l-11 9v-9h-5a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8z"
        stroke={`url(#${degrade})`}
        strokeWidth="3.4"
        strokeLinejoin="round"
        fill="var(--superficie)"
        fillOpacity="0.85"
      />
      {/* pieza en 3D (cubo isométrico) */}
      <g className="marca-pieza">
        <path
          d="M32 15 43 21v12l-11 6-11-6V21zM21 21l11 6 11-6M32 27v12"
          stroke="var(--acento)"
          strokeWidth="2.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
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
