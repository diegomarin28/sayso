"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type EstadoOrbe = "quieto" | "pensando";

export function Orbe({ estado = "quieto", tam = 44 }: { estado?: EstadoOrbe; tam?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: tam, height: tam }} aria-hidden>
      <div className="orbe-halo absolute -inset-3 rounded-full" />
      <div className="orbe absolute inset-0 rounded-full" data-estado={estado} />
      <div className="absolute inset-[18%] rounded-full bg-fondo/70 backdrop-blur-sm" />
    </div>
  );
}

/** Lo que dice el experto: grande, aparece palabra por palabra. Cambiar `texto` re-anima. */
export function DiceExperto({ texto, className = "" }: { texto: string; className?: string }) {
  return (
    <p
      key={texto}
      aria-live="polite"
      className={`text-[clamp(1.75rem,6.5vw,2.75rem)] leading-[1.1] font-semibold tracking-tight text-balance ${className}`}
    >
      {texto.split(" ").map((p, i) => (
        <span key={i} className="palabra" style={{ animationDelay: `${i * 55}ms` }}>
          {p}&nbsp;
        </span>
      ))}
    </p>
  );
}

const PASOS = ["Problema", "Fotos", "Ficha", "Preparando", "Experto", "Charla"];

/**
 * Encabezado común: botón "Atrás" + orbe + progreso del recorrido (1–6).
 * El lugar del botón está siempre reservado (invisible sin `alVolver`) para que el orbe
 * no salte entre pantallas. `volverApagado` lo muestra deshabilitado (ej. revisando una foto).
 */
export function Encabezado({
  paso,
  orbe = "quieto",
  alVolver,
  volverApagado = false,
}: {
  paso: number;
  orbe?: EstadoOrbe;
  alVolver?: () => void;
  volverApagado?: boolean;
}) {
  return (
    <header className="flex items-center gap-4">
      <button
        onClick={alVolver}
        disabled={!alVolver || volverApagado}
        aria-hidden={!alVolver}
        tabIndex={alVolver ? undefined : -1}
        className={`flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-borde bg-superficie pr-4 pl-3 text-sm font-medium text-texto transition hover:border-texto-suave active:scale-95 disabled:opacity-30 ${
          alVolver ? "" : "invisible"
        }`}
      >
        <FlechaAtras />
        Atrás
      </button>
      <Link href="/" aria-label="Volver al inicio">
        <Orbe estado={orbe} />
      </Link>
      <div className="flex-1">
        <div className="flex gap-1.5" aria-hidden>
          {PASOS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                i < paso ? "bg-acento" : "bg-borde"
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs font-medium tracking-widest text-texto-suave uppercase">
          {paso}/6 · {PASOS[paso - 1]}
        </p>
      </div>
    </header>
  );
}

export function Pantalla({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-8 px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {children}
    </main>
  );
}

/** Botón principal, pensado para el pulgar: ancho completo y abajo. */
export function BotonPrincipal({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-acento text-lg font-semibold text-black transition active:scale-[0.98] disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export function BotonSecundario({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-borde text-lg font-medium text-texto transition active:scale-[0.98] disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export function Flecha() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function FlechaAtras() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function Microfono({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

export function Check({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function Camara({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
