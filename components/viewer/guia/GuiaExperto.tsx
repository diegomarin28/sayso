"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Coreografia, Evento, KnowledgePack, PlanoDePiezas } from "../../../shared";
import { Visor, type ModoEfectos } from "../Visor";
import { fuenteApi, type FuenteChat, type MensajeHistorial } from "./eventos-chat";
import { esperar, reproducir, tiempoDeLectura, type EstadoGuia } from "./reproducir";

/**
 * Pantallas 5 y 6: el experto explica sobre el 3D y la persona pregunta.
 * Autocontenido: visor + stream de /api/chat + frase que aparece y se desvanece + cita +
 * aviso de esquema genérico + caja para preguntar. La pantalla solo lo monta.
 */
export type GuiaExpertoProps = {
  casoId: string;
  pack: KnowledgePack;
  /** El plano de /api/plano. El chat solo usa ids de este plano. */
  plano: PlanoDePiezas;
  /** "plantilla" = la IA no pudo ubicar las piezas: se avisa que es un esquema genérico. */
  origenPlano: "ia" | "plantilla";
  manualFileId?: string | null;
  /** Si viene, el experto arranca solo (ej. con el síntoma del caso). */
  preguntaInicial?: string;
  /** Voz (C3): decir la frase en voz alta y resolver cuando termina. Sin voz, se usa un tiempo de lectura. */
  decir?: (texto: string, senal: AbortSignal) => Promise<void>;
  /** Eventos para el feed (pieza desconocida, paso bloqueado…). */
  onEvento?: (e: Evento) => void;
  /** Lugar al lado de la caja de texto, ej. el botón de micrófono. */
  accesorioEntrada?: ReactNode;
  /** Lo que dictó la persona (C3). Cada `id` nuevo se pregunta como si lo hubiera escrito. */
  preguntaDictada?: { texto: string; id: number };
  /** Se llama cuando un paso dice que una pieza hay que cambiarla (coreografía con "cambiar"). Solo ids del plano y nunca en un paso bloqueado. */
  onCambiarPieza?: (pieza: string) => void;
  /** Para /lab y tests: de dónde salen las respuestas (por defecto, /api/chat). */
  fuente?: FuenteChat;
  efectos?: ModoEfectos;
  className?: string;
};

/** Por debajo del máximo que acepta /api/chat (LIMITES.chat.maxHistorial, en el servidor). */
const HISTORIAL_MAX = 20;
const FUNDIDO_MS = 900;

/** La pieza a cambiar de un paso, solo si existe en el plano y el paso no está bloqueado. */
export function piezaACambiar(c: Coreografia, plano: PlanoDePiezas): string | null {
  if (!c.cambiar || c.riesgo === "alto") return null;
  return plano.piezas.some((p) => p.pieza === c.cambiar) ? c.cambiar : null;
}

const decirConTiempoDeLectura = (texto: string, senal: AbortSignal) => esperar(tiempoDeLectura(texto), senal);

