"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Simbolo, type EstadoMarca } from "./marca";

export type EstadoOrbe = EstadoMarca;

/** El "experto": el símbolo de Sayso (el celular en capas, que se separan cuando piensa). */
export function Orbe({ estado = "quieto", tam = 44 }: { estado?: EstadoOrbe; tam?: number }) {
  return <Simbolo estado={estado} tam={tam} />;
}

/** Lo que dice el experto: grande, aparece palabra por palabra. Cambiar `texto` re-anima. */
export function DiceExperto({ texto, className = "" }: { texto: string; className?: string }) {
  return (
    <p
      key={texto}
      aria-live="polite"
      className={`font-titulo text-[clamp(1.5rem,5.5vw,2.125rem)] leading-[1.15] font-semibold tracking-tight text-balance ${className}`}
    >
      {texto.split(" ").map((p, i) => (
        // El espacio va afuera de la palabra animada: adentro, Safari dibuja restos entre palabras.
        <Fragment key={i}>
          <span className="palabra" style={{ animationDelay: `${i * 55}ms` }}>
            {p}
          </span>{" "}
        </Fragment>
      ))}
    </p>
  );
}

const PASOS = ["Problema", "Fotos", "Ficha", "Preparando", "Experto", "Cierre"];

/**
 * Encabezado común, igual en todas las pantallas: a la izquierda "Atrás" (o el símbolo, donde no
 * se puede volver), en el medio el progreso del recorrido (1–6) y a la derecha un lugar fijo para
 * una acción (sesión, repuestos). El lugar de la derecha ocupa lo mismo aunque esté vacío: así la
 * barra mide igual en todas las pantallas. `volverApagado` deja "Atrás" a la vista pero
 * deshabilitado (ej. mientras se revisa una foto) para que no aparezca y desaparezca.
 */
export function Encabezado({
  paso,
  orbe = "quieto",
  alVolver,
  volverApagado = false,
  accion,
}: {
  paso: number;
  orbe?: EstadoOrbe;
  alVolver?: () => void;
  volverApagado?: boolean;
  /** Arriba a la derecha, en un lugar de 44 px (en el inicio, la sesión; en el experto, repuestos). */
  accion?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-3">
      {alVolver ? (
        <button
          type="button"
          onClick={alVolver}
          disabled={volverApagado}
          aria-label="Atrás"
          className="-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-texto-suave transition hover:text-texto active:scale-95 disabled:opacity-30"
        >
          <FlechaAtras size={22} />
        </button>
      ) : (
        <Link
          href="/"
          aria-label="Sayso: volver al inicio"
          className="-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center"
        >
          <Orbe estado={orbe} tam={32} />
        </Link>
      )}
      {/* min-w-0: el progreso se achica en vez de empujar la acción de la derecha. */}
      <div className="min-w-0 flex-1">
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
        <p className="mt-1.5 truncate text-xs font-medium tracking-wide text-texto-suave">
          {paso}/6 · {PASOS[paso - 1]}
        </p>
      </div>
      <div className="flex h-11 min-w-11 shrink-0 items-center justify-end">{accion}</div>
    </header>
  );
}

export function Pantalla({ children }: { children: ReactNode }) {
  return (
    // Celular: columna de ancho completo. Tablet y compu: más aire y un poco más ancha, centrada.
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-8 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 md:max-w-2xl md:gap-10 md:px-8 md:pt-[max(2.5rem,env(safe-area-inset-top))] lg:max-w-3xl">
      {children}
    </main>
  );
}

/**
 * Franja de acciones pegada abajo: el botón principal se ve siempre, sin hacer scroll y sin
 * quedar tapado por la barra de Safari ni el borde del iPhone (safe-area). Va al final de <Pantalla>.
 */
export function BarraAccion({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 mt-auto -mb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-3 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {/* El fundido ocupa todo el ancho de la pantalla: no se ve como un recuadro de otro color. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 bg-gradient-to-t from-fondo/95 via-fondo/70 to-transparent"
      />
      {children}
    </div>
  );
}

/** Botón principal, pensado para el pulgar: ancho completo y abajo. */
export function BotonPrincipal({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-acento text-lg font-semibold text-black transition active:scale-[0.98] disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export function BotonSecundario({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
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
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function Persona({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function FlechaAtras({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function Microfono({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

/** ■ Terminar de grabar (conserva lo dicho). */
export function Detener({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

/** Descartar lo grabado. */
export function Papelera({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </svg>
  );
}

/** Aviso (triángulo): en lugar del emoji "⚠", con el mismo trazo que el resto de los íconos. */
export function Alerta({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <path d="M12 3.5 2.5 20h19z" />
      <path d="M12 10v4.5M12 17.5v.01" />
    </svg>
  );
}

export function Check({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function Camara({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
