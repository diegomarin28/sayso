"use client";

import type { KnowledgePack } from "@/shared";
import type { Plano } from "../_datos/api";
import { AnimacionPreparando } from "./animacion-preparando";

/**
 * Pantalla 4, al terminar: qué encontró el experto. La notebook armada, el manual (con su
 * sello de verificado o NO VERIFICADO), las piezas y los primeros pasos con su página.
 * Muestra solo lo que vino en el pack: nada inventado.
 */

const PASOS_A_MOSTRAR = 3;
const PIEZAS_A_MOSTRAR = 10;

export function ResumenGuia({ pack, plano }: { pack: KnowledgePack; plano: Plano | null }) {
  const enPasos = new Set(pack.pasos.flatMap((p) => p.piezas));
  // Primero las piezas que se usan en los pasos (las que el experto va a mostrar).
  const piezas = [...pack.piezas].sort((a, b) => Number(enPasos.has(b.id)) - Number(enPasos.has(a.id)));
  const pasos = [...pack.pasos].sort((a, b) => a.orden - b.orden);
  const verificados = pack.pasos.filter((p) => p.cita?.estado === "VERIFICADO").length;

  return (
    <div className="aparece grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start">
      <div className="flex flex-col items-center gap-2">
        <AnimacionPreparando acto={plano ? "listo" : "plano"} />
        {plano && (
          <p className="text-center text-xs text-texto-suave">
            {plano.origen === "ia"
              ? `${plano.plano.piezas.length} piezas ubicadas según el manual`
              : "Esquema genérico: no pude ubicar las piezas con el manual"}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-5 rounded-3xl border border-borde bg-superficie p-5">
        {/* El manual, como un documento */}
        <div className="flex items-start gap-4">
          <Documento verificado={pack.verificado} />
          <div className="min-w-0">
            <p className="text-xs tracking-widest text-texto-suave uppercase">Tu guía</p>
            <p className="mt-0.5 font-semibold leading-snug break-words">
              {pack.fuentes[0]?.doc ?? "Guía pública"}
            </p>
            <span
              className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-xs ${
                pack.verificado
                  ? "border-confirmado/40 bg-confirmado/10 text-confirmado"
                  : "border-probable/40 bg-probable/10 text-probable"
              }`}
            >
              {pack.verificado
                ? `Manual verificado · ${verificados} de ${pack.pasos.length} pasos con página`
                : "NO VERIFICADO · guía pública"}
            </span>
          </div>
        </div>

        {/* Piezas */}
        <div>
          <p className="mb-2 text-xs text-texto-suave">Piezas que encontré ({pack.piezas.length})</p>
          <ul className="flex flex-wrap gap-1.5">
            {piezas.slice(0, PIEZAS_A_MOSTRAR).map((p) => (
              <li
                key={p.id}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  enPasos.has(p.id)
                    ? "border-acento/60 bg-acento/10 text-texto"
                    : "border-borde text-texto-suave"
                }`}
              >
                {p.nombre}
              </li>
            ))}
            {pack.piezas.length > PIEZAS_A_MOSTRAR && (
              <li className="px-1 py-1 text-xs text-texto-suave">+{pack.piezas.length - PIEZAS_A_MOSTRAR}</li>
            )}
          </ul>
        </div>

        {/* Primeros pasos */}
        {pasos.length > 0 && (
          <div>
            <p className="mb-2 text-xs text-texto-suave">
              {pasos.length > PASOS_A_MOSTRAR
                ? `Lo que vamos a hacer (${pasos.length} pasos)`
                : "Lo que vamos a hacer"}
            </p>
            <ol className="flex flex-col gap-2">
              {pasos.slice(0, PASOS_A_MOSTRAR).map((p, i) => (
                <li key={p.id} className="flex items-start gap-3 rounded-2xl bg-black/15 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-acento text-xs font-bold text-black">
                    {i + 1}
                  </span>
                  <p className="min-w-0 flex-1 text-sm leading-snug">{p.texto}</p>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] ${
                      p.cita?.estado === "VERIFICADO" && p.cita.pagina
                        ? "bg-texto/10 text-texto"
                        : "bg-probable/15 text-probable"
                    }`}
                  >
                    {p.cita?.estado === "VERIFICADO" && p.cita.pagina
                      ? `p. ${p.cita.pagina}`
                      : "NO VERIFICADO"}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {pack.advertencias.length > 0 && (
          <p className="rounded-2xl border border-probable/40 bg-probable/10 p-3 text-sm text-probable">
            ⚠ {pack.advertencias[0]}
          </p>
        )}
      </div>
    </div>
  );
}

/** Ícono de documento con sello (verde si está verificado, amarillo si no). */
function Documento({ verificado }: { verificado: boolean }) {
  const sello = verificado ? "var(--confirmado)" : "var(--probable)";
  return (
    <svg width="44" height="52" viewBox="0 0 44 52" fill="none" aria-hidden className="shrink-0">
      <path
        d="M4 4h24l12 12v32H4z"
        fill="var(--fondo)"
        stroke="var(--borde)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M28 4v12h12" stroke="var(--borde)" strokeWidth="2" strokeLinejoin="round" />
      <path
        d="M11 22h18M11 28h22M11 34h14"
        stroke="var(--texto-suave)"
        strokeOpacity="0.6"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="33" cy="41" r="8" fill={sello} />
      {verificado ? (
        <path
          d="M29.5 41l2.5 2.5 4.5-5"
          stroke="#000"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path d="M33 37v5M33 45v.5" stroke="#000" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  );
}
