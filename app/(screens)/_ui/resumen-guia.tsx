"use client";

import type { KnowledgePack } from "@/shared";
import type { Plano } from "../_datos/api";
import { resumenOrigen, textoResumen, todoDelManual } from "../../../components/viewer/origen";
import { AnimacionPreparando } from "./animacion-preparando";
import { Alerta } from "./experto";
import { sospechasParaMostrar } from "./sospechas";

/**
 * Pantalla 4, al terminar: qué encontró el experto. La notebook armada y la guía: el manual (con
 * su sello de verificado o NO VERIFICADO), el modelo y las piezas. Los pasos no se adelantan acá:
 * los cuenta el experto, uno por uno, en la pantalla 5. Muestra solo lo que vino: nada inventado.
 */

const PIEZAS_A_MOSTRAR = 10;

/**
 * #240: el nombre de la guía para mostrar. Si la fuente viene como URL (guías públicas), muestra el
 * sitio y el título que trae la dirección, no la URL entera: una URL larga sin espacios estiraba la
 * pantalla de costado.
 */
export function nombreFuente(doc: string | undefined): string {
  const texto = doc?.trim();
  if (!texto) return "Guía pública";
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return texto;
  }
  if (!/^https?:$/.test(url.protocol)) return texto;
  const sitio = url.hostname.replace(/^www\./, "");
  const titulo = url.pathname
    .split("/")
    .map((s) => {
      try {
        return decodeURIComponent(s.replace(/\+/g, " "));
      } catch {
        return s;
      }
    })
    .filter((s) => /\p{L}{3,}/u.test(s))
    .sort((a, b) => b.length - a.length)[0];
  if (!titulo) return sitio;
  const legible = titulo.includes(" ") ? titulo : titulo.replace(/[-_]+/g, " ");
  return `${legible.replace(/\.(html?|php|pdf)$/i, "").trim()} · ${sitio}`;
}

export function ResumenGuia({
  pack,
  plano,
  equipo,
  modelo,
}: {
  pack: KnowledgePack;
  plano: Plano | null;
  /** Marca y modelo de la ficha que confirmó la persona. */
  modelo?: string;
  /** Para dibujar el equipo correcto (tipoEquipo de la IA o la clase). */
  equipo?: string | null;
}) {
  const enPasos = new Set(pack.pasos.flatMap((p) => p.piezas));
  // Primero las piezas que se usan en los pasos (las que el experto va a mostrar).
  const piezas = [...pack.piezas].sort((a, b) => Number(enPasos.has(b.id)) - Number(enPasos.has(a.id)));
  const sospechas = sospechasParaMostrar(pack);
  const verificados = pack.pasos.filter((p) => p.cita?.estado === "VERIFICADO").length;

  return (
    <div className="aparece grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start">
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
            <p className="mt-0.5 font-semibold leading-snug [overflow-wrap:anywhere]">
              {nombreFuente(pack.fuentes[0]?.doc)}
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

        {/* El modelo que confirmó la persona */}
        {modelo && (
          <div>
            <p className="mb-1 text-xs text-texto-suave">Modelo</p>
            <p className="font-mono text-sm [overflow-wrap:anywhere]">{modelo}</p>
          </div>
        )}

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

        {sospechas.length > 0 && (
          <div>
            <p className="mb-2 text-xs text-texto-suave">
              Lo que sospechamos · <span className="text-probable">es una hipótesis</span>
            </p>
            <ul className="flex flex-col gap-2">
              {sospechas.map((s) =>
                s.destacada ? (
                  <li key={s.nombre} className="rounded-2xl border border-probable/40 bg-probable/10 p-3">
                    <p className="font-semibold leading-snug [overflow-wrap:anywhere]">{s.nombre}</p>
                    <p className="mt-1 text-sm [overflow-wrap:anywhere]">{s.porque}</p>
                    <p className="mt-2 text-sm text-texto-suave [overflow-wrap:anywhere]">
                      <span className="font-medium text-texto">Cómo confirmarlo:</span> {s.chequeo}
                    </p>
                  </li>
                ) : (
                  <li key={s.nombre} className="rounded-xl border border-borde px-3 py-2">
                    <p className="text-sm font-medium [overflow-wrap:anywhere]">{s.nombre}</p>
                    <p className="mt-0.5 text-xs text-texto-suave [overflow-wrap:anywhere]">{s.porque}</p>
                    <p className="mt-1 text-xs text-texto-suave [overflow-wrap:anywhere]">Cómo confirmarlo: {s.chequeo}</p>
                  </li>
                ),
              )}
            </ul>
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
