"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Evento } from "../../shared";
import type { OpcionCompra, PedidoCompra, ResultadoCompras } from "../../lib/compras/esquemas";
import { avisoPrecio, COMPATIBILIDAD, precio, textoEnvio, textoTotal } from "./textos";

/**
 * Pantalla 6 — dónde comprar el repuesto (A6). Autocontenido: llama a /api/compras y muestra
 * las 3 mejores opciones. "Comprar" solo abre la publicación: nunca pagamos por la persona.
 */
export type RespuestaCompras = ResultadoCompras & { eventos: Evento[] };
export type FuenteCompras = (pedido: PedidoCompra, senal: AbortSignal) => Promise<RespuestaCompras>;

export type OpcionesCompraProps = PedidoCompra & {
  /** Por defecto espera el toque en "Buscar repuesto" (cada búsqueda cuesta). */
  buscarAlMontar?: boolean;
  onEvento?: (e: Evento) => void;
  /** Para /lab y tests: de dónde salen las opciones (por defecto, /api/compras). */
  fuente?: FuenteCompras;
  className?: string;
};

export const fuenteApi: FuenteCompras = async (pedido, signal) => {
  const r = await fetch("/api/compras", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(pedido),
    signal,
  });
  const cuerpo = await r.json().catch(() => null);
  if (!r.ok) throw new Error(cuerpo?.error ?? "No pude buscar el repuesto");
  return cuerpo as RespuestaCompras;
};

type Estado = { t: "inicio" } | { t: "buscando" } | { t: "listo"; opciones: OpcionCompra[] } | { t: "error"; mensaje: string };

export function OpcionesCompra({
  buscarAlMontar = false,
  onEvento,
  fuente = fuenteApi,
  className = "",
  ...pedido
}: OpcionesCompraProps) {
  const [estado, setEstado] = useState<Estado>({ t: buscarAlMontar ? "buscando" : "inicio" });
  const control = useRef<AbortController | null>(null);
  const { pieza, numeroParte, modelo, marca, casoId } = pedido;

  const buscar = useCallback(async () => {
    control.current?.abort();
    const c = new AbortController();
    control.current = c;
    setEstado({ t: "buscando" });
    try {
      const r = await fuente({ pieza, numeroParte, modelo, marca, casoId }, c.signal);
      if (c.signal.aborted) return;
      r.eventos.forEach((e) => onEvento?.(e));
      setEstado({ t: "listo", opciones: r.opciones });
    } catch (e) {
      if (c.signal.aborted) return;
      setEstado({ t: "error", mensaje: e instanceof Error ? e.message : "No pude buscar el repuesto" });
    }
  }, [fuente, onEvento, pieza, numeroParte, modelo, marca, casoId]);

  useEffect(() => {
    const t = buscarAlMontar ? setTimeout(() => void buscar(), 0) : undefined;
    return () => {
      clearTimeout(t);
      control.current?.abort();
    };
    // Solo al montar: no repetir la búsqueda por cada render (para otra pieza, montar con otra `key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className={`flex flex-col gap-3 text-texto ${className}`} aria-live="polite">
      <header>
        <h2 className="text-lg font-semibold">Dónde comprar el repuesto</h2>
        <p className="text-sm text-texto-suave">
          {pieza}
          {numeroParte ? ` · N.º de parte ${numeroParte}` : ""}
        </p>
      </header>

      {estado.t === "inicio" && (
        <button
          type="button"
          onClick={() => void buscar()}
          className="h-12 rounded-2xl bg-acento px-4 font-semibold text-black transition active:scale-95"
        >
          Buscar repuesto
        </button>
      )}

      {estado.t === "buscando" && (
        <p className="animate-pulse text-sm text-texto-suave">Buscando en Mercado Libre y en tiendas que envían a Uruguay…</p>
      )}

      {estado.t === "error" && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-peligro/60 bg-peligro/15 p-4">
          <p className="text-sm text-peligro">{estado.mensaje}</p>
          <button type="button" onClick={() => void buscar()} className="shrink-0 text-sm font-semibold text-texto underline">
            Reintentar
          </button>
        </div>
      )}

      {estado.t === "listo" && estado.opciones.length === 0 && (
        <p className="text-sm text-texto-suave">No encontré publicaciones de este repuesto con envío a Uruguay.</p>
      )}

      {estado.t === "listo" && estado.opciones.length > 0 && (
        <>
          <ol className="flex flex-col gap-3">
            {estado.opciones.map((o, i) => (
              <Tarjeta key={o.url} opcion={o} mejor={i === 0} />
            ))}
          </ol>
          <p className="text-xs text-texto-suave">
            &quot;Comprar&quot; abre la publicación en la tienda. Ahí pagás vos: nosotros no cobramos ni pagamos nada.
          </p>
        </>
      )}
    </section>
  );
}

function Tarjeta({ opcion: o, mejor }: { opcion: OpcionCompra; mejor: boolean }) {
  const compat = COMPATIBILIDAD[o.compatibilidad];
  const total = textoTotal(o);
  const aviso = avisoPrecio(o);
  return (
    <li className={`flex flex-col gap-2 rounded-2xl border bg-superficie p-4 ${mejor ? "border-acento" : "border-borde"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium leading-snug">{o.titulo}</p>
          <p className="text-xs text-texto-suave">{o.tienda}</p>
        </div>
        <p className="shrink-0 text-lg font-semibold">{precio(o.precio.monto, o.precio.moneda)}</p>
      </div>
      <p className={`text-xs ${compat.verificado ? "text-confirmado" : "text-probable"}`}>{compat.texto}</p>
      <p className="text-sm text-texto-suave">
        {textoEnvio(o)}
        {total ? ` · ${total}` : ""}
      </p>
      {aviso && <p className="text-xs text-probable">{aviso}</p>}
      <a
        href={o.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 flex h-11 items-center justify-center rounded-xl bg-acento font-semibold text-black transition active:scale-95"
      >
        Comprar
      </a>
    </li>
  );
}
