"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Evento } from "../../shared";
import type { OpcionCompra, PedidoCompra } from "../../lib/compras/esquemas";
import { buscar as buscarOpciones, fuenteApi, hrefSeguro, type EstadoCompras, type FuenteCompras } from "./fuente";
import { avisoPrecio, COMPATIBILIDAD, enlaceBusqueda, nombrePieza, precio, textoEnvio, textoTotal } from "./textos";

/**
 * Pantalla 6 — dónde comprar el repuesto (A6). Autocontenido: llama a /api/compras y muestra
 * las 3 mejores opciones. "Comprar" solo abre la publicación en otra pestaña: nunca pagamos por la persona.
 * Sin resultados o si falla la búsqueda, un mensaje claro y "Buscar de nuevo": nunca una pantalla rota.
 */
export type { FuenteCompras, RespuestaCompras } from "./fuente";
export { fuenteApi } from "./fuente";

export type OpcionesCompraProps = PedidoCompra & {
  /** Por defecto espera el toque en "Ver dónde comprar esta pieza" (cada búsqueda cuesta). */
  buscarAlMontar?: boolean;
  onEvento?: (e: Evento) => void;
  /** Para /lab y tests: de dónde salen las opciones (por defecto, /api/compras). */
  fuente?: FuenteCompras;
  className?: string;
};

