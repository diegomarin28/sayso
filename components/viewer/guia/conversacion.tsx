"use client";

import { Fragment, useState } from "react";
import type { Coreografia, KnowledgePack } from "../../../shared";

/**
 * Partes visuales de la guía (pantallas 5 y 6), para que se entienda el paso a paso y la charla:
 * tarjeta del paso con su número y cita, puntos para volver a ver un paso, historial de la
 * conversación y preguntas sugeridas. Solo muestran; la lógica sigue en GuiaExperto.
 */

export type MensajeChat = { rol: "persona"; texto: string; id: number } | { rol: "experto"; c: Coreografia; id: number };

/** Paso actual: número, total (si ya llegaron todos), texto y cita. Queda a la vista hasta el siguiente. */
export function TarjetaPaso({
  c,
  indice,
  total,
  completa,
  onElegir,
}: {
  c: Coreografia;
  indice: number;
  total: number;
  /** Ya llegaron todos los pasos de la respuesta: se puede volver a ver cualquiera. */
  completa: boolean;
  onElegir: (i: number) => void;
}) {
  const bloqueo = c.riesgo === "alto";
  return (
    <div
      aria-live="polite"
      className={`pointer-events-auto rounded-2xl border p-4 shadow-xl backdrop-blur-md max-[440px]:p-3 ${
        bloqueo ? "border-peligro/60 bg-peligro/20" : "border-borde bg-fondo/85"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className={`text-xs font-semibold tracking-widest uppercase ${bloqueo ? "text-peligro" : "text-acento"}`}>
          {bloqueo
            ? "Paso bloqueado"
            : total > 1 || completa
              ? `Paso ${indice + 1}${completa ? ` de ${total}` : ""}`
              : "El experto dice"}
        </p>
        {total > 1 && (
          <div className="flex items-center gap-1.5" role="group" aria-label="Pasos">
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                type="button"
                disabled={!completa}
                onClick={() => onElegir(i)}
                aria-label={`Ver el paso ${i + 1}`}
                aria-current={i === indice}
                className={`h-2.5 rounded-full transition-all ${i === indice ? "w-6 bg-acento" : "w-2.5 bg-texto-suave/40"} ${
                  completa ? "cursor-pointer hover:bg-texto-suave" : ""
                }`}
              />
            ))}
            {!completa && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-texto-suave/40" aria-hidden />}
          </div>
        )}
      </div>
      <p className="text-lg leading-snug font-medium max-[440px]:text-base">
        {c.dice.split(/\s+/).map((palabra, i) => (
          <Fragment key={i}>
            <span className="palabra" style={{ animationDelay: `${i * 40}ms` }}>
              {palabra}
            </span>{" "}
          </Fragment>
        ))}
      </p>
      <EtiquetaCita c={c} />
    </div>
  );
}

/** Cada instrucción cita documento y página, o se marca NO VERIFICADO. */
export function EtiquetaCita({ c }: { c: Coreografia }) {
  if (c.riesgo === "alto") return null;
  const verificada = c.cita?.estado === "VERIFICADO";
  return (
    <span
      className={`mt-2 inline-flex max-w-full items-center gap-1 truncate rounded-md px-2 py-0.5 text-xs ${
        verificada ? "bg-confirmado/15 text-confirmado" : "bg-probable/15 text-probable"
      }`}
      title={c.cita?.doc}
    >
      {c.cita && verificada
        ? `${c.cita.pagina ? `Manual p. ${c.cita.pagina}` : "Manual"} ✓`
        : c.cita?.pagina
          ? `p. ${c.cita.pagina} · no verificado`
          : "NO VERIFICADO"}
    </span>
  );
}

/** Preguntas para tocar, armadas con las piezas del manual (sin IA: no gastan). */
export function preguntasSugeridas(pack: KnowledgePack, max = 3): string[] {
  const enPasos = new Set(pack.pasos.flatMap((p) => p.piezas));
  const piezas = [...pack.piezas].sort((a, b) => Number(enPasos.has(b.id)) - Number(enPasos.has(a.id)));
  return piezas.slice(0, max).map((p) => `¿Dónde está ${articulo(p.nombre)}?`);
}

/** "Ventilador" → "el ventilador", "Batería" → "la batería" (heurística simple para las sugerencias). */
function articulo(nombre: string): string {
  const n = nombre.charAt(0).toLowerCase() + nombre.slice(1);
  const primera = n.split(/\s+/)[0];
  const femenina = /a$|ión$|dad$/.test(primera) && !/^(sistema|tema|problema)$/.test(primera);
  return `${femenina ? "la" : "el"} ${n}`;
}

/** Fila arriba de la caja de texto: abrir la conversación y preguntas sugeridas. */
export function FilaSugerencias({
  sugerencias,
  mensajes,
  onPreguntar,
}: {
  sugerencias: string[];
  mensajes: MensajeChat[];
  onPreguntar: (texto: string) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const preguntas = mensajes.filter((m) => m.rol === "persona").length;
  return (
    <>
      <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-borde bg-fondo px-4 pt-3 [scrollbar-width:none]">
        {mensajes.length > 0 && (
          <button
            type="button"
            onClick={() => setAbierta(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-acento/60 bg-acento/10 px-3 text-sm font-medium text-texto"
          >
            <Globo /> Conversación{preguntas > 0 ? ` (${preguntas})` : ""}
          </button>
        )}
        {sugerencias.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPreguntar(s)}
            className="h-9 shrink-0 rounded-full border border-borde px-3 text-sm whitespace-nowrap text-texto-suave transition hover:border-texto-suave hover:text-texto"
          >
            {s}
          </button>
        ))}
      </div>

      {abierta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Conversación con el experto"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center md:p-6"
          onClick={() => setAbierta(false)}
        >
          <div
            className="aparece flex max-h-[85dvh] w-full max-w-xl flex-col rounded-t-3xl border border-borde bg-fondo md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-borde px-5 py-4">
              <p className="font-semibold">Conversación con el experto</p>
              <button
                type="button"
                onClick={() => setAbierta(false)}
                className="h-10 rounded-full border border-borde px-4 text-sm"
              >
                Cerrar
              </button>
            </div>
            <ol className="flex flex-col gap-3 overflow-y-auto px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {mensajes.map((m) =>
                m.rol === "persona" ? (
                  <li key={m.id} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-acento/20 px-4 py-2.5 text-sm">
                    {m.texto}
                  </li>
                ) : (
                  <li
                    key={m.id}
                    className={`max-w-[90%] self-start rounded-2xl rounded-bl-md border px-4 py-2.5 text-sm ${
                      m.c.riesgo === "alto" ? "border-peligro/60 bg-peligro/15" : "border-borde bg-superficie"
                    }`}
                  >
                    <p className="leading-snug">{m.c.dice}</p>
                    <EtiquetaCita c={m.c} />
                  </li>
                ),
              )}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}

function Globo() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 5h16v11H9l-5 4z" />
    </svg>
  );
}
