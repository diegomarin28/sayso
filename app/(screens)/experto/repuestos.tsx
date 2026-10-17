"use client";

import { useState } from "react";
import { OpcionesCompra, type FuenteCompras } from "@/components/compras";
import type { Evento, Ficha, KnowledgePack } from "@/shared";
import { USAR_FIXTURE } from "../_datos/api";

/**
 * Pantalla 6 — repuestos. Botón "Repuestos" con los del manual (los que tienen número de parte
 * citado) y, cuando el experto dice que una pieza hay que cambiarla (`piezaACambiar`, de
 * onCambiarPieza de <GuiaExperto>), un aviso que abre el panel con esa pieza primero.
 * Para cada una, dónde comprarla (<OpcionesCompra>, Diego). Buscar se hace al tocar: cada
 * búsqueda cuesta. Nunca se compra ni se paga por la persona.
 */

/** En modo fixture no se busca de verdad (gastaría IA y búsquedas web). */
const fuenteApagada: FuenteCompras = async () => {
  throw new Error("Modo de prueba: la búsqueda de repuestos está apagada.");
};

type Item = { pieza: string; numeroParte: string | null; pagina?: number };

export function Repuestos({
  pack,
  ficha,
  casoId,
  onEvento,
  piezaACambiar,
  onCompra,
}: {
  pack: KnowledgePack;
  ficha: Ficha;
  casoId: string;
  onEvento: (e: Evento) => void;
  /** La pieza que el experto dijo que hay que cambiar (puede no tener número de parte). */
  piezaACambiar?: string | null;
  /** Se llama cuando la persona abre una publicación para comprar (para el cierre "Pedí el repuesto"). */
  onCompra?: (c: { pieza: string; url: string }) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  /** El aviso se cierra por pieza: si el experto pide cambiar otra, vuelve a aparecer. */
  const [avisoCerrado, setAvisoCerrado] = useState<string | null>(null);
  const modelo = ficha.modelo.valor;

  const items: Item[] = pack.repuestos.map((r) => ({
    pieza: r.pieza,
    numeroParte: r.numeroParte,
    pagina: r.cita.pagina,
  }));
  // La pieza a cambiar va primero; si el manual no le da número de parte, se busca por modelo.
  if (piezaACambiar) {
    const i = items.findIndex((r) => r.pieza === piezaACambiar);
    const [elegida] = i >= 0 ? items.splice(i, 1) : [{ pieza: piezaACambiar, numeroParte: null }];
    items.unshift(elegida);
  }
  if (items.length === 0 || !modelo) return null;

  const nombre = (id: string) => pack.piezas.find((p) => p.id === id)?.nombre ?? id;
  const avisar = piezaACambiar && avisoCerrado !== piezaACambiar && !abierto;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-borde bg-superficie px-4 text-sm font-medium text-texto transition hover:border-texto-suave active:scale-95"
      >
        <span className="max-[400px]:sr-only">Repuestos</span>
        <span className="rounded-full bg-acento px-1.5 text-xs font-semibold text-black">{items.length}</span>
      </button>

      {/* Aviso (no tapa el 3D mientras el experto explica): abre el panel con esa pieza primero. */}
      {avisar && (
        <div className="aparece fixed inset-x-0 bottom-24 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-xl items-center gap-3 rounded-2xl border border-acento/60 bg-fondo/95 p-3 pl-4 shadow-2xl">
          <p className="min-w-0 flex-1 text-sm">
            Hay que cambiar <span className="font-semibold">{nombre(piezaACambiar).toLowerCase()}</span>
          </p>
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="h-10 shrink-0 rounded-xl bg-acento px-3 text-sm font-semibold text-black active:scale-95"
          >
            Dónde comprarlo
          </button>
          <button
            type="button"
            onClick={() => setAvisoCerrado(piezaACambiar)}
            aria-label="Cerrar aviso"
            className="h-10 w-8 shrink-0 text-texto-suave"
          >
            ✕
          </button>
        </div>
      )}

      {/* Se oculta en vez de desmontarse: así no se pierden (ni se vuelven a pagar) las búsquedas. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Repuestos"
        aria-hidden={!abierto}
        className={`fixed inset-0 z-50 items-end justify-center bg-black/60 md:items-center md:p-6 ${abierto ? "flex" : "hidden"}`}
        onClick={() => setAbierto(false)}
      >
        <div
          className="aparece flex max-h-[85dvh] w-full max-w-xl flex-col gap-6 overflow-y-auto rounded-t-3xl border border-borde bg-fondo px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:max-w-2xl md:rounded-3xl md:pb-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-texto-suave">
              Repuestos de tu {[ficha.marca.valor, modelo].filter(Boolean).join(" ")}, según el manual
            </p>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                if (piezaACambiar) setAvisoCerrado(piezaACambiar);
              }}
              className="h-10 shrink-0 rounded-full border border-borde px-4 text-sm"
            >
              Cerrar
            </button>
          </div>
          {items.map((r) => (
            <div
              key={r.pieza}
              className="flex flex-col gap-3 border-t border-borde pt-5"
              // El link de "Comprar" lo arma <OpcionesCompra>: se toma del clic, sin tocar ese componente.
              onClickCapture={(e) => {
                const a = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
                if (a && /^https?:/.test(a.href)) onCompra?.({ pieza: r.pieza, url: a.href });
              }}
            >
              <div>
                {r.pieza === piezaACambiar && (
                  <p className="mb-1 text-xs font-semibold tracking-widest text-acento uppercase">
                    El experto recomienda cambiarla
                  </p>
                )}
                <p className="text-lg font-semibold">{nombre(r.pieza)}</p>
                <p className="font-mono text-xs text-texto-suave">
                  {r.numeroParte
                    ? `N.º de parte ${r.numeroParte}${r.pagina ? ` · pág. ${r.pagina} del manual` : ""}`
                    : "Sin número de parte en el manual: se busca por modelo"}
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
