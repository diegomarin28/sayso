"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Coreografia, KnowledgePack } from "../../../shared";
import { Anterior, Foto, Globo, Libro, Pausa, Reproducir, Siguiente } from "./iconos";
import type { EstadoControles } from "./reproducir";

/**
 * Partes visuales de la guía (pantallas 5 y 6), para que se entienda el paso a paso y la charla:
 * tarjeta del paso con su número y cita, puntos para volver a ver un paso, historial de la
 * conversación y preguntas sugeridas. Solo muestran; la lógica sigue en GuiaExperto.
 */

export type MensajeChat = { rol: "persona"; texto: string; id: number } | { rol: "experto"; c: Coreografia; id: number };

/**
 * Paso actual, compacto para que el 3D se vea grande (prueba real: a 390×844 el 3D ocupa al menos la
 * mitad del alto). Arriba, en una línea: número de paso, sello de la cita y puntos para volver a un paso.
 * El texto, en 3 líneas con "ver más". Abajo, en una sola fila, los controles (con "Ver en el manual"
 * como ícono). Queda a la vista hasta el siguiente.
 */
/** Cuántos puntos de paso entran junto al sello en un celular de 390 px. */
const MAX_PUNTOS = 9;

/** Los pasos que tienen punto: todos si entran; si no, una ventana de `max` que sigue al paso actual. */
export function puntosVisibles(total: number, indice: number, max = MAX_PUNTOS): number[] {
  const n = Math.min(total, max);
  const desde = Math.min(Math.max(indice - Math.floor(n / 2), 0), total - n);
  return Array.from({ length: n }, (_, i) => desde + i);
}

