"use client";

import { useState } from "react";
import type { KnowledgePack } from "@/shared";
import type { Plano } from "../_datos/api";
import { resumenOrigen, textoResumen, todoDelManual } from "../../../components/viewer/origen";
import { AnimacionPreparando } from "./animacion-preparando";
import { Alerta } from "./experto";

/**
 * Pantalla 4, al terminar: qué encontró el experto. La notebook armada, el manual (con su
 * sello de verificado o NO VERIFICADO), las piezas y los primeros pasos con su página.
 * Muestra solo lo que vino en el pack: nada inventado.
 */

const PASOS_A_MOSTRAR = 4;
const PIEZAS_A_MOSTRAR = 10;

export function ResumenGuia({
  pack,
  plano,
  equipo,
}: {
  pack: KnowledgePack;
  plano: Plano | null;
  /** Para dibujar el equipo correcto (tipoEquipo de la IA o la clase). */
  equipo?: string | null;
}) {
  const enPasos = new Set(pack.pasos.flatMap((p) => p.piezas));
  // Primero las piezas que se usan en los pasos (las que el experto va a mostrar).
  const piezas = [...pack.piezas].sort((a, b) => Number(enPasos.has(b.id)) - Number(enPasos.has(a.id)));
  const pasos = [...pack.pasos].sort((a, b) => a.orden - b.orden);
  const verificados = pack.pasos.filter((p) => p.cita?.estado === "VERIFICADO").length;
  const [todos, setTodos] = useState(false);
  const visibles = todos ? pasos : pasos.slice(0, PASOS_A_MOSTRAR);

  return (
    <div className="aparece grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start">
      <div className="flex flex-col items-center gap-2">
        <AnimacionPreparando acto={plano ? "listo" : "plano"} equipo={equipo} />
        {plano && (
          <p className="text-center text-xs text-texto-suave">
            {textoPlano(plano)}
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
            <p className="text-xs text-texto-suave">
              {pasos.length > 1 ? `Lo que vamos a hacer (${pasos.length} pasos)` : "Lo que vamos a hacer"}
            </p>
            {/* El estado de los pasos, una vez arriba (en vez de un cartel en cada paso). */}
            <p className="mt-0.5 mb-2 text-xs text-texto-suave">{resumenPasos(pack)}</p>
            <ol className="flex flex-col gap-2">
              {visibles.map((p, i) => (
                <li key={p.id} className="flex items-start gap-3 rounded-2xl bg-black/15 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-acento text-xs font-bold text-black">
                    {i + 1}
                  </span>
                  <p className="min-w-0 flex-1 text-sm leading-snug">{p.texto}</p>
                  <SelloPaso paso={p} packVerificado={pack.verificado} />
                </li>
              ))}
            </ol>
            {pasos.length > PASOS_A_MOSTRAR && (
              <button
                type="button"
                onClick={() => setTodos((t) => !t)}
                className="mt-2 text-sm font-medium text-texto underline underline-offset-4"
              >
                {todos ? "Ver menos" : `Ver los ${pasos.length} pasos`}
              </button>
            )}
          </div>
        )}

        {pack.advertencias.length > 0 && (
          <p className="flex items-start gap-2 rounded-2xl border border-probable/40 bg-probable/10 p-3 text-sm text-probable">
            <Alerta /> {pack.advertencias[0]}
          </p>
        )}
      </div>
      {/* Lugar para el botón "Ver al experto": aunque la barra de Safari achique la pantalla, la
          advertencia del final se puede scrollear hasta arriba del botón y no queda tapada. */}
      <div className="h-24 md:hidden" aria-hidden />
    </div>
  );
}

/** El estado de los pasos en una línea: "Guía pública: 0 de 11 pasos con página del manual". */
export function resumenPasos(pack: Pick<KnowledgePack, "pasos" | "verificado">): string {
  const conPagina = pack.pasos.filter((p) => p.cita?.estado === "VERIFICADO" && p.cita.pagina).length;
  const n = pack.pasos.length;
  return `${pack.verificado ? "Manual" : "Guía pública"}: ${conPagina} de ${n} ${n === 1 ? "paso" : "pasos"} con página del manual`;
}

/** El sello de cada paso: "Manual ✓ p.N" si tiene cita verificada; si no, discreto y en gris. */
export function textoSelloPaso(
  p: Pick<KnowledgePack["pasos"][number], "cita">,
  packVerificado: boolean,
): { texto: string; verificado: boolean } {
  if (p.cita?.estado === "VERIFICADO" && p.cita.pagina) return { texto: `Manual ✓ p.${p.cita.pagina}`, verificado: true };
  return { texto: packVerificado ? "Sin página" : "Guía pública", verificado: false };
}

function SelloPaso({ paso, packVerificado }: { paso: KnowledgePack["pasos"][number]; packVerificado: boolean }) {
  const { texto, verificado } = textoSelloPaso(paso, packVerificado);
  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] ${
        verificado ? "bg-confirmado/15 text-confirmado" : "bg-texto/10 text-texto-suave"
      }`}
    >
      {texto}
    </span>
  );
}

/**
 * De dónde salen las ubicaciones del 3D (C10): "según el manual" solo si todo sale del manual;
 * si no, el mismo resumen que muestra el visor ("4 del manual · 3 estimadas · 1 genérica").
 */
export function textoPlano(plano: Plano): string {
  if (plano.origen === "plantilla") return "Esquema genérico: no pude ubicar las piezas con el manual";
  const r = resumenOrigen(plano.plano);
  const n = plano.plano.piezas.length;
  if (todoDelManual(r)) return `${n} ${n === 1 ? "pieza ubicada" : "piezas ubicadas"} según el manual`;
  return `Piezas en el 3D: ${textoResumen(r).toLowerCase()}`;
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
