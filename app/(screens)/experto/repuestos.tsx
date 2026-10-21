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
  const equipo = [ficha.marca.valor, modelo].filter(Boolean).join(" ");
  /** La que el experto recomienda cambiar va aparte, destacada; el resto en la lista. */
  const recomendada = items.find((r) => r.pieza === piezaACambiar);
  const otras = items.filter((r) => r !== recomendada);
  const cerrar = () => {
    setAbierto(false);
    if (piezaACambiar) setAvisoCerrado(piezaACambiar);
  };
  /** El link de "Comprar" lo arma <OpcionesCompra>: se toma del clic, sin tocar ese componente. */
  const alComprar = (pieza: string) => (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
    if (a && /^https?:/.test(a.href)) onCompra?.({ pieza, url: a.href });
  };
  const comunes = (r: (typeof items)[number]) => ({
    casoId,
    pieza: r.pieza,
    // El nombre del pack ("Conector Lightning"): el título y la búsqueda lo usan, no el id (#195).
    nombre: nombre(r.pieza),
    // El nombre y el N.º de parte ya están arriba: no se repiten debajo (#208).
    mostrarPieza: false,
    numeroParte: r.numeroParte,
    modelo,
    marca: ficha.marca.valor,
    onEvento,
    fuente: USAR_FIXTURE ? fuenteApagada : undefined,
  });

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
        onClick={cerrar}
      >
        <div
          className="aparece flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-borde bg-fondo md:max-w-2xl md:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Arriba: de qué equipo son y, una sola vez, cómo se buscan. */}
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-borde px-5 pt-5 pb-4">
            <div className="min-w-0">
              <h2 className="font-titulo text-xl font-semibold">Repuestos</h2>
              <p className="text-sm text-texto-suave">
                Para tu <span className="font-mono text-texto">{equipo}</span>
                {conNumeros ? ", con los números de parte del manual." : ". El manual no trae números de parte: los busco por modelo."}
              </p>
            </div>
            <button type="button" onClick={cerrar} className="h-10 shrink-0 rounded-full border border-borde px-4 text-sm">
              Cerrar
            </button>
          </div>

          <div className="flex min-h-0 flex-col gap-6 overflow-y-auto px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:pb-6">
            {/* La que el experto dijo que hay que cambiar: destacada y con el único botón grande. */}
            {recomendada && (
              <section className="flex flex-col gap-3 rounded-2xl border border-acento/60 bg-acento/10 p-4" onClickCapture={alComprar(recomendada.pieza)}>
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-acento text-black">
                    <Llave />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-widest text-acento uppercase">Te recomendamos cambiar</p>
                    <p className="text-lg font-semibold">{nombre(recomendada.pieza)}</p>
                    {recomendada.numeroParte && (
                      <p className="font-mono text-xs text-texto-suave">
                        N.º de parte {recomendada.numeroParte}
                        {recomendada.pagina ? ` · pág. ${recomendada.pagina} del manual` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <OpcionesCompra key={recomendada.pieza} {...comunes(recomendada)} />
              </section>
            )}

            {/* El resto, en una lista compacta: cada una se busca al tocar "Buscar" (cada búsqueda cuesta). */}
            {otras.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-texto-suave">
                  {recomendada ? "Otras piezas de tu equipo" : "Piezas de tu equipo"}
                </h3>
                <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
                  {otras.map((r) => (
                    // El nombre y "Buscar" en una línea; al buscar, lo que aparece baja a todo el ancho.
                    <li key={r.pieza} className="flex flex-wrap items-center gap-3 px-4 py-3" onClickCapture={alComprar(r.pieza)}>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{nombre(r.pieza)}</p>
                        {r.numeroParte && (
                          <p className="font-mono text-xs text-texto-suave">
                            N.º de parte {r.numeroParte}
                            {r.pagina ? ` · pág. ${r.pagina}` : ""}
                          </p>
                        )}
                      </div>
                      <OpcionesCompra
                        key={r.pieza}
                        {...comunes(r)}
                        boton={{ texto: "Buscar", compacto: true }}
                        // Solo el botón: va a la derecha del nombre. Buscando o con resultados: todo el ancho.
                        className="[&:not(:has(>button:only-child))]:basis-full"
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Las herramientas que nombran los pasos, con qué es cada una y dónde conseguirla (#230). */}
            <Herramientas pasos={pack.pasos} className="border-t border-borde pt-5" />

            <p className="text-xs leading-relaxed text-texto-suave">
              Busco en Mercado Libre y en tiendas que envían a Uruguay. Nunca compramos ni pagamos por vos: el link abre la
              publicación y ahí decidís.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/** Llave de tuercas: "hay que cambiar esta pieza". */
function Llave() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5v3h3l5.8-5.8a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z" />
    </svg>
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
