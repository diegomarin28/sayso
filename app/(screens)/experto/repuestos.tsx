"use client";

import { useState } from "react";
import { OpcionesCompra, type FuenteCompras } from "@/components/compras";
import type { Evento, Ficha, KnowledgePack } from "@/shared";
import { USAR_FIXTURE } from "../_datos/api";

/**
 * Pantalla 6 — repuestos. Botón que abre un panel con los repuestos del manual (solo los que
 * tienen número de parte citado) y, para cada uno, dónde comprarlo (<OpcionesCompra>, Diego).
 * Buscar se hace al tocar: cada búsqueda cuesta. Nunca se compra ni se paga por la persona.
 */

/** En modo fixture no se busca de verdad (gastaría IA y búsquedas web). */
const fuenteApagada: FuenteCompras = async () => {
  throw new Error("Modo de prueba: la búsqueda de repuestos está apagada.");
};

export function Repuestos({
  pack,
  ficha,
  casoId,
  onEvento,
}: {
  pack: KnowledgePack;
  ficha: Ficha;
  casoId: string;
  onEvento: (e: Evento) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const modelo = ficha.modelo.valor;
  if (pack.repuestos.length === 0 || !modelo) return null;

  const nombre = (id: string) => pack.piezas.find((p) => p.id === id)?.nombre ?? id;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-borde bg-superficie px-4 text-sm font-medium text-texto transition hover:border-texto-suave active:scale-95"
      >
        Repuestos{" "}
        <span className="rounded-full bg-acento px-1.5 text-xs font-semibold text-black">
          {pack.repuestos.length}
        </span>
      </button>

      {/* Se oculta en vez de desmontarse: así no se pierden (ni se vuelven a pagar) las búsquedas. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Repuestos"
        aria-hidden={!abierto}
        className={`fixed inset-0 z-50 items-end justify-center bg-black/70 ${abierto ? "flex" : "hidden"}`}
        onClick={() => setAbierto(false)}
      >
        <div
          className="aparece flex max-h-[85dvh] w-full max-w-xl flex-col gap-6 overflow-y-auto rounded-t-3xl border border-borde bg-fondo px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-texto-suave">
              Repuestos de tu {[ficha.marca.valor, modelo].filter(Boolean).join(" ")}, según el manual
            </p>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="h-10 shrink-0 rounded-full border border-borde px-4 text-sm"
            >
              Cerrar
            </button>
          </div>
          {pack.repuestos.map((r) => (
            <div key={r.pieza} className="flex flex-col gap-3 border-t border-borde pt-5">
              <div>
                <p className="text-lg font-semibold">{nombre(r.pieza)}</p>
                <p className="font-mono text-xs text-texto-suave">
                  N.º de parte {r.numeroParte}
                  {r.cita.pagina ? ` · pág. ${r.cita.pagina} del manual` : ""}
                </p>
              </div>
              <OpcionesCompra
                key={r.pieza}
                casoId={casoId}
                pieza={r.pieza}
                numeroParte={r.numeroParte}
                modelo={modelo}
                marca={ficha.marca.valor}
                onEvento={onEvento}
                fuente={USAR_FIXTURE ? fuenteApagada : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