export function OpcionesCompra({
  buscarAlMontar = false,
  onEvento,
  fuente = fuenteApi,
  className = "",
  ...pedido
}: OpcionesCompraProps) {
  const [estado, setEstado] = useState<EstadoCompras>({ t: buscarAlMontar ? "buscando" : "inicio" });
  const control = useRef<AbortController | null>(null);
  const { pieza, nombre, numeroParte, modelo, marca, casoId } = pedido;

  const buscar = useCallback(async () => {
    control.current?.abort();
    const c = new AbortController();
    control.current = c;
    setEstado({ t: "buscando" });
    const r = await buscarOpciones(fuente, { pieza, nombre, numeroParte, modelo, marca, casoId }, c.signal, onEvento);
    if (r) setEstado(r);
  }, [fuente, onEvento, pieza, nombre, numeroParte, modelo, marca, casoId]);

  useEffect(() => {
    const t = buscarAlMontar ? setTimeout(() => void buscar(), 0) : undefined;
    return () => {
      clearTimeout(t);
      control.current?.abort();
    };
    // Solo al montar: no repetir la búsqueda por cada render (para otra pieza, montar con otra `key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <VistaCompras estado={estado} pedido={pedido} onBuscar={() => void buscar()} className={className} />;
}

/** Lo que se ve en cada estado. Sin estado propio: se prueba renderizándola (components/compras/compras.test.tsx). */
export function VistaCompras({
  estado,
  pedido,
  onBuscar,
  className = "",
}: {
  estado: EstadoCompras;
  pedido: Pick<PedidoCompra, "pieza" | "nombre" | "numeroParte" | "modelo" | "marca">;
  onBuscar: () => void;
  className?: string;
}) {
  const nombre = nombrePieza(pedido.pieza, pedido.nombre);
  const equipo = [pedido.marca, pedido.modelo].filter(Boolean).join(" ");
  return (
    <section className={`flex min-w-0 flex-col gap-3 text-texto ${className}`} aria-live="polite" aria-busy={estado.t === "buscando"}>
      <header>
        <h2 className="text-lg font-semibold">Dónde comprar el repuesto</h2>
        <p className="text-sm break-words text-texto-suave">
          {nombre}
          {pedido.numeroParte ? ` · N.º de parte ${pedido.numeroParte}` : ""}
        </p>
      </header>

      {estado.t === "inicio" && <BotonBuscar onClick={onBuscar}>Ver dónde comprar esta pieza</BotonBuscar>}

      {estado.t === "buscando" && (
        <p role="status" className="animate-pulse text-sm text-texto-suave">
          Buscando en Mercado Libre y en tiendas que envían a Uruguay… (puede tardar un minuto)
        </p>
      )}

      {estado.t === "error" && (
        <Aviso tono="peligro" texto={estado.mensaje}>
          <Alternativa pedido={pedido} />
          <BotonBuscar secundario onClick={onBuscar}>Buscar de nuevo</BotonBuscar>
        </Aviso>
      )}

      {estado.t === "listo" && estado.opciones.length === 0 && (
        <Aviso
          tono="neutro"
          texto={
            estado.motivo === "incompleta"
              ? `No llegué a terminar la búsqueda de ${nombre} a tiempo: hay muchas publicaciones para leer.`
              : `No encontré publicaciones de ${nombre} para ${equipo || "tu equipo"} con envío a Uruguay${pedido.numeroParte ? "" : " (el manual no trae número de parte, así que busqué por modelo)"}.`
          }
        >
          <Alternativa pedido={pedido} />
          <BotonBuscar secundario onClick={onBuscar}>Buscar de nuevo</BotonBuscar>
        </Aviso>
      )}

      {estado.t === "listo" && estado.opciones.length > 0 && (
        <>
          <ol className="flex flex-col gap-3">
            {estado.opciones.map((o, i) => (
              <Tarjeta key={o.url} opcion={o} mejor={i === 0} />
            ))}
          </ol>
          <p className="text-xs text-texto-suave">
            &quot;Comprar&quot; abre la publicación en otra pestaña. Ahí pagás vos: nosotros no cobramos ni pagamos nada.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * Lo que la persona puede hacer igual: buscarlo en Mercado Libre (una búsqueda, no un resultado verificado) o
 * pedirlo en un servicio técnico con el número de parte. Nunca compra nada.
 */
function Alternativa({ pedido }: { pedido: Pick<PedidoCompra, "pieza" | "nombre" | "numeroParte" | "modelo" | "marca"> }) {
  const href = hrefSeguro(enlaceBusqueda(pedido));
  return (
    <div className="flex flex-col gap-2 text-sm text-texto-suave">
      <p>
        Mientras tanto podés buscarlo vos en Mercado Libre (no está verificado que sea compatible)
        {pedido.numeroParte ? ` o pedirlo en un servicio técnico con el N.º de parte ${pedido.numeroParte}` : " o consultarlo en un servicio técnico"}.
      </p>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 items-center justify-center rounded-2xl border border-borde px-4 py-2 text-center font-semibold text-texto"
        >
          Buscarlo en Mercado Libre
        </a>
      )}
    </div>
  );
}

function BotonBuscar({ onClick, secundario = false, children }: { onClick: () => void; secundario?: boolean; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 w-full rounded-2xl px-4 py-2 font-semibold leading-tight transition active:scale-95 ${
        secundario ? "border border-borde text-texto" : "bg-acento text-black"
      }`}
    >
      {children}
    </button>
  );
}

function Aviso({ tono, texto, children }: { tono: "peligro" | "neutro"; texto: string; children: React.ReactNode }) {
  return (
    <div
      role={tono === "peligro" ? "alert" : undefined}
      className={`flex flex-col gap-3 rounded-2xl border p-4 ${tono === "peligro" ? "border-peligro/60 bg-peligro/15" : "border-borde bg-superficie"}`}
    >
      <p className={`text-sm ${tono === "peligro" ? "text-peligro" : "text-texto-suave"}`}>{texto}</p>
      {children}
    </div>
  );
}

function Tarjeta({ opcion: o, mejor }: { opcion: OpcionCompra; mejor: boolean }) {
  const compat = COMPATIBILIDAD[o.compatibilidad];
  const total = textoTotal(o);
  const aviso = avisoPrecio(o);
  const href = hrefSeguro(o.url);
  return (
    <li className={`flex min-w-0 flex-col gap-2 rounded-2xl border bg-superficie p-4 ${mejor ? "border-acento" : "border-borde"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            compat.verificado ? "bg-confirmado/15 text-confirmado" : "bg-probable/15 text-probable"
          }`}
        >
          {compat.verificado ? "✓ " : ""}
          {compat.etiqueta}
        </span>
        {mejor && <span className="text-xs font-semibold tracking-widest text-acento uppercase">Mejor opción</span>}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 leading-snug font-medium break-words">{o.titulo}</p>
          <p className="truncate text-xs text-texto-suave">{o.tienda}</p>
        </div>
        <p className="shrink-0 text-lg font-semibold whitespace-nowrap">{precio(o.precio.monto, o.precio.moneda)}</p>
      </div>
      <p className="text-xs text-texto-suave">{compat.texto}</p>
      <p className="text-sm text-texto">{textoEnvio(o)}</p>
      {total && <p className="text-sm font-medium">{total}</p>}
      {aviso && <p className="text-xs text-probable">{aviso}</p>}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Comprar en ${o.tienda} (abre la publicación en otra pestaña)`}
          className="mt-1 flex h-11 items-center justify-center rounded-xl bg-acento font-semibold text-black transition active:scale-95"
        >
          Comprar
        </a>
      ) : (
        <p className="mt-1 text-xs text-texto-suave">No tengo un link seguro a esta publicación.</p>
      )}
    </li>
  );
}