export function GuiaExperto({
  casoId,
  pack,
  plano,
  origenPlano,
  manualFileId,
  preguntaInicial,
  decir = decirConTiempoDeLectura,
  onEvento,
  accesorioEntrada,
  preguntaDictada,
  onCambiarPieza,
  fuente = fuenteApi,
  efectos,
  className = "",
}: GuiaExpertoProps) {
  const [estado, setEstado] = useState<EstadoGuia>("esperando");
  const [detalle, setDetalle] = useState<string>();
  const [coreografia, setCoreografia] = useState<Coreografia | null>(null);
  /** La frase que se muestra es la que ya pasó por el filtro de seguridad del visor. */
  const [frase, setFrase] = useState<{ c: Coreografia; id: number; visible: boolean } | null>(null);
  const [texto, setTexto] = useState("");
  const historial = useRef<MensajeHistorial[]>([]);
  const actual = useRef<AbortController | null>(null);

  const preguntar = useCallback(
    async (pregunta: string) => {
      const limpia = pregunta.trim();
      if (!limpia) return;
      actual.current?.abort();
      const ctl = new AbortController();
      actual.current = ctl;
      const pedido = { casoId, pack, plano, manualFileId, historial: historial.current.slice(-HISTORIAL_MAX), pregunta: limpia };
      historial.current = [...historial.current, { rol: "persona", texto: limpia }];
      const dicho = await reproducir(
        fuente(pedido, ctl.signal),
        {
          estado: (e, d) => (setEstado(e), setDetalle(d)),
          paso: (c) => {
            setCoreografia({ ...c });
            const pieza = piezaACambiar(c, plano);
            if (pieza) onCambiarPieza?.(pieza);
          },
          decir: async (t, senal) => {
            await decir(t, senal);
            // La frase se desvanece al terminar de decirla (salvo un bloqueo: queda a la vista).
            setFrase((f) => (f && f.c.riesgo !== "alto" ? { ...f, visible: false } : f));
            await esperar(FUNDIDO_MS / 2, senal);
          },
        },
        ctl.signal,
      ).catch((e: unknown) => {
        if (!ctl.signal.aborted) {
          console.error("[guia]", e);
          setEstado("error");
          setDetalle("El experto no pudo responder. Probá de nuevo.");
        }
        return null;
      });
      if (dicho) historial.current = [...historial.current, dicho];
    },
    [casoId, pack, plano, manualFileId, fuente, decir, onCambiarPieza],
  );

  // Arranque automático y cancelación al salir de la pantalla.
  useEffect(() => {
    const t = preguntaInicial ? setTimeout(() => void preguntar(preguntaInicial), 0) : undefined;
    return () => {
      clearTimeout(t);
      actual.current?.abort();
    };
    // Solo al montar: una pregunta inicial por caso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pregunta dictada: solo cuando cambia el id (el mismo texto dos veces son dos preguntas).
  const preguntarRef = useRef(preguntar);
  useEffect(() => {
    preguntarRef.current = preguntar;
  }, [preguntar]);
  useEffect(() => {
    if (preguntaDictada) void preguntarRef.current(preguntaDictada.texto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preguntaDictada?.id]);

  const enviar = () => {
    void preguntar(texto);
    setTexto("");
  };

  const ocupado = estado === "pensando" || estado === "buscando";

  return (
    <div className={`flex flex-col bg-black text-texto ${className}`}>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <Visor
            className="h-full w-full"
            plano={plano}
            coreografia={coreografia}
            piezas={pack.piezas}
            casoId={casoId}
            onEvento={onEvento}
            onPaso={(p) => setFrase((f) => ({ c: p.coreografia, id: (f?.id ?? 0) + 1, visible: true }))}
            efectos={efectos}
          />
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-3 bg-gradient-to-b from-black via-black/70 to-transparent px-5 pt-5 pb-10">
          {origenPlano === "plantilla" && (
            <p className="self-start rounded-full border border-probable/50 bg-black/60 px-3 py-1 text-xs text-probable">
              Esquema genérico, no es tu modelo exacto
            </p>
          )}
          <Frase frase={frase} />
          <EstadoExperto estado={estado} detalle={detalle} />
        </div>
      </div>

      <form
        className="flex shrink-0 items-center gap-2 border-t border-borde bg-fondo px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={estado === "bloqueado" ? "Preguntá otra cosa…" : "Preguntale al experto…"}
          aria-label="Pregunta para el experto"
          className="h-12 min-w-0 flex-1 rounded-2xl border border-borde bg-superficie px-4 text-base text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none"
        />
        {accesorioEntrada}
        <button
          type="submit"
          disabled={!texto.trim()}
          className="h-12 shrink-0 rounded-2xl bg-acento px-4 font-semibold text-black transition active:scale-95 disabled:opacity-30"
        >
          {ocupado ? "Cambiar" : "Preguntar"}
        </button>
      </form>
    </div>
  );
}

/** Frase del experto: aparece palabra por palabra y se desvanece cuando termina de decirla. */
function Frase({ frase }: { frase: { c: Coreografia; id: number; visible: boolean } | null }) {
  if (!frase) return null;
  const { c, id, visible } = frase;
  const bloqueo = c.riesgo === "alto";
  return (
    <div
      key={id}
      aria-live="polite"
      style={{ opacity: visible ? 1 : 0, transition: `opacity ${FUNDIDO_MS}ms ease-out` }}
      className={bloqueo ? "rounded-2xl border border-peligro/60 bg-peligro/15 p-4" : ""}
    >
      <p className="text-xl leading-snug font-medium">
        {c.dice.split(/\s+/).map((palabra, i) => (
          <Fragment key={i}>
            <span className="palabra" style={{ animationDelay: `${i * 55}ms` }}>
              {palabra}
            </span>{" "}
          </Fragment>
        ))}
      </p>
      <Cita c={c} />
    </div>
  );
}

/** Cada instrucción cita documento y página, o se marca NO VERIFICADO. */
function Cita({ c }: { c: Coreografia }) {
  if (c.riesgo === "alto") return null;
  const verificada = c.cita?.estado === "VERIFICADO";
  return (
    <p className="mt-2 text-xs text-texto-suave">
      {c.cita ? (
        <>
          {c.cita.doc}
          {c.cita.pagina ? `, pág. ${c.cita.pagina}` : ""} ·{" "}
          <span className={verificada ? "text-confirmado" : "text-probable"}>{verificada ? "verificado" : "no verificado"}</span>
        </>
      ) : (
        <span className="text-probable">NO VERIFICADO</span>
      )}
    </p>
  );
}

function EstadoExperto({ estado, detalle }: { estado: EstadoGuia; detalle?: string }) {
  const texto =
    estado === "pensando" ? "Pensando…" : estado === "buscando" ? (detalle ?? "Buscando en el manual…") : estado === "error" ? detalle : null;
  if (!texto) return null;
  return (
    <p className={`text-sm ${estado === "error" ? "text-peligro" : "animate-pulse text-texto-suave"}`}>{texto}</p>
  );
}
