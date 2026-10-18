"use client";

import { useState } from "react";
import type { FuenteChat, EventoChat } from "../../../components/viewer";
import { Coreografia, type KnowledgePack, type PlanoDePiezas } from "../../../shared";
import type { Cierre, EstadoCierre } from "../_datos/mis-casos";

/**
 * Cierre del caso (pantalla 6) y retomar un caso que esperaba el repuesto.
 * El experto sigue desde el paso de cambiar la pieza con la guía guardada: no se llama a la IA.
 */

const OPCIONES: { estado: EstadoCierre; titulo: string; detalle: string }[] = [
  { estado: "resuelto", titulo: "Lo resolví", detalle: "Quedó andando." },
  {
    estado: "esperando_repuesto",
    titulo: "Pedí el repuesto",
    detalle: "Cuando llegue, retomás desde “Mis casos”.",
  },
  { estado: "derivado", titulo: "Lo llevo a un técnico", detalle: "Queda anotado como derivado." },
];

export function PanelCierre({
  pack,
  piezaSugerida,
  compra,
  onCerrar,
  onCancelar,
}: {
  pack: KnowledgePack;
  /** La pieza que el experto dijo de cambiar o la de la última compra abierta. */
  piezaSugerida: string | null;
  compra: { pieza: string; url: string } | null;
  onCerrar: (c: Cierre) => void;
  onCancelar: () => void;
}) {
  const [elegido, setElegido] = useState<EstadoCierre | null>(null);
  const [pieza, setPieza] = useState<string>(compra?.pieza ?? piezaSugerida ?? pack.piezas[0]?.id ?? "");
  const url = compra && compra.pieza === pieza ? compra.url : undefined;

  function confirmar(estado: EstadoCierre) {
    onCerrar({
      estado,
      ...(estado === "esperando_repuesto" && pieza ? { pieza, ...(url ? { compraUrl: url } : {}) } : {}),
      ts: new Date().toISOString(),
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Terminar el caso"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center md:p-6"
      onClick={onCancelar}
    >
      <div
        className="aparece flex w-full max-w-xl flex-col gap-4 rounded-t-3xl border border-borde bg-fondo px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:rounded-3xl md:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <p className="text-lg font-semibold">¿Cómo quedó?</p>
          <button
            type="button"
            onClick={onCancelar}
            className="h-10 rounded-full border border-borde px-4 text-sm"
          >
            Seguir
          </button>
        </div>

        {OPCIONES.map((o) => (
          <button
            key={o.estado}
            type="button"
            onClick={() => (o.estado === "esperando_repuesto" ? setElegido(o.estado) : confirmar(o.estado))}
            aria-pressed={elegido === o.estado}
            className={`flex flex-col items-start gap-0.5 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
              elegido === o.estado
                ? "border-acento bg-acento/10"
                : "border-borde bg-superficie hover:border-texto-suave"
            }`}
          >
            <span className="font-semibold">{o.titulo}</span>
            <span className="text-sm text-texto-suave">{o.detalle}</span>
          </button>
        ))}

        {elegido === "esperando_repuesto" && (
          <div className="flex flex-col gap-3 rounded-2xl border border-acento/40 p-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-texto-suave">¿Qué pieza pediste?</span>
              <select
                value={pieza}
                onChange={(e) => setPieza(e.target.value)}
                className="h-12 rounded-xl border border-borde bg-superficie px-3 text-base"
              >
                {pack.piezas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-texto-suave">
              {url ? (
                <>
                  Compra guardada:{" "}
                  <a href={url} target="_blank" rel="noopener noreferrer" className="break-all underline">
                    {new URL(url).hostname}
                  </a>
                </>
              ) : (
                "Si la compraste desde “Repuestos”, el link queda guardado solo."
              )}
            </p>
            <button
              type="button"
              onClick={() => confirmar("esperando_repuesto")}
              className="h-12 rounded-xl bg-acento font-semibold text-black active:scale-[0.98]"
            >
              Guardar y esperar el repuesto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Pregunta con la que arranca la guía al retomar un caso que esperaba el repuesto. */
export function preguntaAlRetomar(pack: KnowledgePack, pieza: string): string {
  const nombre = pack.piezas.find((p) => p.id === pieza)?.nombre ?? pieza;
  return `Ya llegó el repuesto: ${nombre.toLowerCase()}. Sigamos con el cambio.`;
}

/**
 * Pasos para seguir desde el cambio de `pieza`, armados con la guía guardada (los pasos del pack
 * con su cita). Solo usa piezas que existen en el plano; un paso de riesgo alto corta como bloqueo.
 */
export function pasosAlRetomar(pack: KnowledgePack, plano: PlanoDePiezas, pieza: string): EventoChat[] {
  const enPlano = new Set(plano.piezas.map((p) => p.pieza));
  const nombre = pack.piezas.find((p) => p.id === pieza)?.nombre ?? pieza;
  const pasos = [...pack.pasos].sort((a, b) => a.orden - b.orden);
  let desde = pasos.findIndex((p) => p.piezas.includes(pieza));
  if (desde < 0) desde = pasos.findIndex((p) => p.texto.toLowerCase().includes(nombre.toLowerCase()));
  if (desde < 0) desde = 0;

  const acciones = (piezas: string[]) => {
    const visibles = piezas.filter((p) => enPlano.has(p));
    return [
      { t: "restaurar" as const },
      ...(visibles[0] ? [{ t: "camara" as const, objetivo: visibles[0], zoom: 1.4 }] : []),
      ...visibles.map((p) => ({ t: "resaltar" as const, pieza: p })),
    ];
  };

  const eventos: EventoChat[] = [
    {
      tipo: "paso",
      coreografia: Coreografia.parse({
        paso: 1,
        dice: `Bienvenido de vuelta. Ya tenés ${nombre.toLowerCase()}: sigamos desde el cambio.`,
        acciones: acciones([pieza]),
        riesgo: "bajo",
      }),
    },
  ];
  for (const [i, p] of pasos.slice(desde).entries()) {
    const c = Coreografia.parse({
      paso: i + 2,
      dice: p.texto,
      ...(p.cita ? { cita: p.cita } : {}),
      acciones: acciones(p.piezas),
      riesgo: p.riesgo,
    });
    if (p.riesgo === "alto") {
      eventos.push({ tipo: "bloqueo", coreografia: c, clases: [] });
      break;
    }
    eventos.push({ tipo: "paso", coreografia: c });
  }
  eventos.push({ tipo: "fin", pasos: eventos.length });
  return eventos;
}

/**
 * Fuente del chat que, para la pregunta de retomar, responde con los pasos guardados (sin IA) y
 * para todo lo demás usa la fuente normal.
 */
export function fuenteConRetomar(base: FuenteChat, pregunta: string, eventos: EventoChat[]): FuenteChat {
  return (pedido, senal) => {
    if (pedido.pregunta !== pregunta) return base(pedido, senal);
    return (async function* () {
      for (const e of eventos) {
        if (senal.aborted) return;
        yield e;
      }
    })();
  };
}

/** Lo que se le pregunta al experto cuando la persona dice que, después de los pasos, sigue igual. */
export const PREGUNTA_SIGUE_IGUAL = "Hice los pasos y sigue igual. ¿Qué pieza tengo que cambiar?";

/**
 * La pieza candidata a cambiar según la guía guardada: la primera pieza del último paso que
 * existe en el plano (la que se trabajó al final). Null si la guía no nombra ninguna.
 */
export function piezaCandidata(pack: KnowledgePack, plano: PlanoDePiezas): string | null {
  const enPlano = new Set(plano.piezas.map((p) => p.pieza));
  const pasos = [...pack.pasos].sort((a, b) => b.orden - a.orden);
  for (const p of pasos) {
    const pieza = p.piezas.find((x) => enPlano.has(x));
    if (pieza) return pieza;
  }
  return null;
}

/**
 * Respuesta sin IA (modo fixture) a "sigue igual": un paso que marca la pieza a cambiar, así la
 * pantalla ofrece comprarla. Con la IA real responde el experto.
 */
export function pasosSigueIgual(pack: KnowledgePack, plano: PlanoDePiezas): EventoChat[] {
  const pieza = piezaCandidata(pack, plano);
  if (!pieza) return [];
  const nombre = pack.piezas.find((p) => p.id === pieza)?.nombre ?? pieza;
  return [
    {
      tipo: "paso",
      coreografia: Coreografia.parse({
        paso: 1,
        dice: `Si después de esto sigue igual, lo más probable es que haya que cambiar esta pieza: ${nombre.toLowerCase()}. Te muestro dónde comprarla.`,
        acciones: [
          { t: "restaurar" },
          { t: "camara", objetivo: pieza, zoom: 1.4 },
          { t: "resaltar", pieza },
        ],
        riesgo: "bajo",
        cambiar: pieza,
      }),
    },
    { tipo: "fin", pasos: 1 },
  ];
}

/** Fuente que avisa cuando el experto terminó de responder (evento "fin"): ahí se pregunta "¿Se resolvió?". */
export function fuenteConFin(base: FuenteChat, alTerminar: () => void): FuenteChat {
  return (pedido, senal) =>
    (async function* () {
      for await (const e of base(pedido, senal)) {
        // Antes de entregarlo: quien lee puede dejar de pedir eventos apenas recibe el "fin".
        if (e.tipo === "fin" && !senal.aborted) alTerminar();
        yield e;
      }
    })();
}
