import type { ReactNode } from "react";

/**
 * Íconos de la guía en SVG (no emojis: se ven igual en todos los celulares y toman el color
 * del texto). Mismo trazo que los de las pantallas (`app/(screens)/_ui/experto.tsx`).
 */

type PropsIcono = { size?: number; className?: string };

function Icono({ size = 22, className, grosor = 2, children }: PropsIcono & { grosor?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

export function Microfono(p: PropsIcono) {
  return (
    <Icono {...p}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </Icono>
  );
}

export function Engranaje(p: PropsIcono) {
  return (
    <Icono {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Icono>
  );
}

export function Cerrar(p: PropsIcono) {
  return (
    <Icono {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icono>
  );
}

/** Celular que gira (para el aviso de horizontal). */
export function GirarCelular(p: PropsIcono) {
  return (
    <Icono {...p}>
      <rect x="7" y="2" width="10" height="16" rx="2" />
      <path d="M11 15h2" />
      <path d="M3 13a9 9 0 0 0 8 8l-2-2M21 11a9 9 0 0 0-8-8l2 2" />
    </Icono>
  );
}

export function FlechaEnviar(p: PropsIcono) {
  return (
    <Icono grosor={2.5} {...p}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </Icono>
  );
}
