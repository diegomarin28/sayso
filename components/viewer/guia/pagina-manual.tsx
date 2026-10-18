"use client";

import { useEffect, useRef } from "react";
import type { Coreografia } from "../../../shared";
import { Cerrar } from "./iconos";

/**
 * Lo que se puede ver del paso: la página del manual que cita (imagen PNG que da /api/knowledge, con
 * documento y página) o, si cita un paso de una guía con fotos (iFixit), la foto de ese paso.
 */
export type PaginaManual = { url: string; pagina?: number; doc?: string; foto?: boolean };

/**
 * La página que se puede mostrar para un paso: solo si cita una página que tiene imagen, y nunca
 * en un paso bloqueado (ahí se muestra la derivación, no el manual).
 */
export function paginaParaPaso(
  c: Coreografia | undefined,
  imagenPagina: ((pagina: number) => string | null | undefined) | undefined,
): PaginaManual | null {
  const pagina = c?.cita?.pagina;
  if (!c || c.riesgo === "alto" || !pagina || !imagenPagina) return null;
  const url = imagenPagina(pagina);
  return url ? { url, pagina, ...(c.cita?.doc ? { doc: c.cita.doc } : {}) } : null;
}

/** La foto del paso que cita el paso (por la URL de la cita), si la hay; nunca en un paso bloqueado. */
export function fotoParaPaso(c: Coreografia | undefined, fotoDePaso: ((url: string) => string | null | undefined) | undefined): PaginaManual | null {
  const cita = c?.cita?.url;
  if (!c || c.riesgo === "alto" || !cita || !fotoDePaso) return null;
  const url = fotoDePaso(cita);
  return url ? { url, foto: true, ...(c.cita?.doc ? { doc: c.cita.doc } : {}) } : null;
}

/**
 * La página del manual en grande, encima de todo. Se cierra con la X, con Escape o tocando afuera.
 * La imagen se puede recorrer con scroll y hacer zoom con los dedos (la página no bloquea el gesto).
 */
export function VerPaginaManual({ pagina, onCerrar }: { pagina: PaginaManual; onCerrar: () => void }) {
  const cerrar = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cerrar.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar]);

  const titulo = `${pagina.doc ? `${pagina.doc} · ` : ""}${pagina.foto ? "foto del paso" : `página ${pagina.pagina}`}`;
  return (
    <div
      role="dialog"
      aria-modal
      aria-label={pagina.foto ? `Foto: ${titulo}` : `Manual: ${titulo}`}
      className="fixed inset-0 z-50 flex flex-col bg-fondo/95 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <p className="min-w-0 truncate text-sm text-texto-suave">{titulo}</p>
        <button
          ref={cerrar}
          type="button"
          onClick={onCerrar}
          aria-label={pagina.foto ? "Cerrar la foto del paso" : "Cerrar la página del manual"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-borde bg-superficie text-texto active:scale-95"
        >
          <Cerrar size={20} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" style={{ touchAction: "pan-x pan-y pinch-zoom" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- imagen generada al vuelo (URL de /api/knowledge) o de la guía, sin optimizar */}
        <img
          src={pagina.url}
          alt={pagina.foto ? `Foto del paso${pagina.doc ? ` (${pagina.doc})` : ""}` : `Página ${pagina.pagina} del manual`}
          className="mx-auto h-auto w-full max-w-3xl rounded-lg bg-white" /* papel: la página del manual es blanca */
        />
      </div>
    </div>
  );
}