export function TarjetaPaso({
  c,
  indice,
  total,
  completa,
  onElegir,
  onVerManual,
  verFoto = false,
  controles,
}: {
  c: Coreografia;
  indice: number;
  total: number;
  /** Ya llegaron todos los pasos de la respuesta (el título dice "de N"). Cada punto es un paso recibido: se puede tocar. */
  completa: boolean;
  onElegir: (i: number) => void;
  /** Si está, el paso cita una página que tiene imagen: botón "Ver en el manual". */
  onVerManual?: () => void;
  /** Lo que cita es la foto de un paso (guía con fotos, ej. iFixit): el botón dice "Ver la foto del paso". */
  verFoto?: boolean;
  /** Botones de la guía (anterior, pausa, siguiente): ver `ControlesGuia`. Va en la misma fila que "Ver en el manual". */
  controles?: ReactNode;
}) {
  const bloqueo = c.riesgo === "alto";
  const [entero, setEntero] = useState(false);
  // "Ver más" solo si el texto no entra en 3 líneas (se mide al dibujarlo).
  const [largo, setLargo] = useState(false);
  const medir = (el: HTMLParagraphElement | null) => {
    if (el && !entero) setLargo(el.scrollHeight > el.clientHeight + 1);
  };
  return (
    <div
      aria-live="polite"
      className={`pointer-events-auto rounded-2xl border px-3 pt-2 pb-2.5 shadow-xl backdrop-blur-md ${
        bloqueo ? "border-peligro/60 bg-peligro/20" : "border-borde bg-fondo/85"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex shrink-0 items-center gap-2">
          <p className={`shrink-0 text-[11px] font-semibold tracking-widest uppercase ${bloqueo ? "text-peligro" : "text-acento"}`}>
            {bloqueo
              ? "Paso bloqueado"
              : total > 1 || completa
                ? `Paso ${indice + 1}${completa ? ` de ${total}` : ""}`
                : "El experto dice"}
          </p>
          <EtiquetaCita c={c} />
        </div>
        {total > 1 && (
          // El punto se ve chico, pero se toca en 44 px de alto: el botón es más grande que el punto.
          // En pantallas muy angostas (SE de 320 px) los puntos no entran con el sello: el título ya dice "Paso N de M".
          // Con guías largas (30 o 40 pasos) se ve una ventana alrededor del paso actual: todos juntos tapaban el sello.
          <div className="-my-3.5 -mr-1 flex min-w-0 items-center overflow-hidden max-[360px]:hidden" role="group" aria-label="Pasos">
            {puntosVisibles(total, indice).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => onElegir(i)}
                aria-label={`Ver el paso ${i + 1}`}
                aria-current={i === indice}
                className="group flex h-11 cursor-pointer items-center px-[3px]"
              >
                <span
                  aria-hidden
                  className={`block h-1.5 rounded-full transition-all group-hover:bg-texto-suave ${i === indice ? "w-4 bg-acento" : "w-1.5 bg-texto-suave/60"}`}
                />
              </button>
            ))}
            {!completa && <span className="mx-[3px] h-1.5 w-1.5 animate-pulse rounded-full bg-texto-suave/60" aria-hidden />}
          </div>
        )}
      </div>
      {/* 3 líneas (2 en pantallas bajas) que se desvanecen abajo, sin "…": cortado justo después de un punto se
          leía "...." (#231). El resto, con "ver más". */}
      <p
        ref={medir}
        className={`mt-1 text-[15px] leading-snug font-medium ${
          entero
            ? ""
            : `max-h-[4.125em] overflow-hidden [@media(max-height:600px)]:max-h-[2.75em] ${largo ? "[mask-image:linear-gradient(to_bottom,#000_55%,transparent)]" : ""}`
        }`}
      >
        {c.dice.split(/\s+/).map((palabra, i) => (
          <Fragment key={i}>
            <span className="palabra" style={{ animationDelay: `${i * 40}ms` }}>
              {palabra}
            </span>{" "}
          </Fragment>
        ))}
      </p>
      {(largo || entero) && (
        <button type="button" onClick={() => setEntero((e) => !e)} className="-my-2 h-8 text-xs font-medium text-acento">
          {entero ? "ver menos" : "ver más"}
        </button>
      )}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{controles}</div>
        {onVerManual && (
          <button
            type="button"
            onClick={onVerManual}
            aria-label={verFoto ? "Ver la foto del paso" : "Ver en el manual"}
            title={verFoto ? "Ver la foto del paso" : "Ver en el manual"}
            className="mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-borde bg-superficie text-texto active:scale-95"
          >
            {verFoto ? <Foto size={18} /> : <Libro size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * B5: controles de la guía. Por defecto no avanza solo: "Siguiente" se resalta cuando la guía
 * terminó de decir el paso y espera. "Automático" la hace seguir sola. Pausar corta la voz.
 */
export function ControlesGuia({
  c,
  onAnterior,
  onPausar,
  onSeguir,
  onSiguiente,
  onModo,
}: {
  c: EstadoControles;
  onAnterior: () => void;
  onPausar: () => void;
  onSeguir: () => void;
  onSiguiente: () => void;
  onModo: (auto: boolean) => void;
}) {
  // Hasta 400 px (iPhone SE, 320) todo más apretado y "Auto" en vez de "Automático": si no, la fila
  // mide ~355 px, se sale de la tarjeta y corre la pantalla de costado.
  const boton =
    "flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition active:scale-95 disabled:opacity-30 max-[400px]:px-2.5";
  const auto = c.modo === "auto";
  return (
    <div className="mt-2 flex items-center gap-2 max-[400px]:gap-1.5" role="group" aria-label="Controles de la guía">
      <button type="button" onClick={onAnterior} disabled={!c.hayAnterior} aria-label="Paso anterior" className={`${boton} border-borde bg-superficie text-texto`}>
        <Anterior size={18} />
      </button>
      <button
        type="button"
        onClick={c.pausado ? onSeguir : onPausar}
        aria-label={c.pausado ? "Seguir" : "Pausar"}
        className={`${boton} border-borde bg-superficie text-texto`}
      >
        {c.pausado ? <Reproducir size={18} /> : <Pausa size={18} />}
        <span className="max-[400px]:hidden">{c.pausado ? "Seguir" : "Pausar"}</span>
      </button>
      <button
        type="button"
        onClick={onSiguiente}
        disabled={!c.haySiguiente}
        aria-label="Paso siguiente"
        className={`${boton} flex-1 ${c.esperando && !c.pausado ? "border-acento bg-acento text-fondo" : "border-borde bg-superficie text-texto"}`}
      >
        Siguiente <Siguiente size={18} className="max-[360px]:hidden" />
      </button>
      <label className="flex h-11 shrink-0 cursor-pointer items-center gap-1.5 text-xs text-texto-suave select-none max-[400px]:gap-1">
        <input type="checkbox" checked={auto} onChange={(e) => onModo(e.target.checked)} className="peer sr-only" />
        <span
          aria-hidden
          className={`relative h-5 w-9 rounded-full transition ${auto ? "bg-acento" : "bg-texto-suave/60"} peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-acento`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-texto transition-all ${auto ? "left-[18px]" : "left-0.5"}`} />
        </span>
        <span className="max-[400px]:hidden">Automático</span>
        <span className="hidden max-[400px]:inline">Auto</span>
      </label>
    </div>
  );
}

