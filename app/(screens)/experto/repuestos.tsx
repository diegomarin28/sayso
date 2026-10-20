"use client";

import { useEffect, useState } from "react";
import { Herramientas, OpcionesCompra, type FuenteCompras } from "@/components/compras";
import type { Evento, Ficha, KnowledgePack } from "@/shared";
import { USAR_FIXTURE } from "../_datos/api";
import { piezasParaComprar } from "./piezas-compra";

/**
 * Pantalla 6 — repuestos. Ícono de carrito en el encabezado ("Ver dónde comprar repuestos (n)") con las piezas que se pueden comprar
 * (`piezasParaComprar`): las que tienen número de parte citado en el manual o, si el manual no los
 * trae, las de la guía para buscar por modelo. Cuando el experto dice que una pieza hay que
 * cambiarla (`piezaACambiar`, de onCambiarPieza de <GuiaExperto>), el carrito se resalta y un aviso
 * ("Hay que cambiar: X") abre el panel con esa pieza primero. Va encima de los íconos del 3D (#207: antes
 * tapaba «Vista isométrica»), se cierra solo a los `AVISO_MS` y el carrito sigue resaltado. Para cada una, dónde comprarla (<OpcionesCompra>, Diego). Buscar se hace al tocar:
 * cada búsqueda cuesta. Nunca se compra ni se paga por la persona.
 */

/** Cuánto queda a la vista el aviso "Hay que cambiar" (después queda el carrito resaltado). */
const AVISO_MS = 8000;

/** En modo fixture no se busca de verdad (gastaría IA y búsquedas web). */
const fuenteApagada: FuenteCompras = async () => {
  throw new Error("Modo de prueba: la búsqueda de repuestos está apagada.");
};

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
  // El globito se cierra solo; el carrito queda resaltado mientras haya una pieza a cambiar.
  useEffect(() => {
    if (!piezaACambiar) return;
    const t = setTimeout(() => setAvisoCerrado(piezaACambiar), AVISO_MS);
    return () => clearTimeout(t);
  }, [piezaACambiar]);
  const modelo = ficha.modelo.valor;

  // Siempre hay un camino para comprar: si el manual no trae números de parte, se ofrecen las piezas
  // de la guía para buscar por modelo (#107). La que el experto pide cambiar va primera.
  const items = piezasParaComprar(pack, piezaACambiar);
  const conNumeros = pack.repuestos.length > 0;
  if (items.length === 0 || !modelo) return null;

  const nombre = (id: string) => pack.piezas.find((p) => p.id === id)?.nombre ?? id;
  const avisar = piezaACambiar && avisoCerrado !== piezaACambiar && !abierto;

  return (
    <>
      {/* Ícono de carrito en el encabezado, con el número en una insignia (#199). Con una pieza a cambiar, se
          resalta y el aviso sale arriba de los íconos del 3D (#207): no tapa ningún botón y se cierra solo. */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label={
            piezaACambiar
              ? `Hay que cambiar: ${nombre(piezaACambiar)}. Ver dónde comprar repuestos (${items.length})`
              : `Ver dónde comprar repuestos (${items.length})`
          }
          title="Ver dónde comprar repuestos"
          className={`relative flex h-11 w-11 items-center justify-center rounded-full border bg-superficie text-texto transition hover:border-acento active:scale-95 ${
            piezaACambiar ? "border-acento ring-2 ring-acento/60" : "border-acento/60"
          }`}
        >
          <Carrito />
          <span
            aria-hidden
            className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-acento px-1 text-[11px] font-bold text-black"
          >
            {piezaACambiar ? "!" : items.length}
          </span>
        </button>

        {avisar && (
          <div
            role="status"
            // Abajo, encima de la fila de íconos del 3D (opciones, charla, «¿de dónde sale?») y del campo de
            // pregunta: no tapa ningún botón ni la tarjeta del paso (antes, en bottom-24, tapaba «Vista isométrica»).
            className="aparece fixed inset-x-0 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex w-[calc(100%-2rem)] max-w-xl items-center gap-1 rounded-2xl border border-acento/60 bg-fondo/95 p-1 pl-4 shadow-2xl backdrop-blur"
          >
            <button type="button" onClick={() => setAbierto(true)} className="min-h-11 min-w-0 flex-1 text-left text-sm leading-tight">
              Hay que cambiar: <span className="font-semibold">{nombre(piezaACambiar)}</span>
              <span className="block text-xs font-medium text-acento">Ver dónde comprar esta pieza</span>
            </button>
            <button
              type="button"
              onClick={() => setAvisoCerrado(piezaACambiar)}
              aria-label="Cerrar aviso"
              className="flex h-11 w-11 shrink-0 items-center justify-center text-texto-suave"
            >
              ✕
            </button>
          </div>
        )}
      </div>

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
              {conNumeros
                ? `Repuestos de tu ${[ficha.marca.valor, modelo].filter(Boolean).join(" ")}, según el manual`
                : `El manual no trae números de parte: buscá las piezas de tu ${[ficha.marca.valor, modelo].filter(Boolean).join(" ")} por modelo`}
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
          <p className="-mt-2 text-sm text-texto-suave">
            En cada pieza, tocá «Ver dónde comprar esta pieza» y te muestro dónde comprarla con envío a
            Uruguay. Nunca compramos ni pagamos por vos: el link abre la publicación.
          </p>
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
                // El nombre del pack ("Conector Lightning"): el título y la búsqueda lo usan, no el id (#195).
                nombre={nombre(r.pieza)}
                // El nombre y el N.º de parte ya están arriba: no se repiten debajo del título (#208).
                mostrarPieza={false}
                numeroParte={r.numeroParte}
                modelo={modelo}
                marca={ficha.marca.valor}
                onEvento={onEvento}
                fuente={USAR_FIXTURE ? fuenteApagada : undefined}
              />
            </div>
          ))}
          {/* Las herramientas que nombran los pasos, con qué es cada una y dónde conseguirla (#230). */}
          <Herramientas pasos={pack.pasos} className="border-t border-borde pt-5" />
        </div>
      </div>
    </>
  );
}

export function Carrito() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 4h2l2.4 11h10.2L20 8H6.2" />
      <circle cx="9" cy="19.5" r="1.5" />
      <circle cx="17" cy="19.5" r="1.5" />
    </svg>
  );
}