/** Cada instrucción cita documento y página, o se marca NO VERIFICADO. */
export function EtiquetaCita({ c }: { c: Coreografia }) {
  if (c.riesgo === "alto") return null;
  const { texto, verificada } = selloCita(c);
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded px-1.5 py-px text-[11px] ${
        verificada ? "bg-confirmado/15 text-confirmado" : "bg-texto-suave/15 text-texto-suave"
      }`}
      title={c.cita?.doc}
    >
      {texto}
    </span>
  );
}

/**
 * Sello discreto de dónde sale el paso (prueba real: "NO VERIFICADO" asustaba y ocupaba lugar).
 * Con cita verificada: "Manual ✓ p. N". Con una página que no se pudo verificar: "Manual p. N · sin
 * verificar" (no se esconde). Sin cita del manual: "Guía pública", en gris. La transparencia entera
 * sigue en "¿De dónde sale esto?".
 */
export function selloCita(c: Pick<Coreografia, "cita">): { texto: string; verificada: boolean } {
  const verificada = c.cita?.estado === "VERIFICADO";
  const pagina = c.cita?.pagina ? ` p. ${c.cita.pagina}` : "";
  if (c.cita && verificada) return { texto: `Manual ✓${pagina}`, verificada };
  if (c.cita?.pagina) return { texto: `Manual${pagina} · sin verificar`, verificada };
  return { texto: "Guía pública", verificada };
}

/** Preguntas para tocar, armadas con las piezas del manual (sin IA: no gastan). */
export function preguntasSugeridas(pack: KnowledgePack, max = 3): string[] {
  const enPasos = new Set(pack.pasos.flatMap((p) => p.piezas));
  const piezas = [...pack.piezas].sort((a, b) => Number(enPasos.has(b.id)) - Number(enPasos.has(a.id)));
  return piezas.slice(0, max).map((p) => {
    const { texto, plural } = conArticulo(p.nombre);
    return `¿Dónde ${plural ? "están" : "está"} ${texto}?`;
  });
}

/**
 * "Ventilador" → "el ventilador", "Batería" → "la batería", "Tornillos del ventilador" → "los
 * tornillos del ventilador" (heurística simple para las sugerencias: género y número de la primera palabra).
 */
export function conArticulo(nombre: string): { texto: string; plural: boolean } {
  const n = nombre.charAt(0).toLowerCase() + nombre.slice(1);
  const primera = n.split(/\s+/)[0];
  const plural = primera.length > 3 && /[aeiouáéíóú]s$|[^aeiouáéíóús]es$/.test(primera);
  const singular = plural ? primera.replace(/(?<=[^aeiouáéíóús])es$/, "").replace(/s$/, "") : primera;
  const femenina = (/a$|i[oó]n$|dad$/.test(singular) && !/^(sistema|tema|problema)$/.test(singular)) || /^(fuente|llave|base|parte|corriente|red|clave)(s|es)?$/.test(primera);
  const articulo = plural ? (femenina ? "las" : "los") : femenina ? "la" : "el";
  return { texto: `${articulo} ${n}`, plural };
}

/** Preguntas sugeridas para tocar, en una fila arriba de la caja de texto (se desliza de costado). */
export function FilaSugerencias({ sugerencias, onPreguntar }: { sugerencias: string[]; onPreguntar: (texto: string) => void }) {
  if (!sugerencias.length) return null;
  return (
    // Se desliza de costado: el borde derecho se funde para que se note que hay más preguntas.
    <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-borde bg-fondo px-4 pt-3 pr-10 [mask-image:linear-gradient(to_right,#000_calc(100%-3rem),transparent)] [scrollbar-width:none]">
      {sugerencias.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPreguntar(s)}
          className="h-11 shrink-0 rounded-full border border-borde px-3 text-sm whitespace-nowrap text-texto-suave transition hover:border-texto-suave hover:text-texto"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

/** Botón redondo de ícono (44 px) que flota sobre el 3D, con un número opcional en una insignia. */
export function BotonIcono({ etiqueta, onClick, insignia, children }: { etiqueta: string; onClick: () => void; insignia?: number; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className="pointer-events-auto relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-borde bg-superficie/85 text-texto shadow-lg backdrop-blur active:scale-95"
    >
      {children}
      {!!insignia && (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-acento px-1 text-[11px] font-bold text-fondo"
        >
          {insignia}
        </span>
      )}
    </button>
  );
}

/** La charla como texto, para copiarla o compartirla ("Vos: …" / "Experto: …", con la página citada). */
export function chatComoTexto(mensajes: MensajeChat[]): string {
  return mensajes
    .map((m) => {
      if (m.rol === "persona") return `Vos: ${m.texto}`;
      const pagina = m.c.cita?.pagina ? ` (${m.c.cita.doc ?? "manual"}, p. ${m.c.cita.pagina})` : "";
      return `Experto: ${m.c.dice}${pagina}`;
    })
    .join("\n\n");
}

/** "Conversación (n)": ícono con el número de preguntas en una insignia; abre la charla entera. */
export function BotonConversacion({ mensajes }: { mensajes: MensajeChat[] }) {
  const [abierta, setAbierta] = useState(false);
  const [copiado, setCopiado] = useState(false);
  /** El modal sumó una entrada al historial: "atrás" la consume y cierra (no se va del experto). */
  const conHistorial = useRef(false);
  const preguntas = mensajes.filter((m) => m.rol === "persona").length;

  function abrir() {
    setCopiado(false);
    setAbierta(true);
    window.history.pushState({ ...window.history.state, conversacion: true }, "");
    conHistorial.current = true;
  }
  function cerrar() {
    setAbierta(false);
    if (conHistorial.current) {
      conHistorial.current = false;
      window.history.back(); // saca la entrada que sumó abrir()
    }
  }
  useEffect(() => {
    if (!abierta) return;
    // Atrás (gesto o botón) y Escape cierran el modal.
    const alVolver = () => {
      conHistorial.current = false;
      setAbierta(false);
    };
    const alTecla = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    window.addEventListener("popstate", alVolver);
    window.addEventListener("keydown", alTecla);
    return () => {
      window.removeEventListener("popstate", alVolver);
      window.removeEventListener("keydown", alTecla);
    };
  }, [abierta]);

  async function exportar() {
    const texto = chatComoTexto(mensajes);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Conversación con el experto", text: texto });
        return;
      }
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      // Si la persona cancela la hoja de compartir, no pasa nada.
    }
  }

  if (!mensajes.length) return null;
  return (
    <>
      <BotonIcono etiqueta={`Conversación${preguntas > 0 ? ` (${preguntas})` : ""}`} onClick={abrir} insignia={preguntas}>
        <Globo size={20} />
      </BotonIcono>

      {/* En document.body: el botón vive en una capa con pointer-events-none sobre el 3D y, montado
          ahí adentro, el modal heredaba eso (Cerrar no respondía en iPhone, #227). */}
      {abierta &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Conversación con el experto"
            className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-fondo/70 md:items-center md:p-6"
            onClick={cerrar}
          >
            <div
              className="aparece flex max-h-[85dvh] w-full max-w-xl flex-col rounded-t-3xl border border-borde bg-fondo md:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 border-b border-borde px-5 py-4">
                <p className="min-w-0 font-semibold">Conversación con el experto</p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={exportar}
                    className="h-11 rounded-full border border-borde px-4 text-sm"
                  >
                    {copiado ? "Copiado ✓" : "Compartir"}
                  </button>
                  <button
                    type="button"
                    onClick={cerrar}
                    className="h-11 rounded-full border border-borde px-4 text-sm"
                  >
                    Cerrar
                  </button>
                </div>
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
                      <p className="mb-1.5 leading-snug">{m.c.dice}</p>
                      <EtiquetaCita c={m.c} />
                    </li>
                  ),
                )}
              </ol>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
