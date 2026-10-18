"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Coreografia, Evento, KnowledgePack, PlanoDePiezas } from "../../../shared";
import { Visor, type ModoEfectos } from "../Visor";
import { ControlesGuia, FilaSugerencias, preguntasSugeridas, TarjetaPaso, type MensajeChat } from "./conversacion";
import { FlechaEnviar, GirarCelular, Libro } from "./iconos";
import { paginaParaPaso, VerPaginaManual, type PaginaManual } from "./pagina-manual";
import { fuenteApi, type FuenteChat, type MensajeHistorial } from "./eventos-chat";
import { conPiezaNombrada } from "./pieza-nombrada";
import { datosTransparencia, DeDondeSale } from "./transparencia";
import { esperar, Reproductor, tiempoDeLectura, type EstadoControles, type EstadoGuia, type ModoAvance } from "./reproducir";

/**
 * Pantallas 5 y 6: el experto explica sobre el 3D y la persona pregunta.
 * Autocontenido: visor + stream de /api/chat + tarjeta del paso (número, cita, puntos para volver
 * a verlo) + historial de la conversación + preguntas sugeridas + aviso de esquema genérico +
 * caja para preguntar. La pantalla solo lo monta.
 */
export type GuiaExpertoProps = {
  casoId: string;
  pack: KnowledgePack;
  /** El plano de /api/plano. El chat solo usa ids de este plano. */
  plano: PlanoDePiezas;
  /** "plantilla" = la IA no pudo ubicar las piezas: se avisa que es un esquema genérico. */
  origenPlano: "ia" | "plantilla";
  /** Tipo de equipo en texto libre (de /api/intake/entender): el 3D elige la versión de cada pieza (notebook, celular…). */
  tipoEquipo?: string;
  manualFileId?: string | null;
  /**
   * Imagen (PNG) de una página del manual, si la hay: el paso que la cita muestra "Ver en el manual".
   * La da /api/knowledge (campo de Juanma); la pantalla solo traduce ese campo a esta función.
   */
  imagenPagina?: (pagina: number) => string | null | undefined;
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
/** Pausa entre un paso y el siguiente, para que se note el cambio. */
const PAUSA_ENTRE_PASOS_MS = 450;

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
  tipoEquipo,
  manualFileId,
  imagenPagina,
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
  /**
   * Pasos de la respuesta en curso, tal como los devolvió el visor (ya filtrados por seguridad:
   * si un paso se bloquea, acá está el aviso y no el texto de la IA).
   */
  const [pasos, setPasos] = useState<Coreografia[]>([]);
  const [indice, setIndice] = useState(0);
  /**
   * B5: el reproductor de la respuesta en curso (pausa, anterior, siguiente) y lo que muestran
   * sus botones. Por defecto no avanza solo: espera "Siguiente" (modo "auto" opcional).
   */
  const reproductor = useRef<Reproductor | null>(null);
  const [controles, setControles] = useState<EstadoControles | null>(null);
  const [modo, setModo] = useState<ModoAvance>("manual");
  const modoRef = useRef<ModoAvance>("manual");
  /** Número del paso que se mandó al visor: el visor lo devuelve filtrado en `alPaso`. */
  const pasoEnVisor = useRef(0);
  /** Pasos que ya se mostraron alguna vez (van una sola vez a la conversación). */
  const yaMostrados = useRef(new Set<number>());
  const completa = controles?.completa ?? false;
  /** Lo que se ve en "Conversación": preguntas de la persona y pasos del experto. */
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState("");
  const historial = useRef<MensajeHistorial[]>([]);
  const actual = useRef<AbortController | null>(null);
  const idMensaje = useRef(0);
  const sugerencias = useMemo(() => preguntasSugeridas(pack), [pack]);
  // B6: si el experto nombra una pieza del plano, el 3D va a ella y la resalta solo.
  const idsPlano = useMemo(() => new Set(plano.piezas.map((p) => p.pieza)), [plano]);

  const preguntar = useCallback(
    async (pregunta: string) => {
      const limpia = pregunta.trim();
      if (!limpia) return;
      actual.current?.abort();
      const ctl = new AbortController();
      actual.current = ctl;
      const pedido = { casoId, pack, plano, manualFileId, historial: historial.current.slice(-HISTORIAL_MAX), pregunta: limpia };
      historial.current = [...historial.current, { rol: "persona", texto: limpia }];
      setMensajes((m) => [...m, { rol: "persona", texto: limpia, id: ++idMensaje.current }]);
      setPasos([]);
      setIndice(0);
      yaMostrados.current = new Set();
      const r = new Reproductor({ modo: modoRef.current, alCambiar: setControles });
      reproductor.current = r;
      const dicho = await r.reproducir(
        fuente(pedido, ctl.signal),
        {
          estado: (e, d) => (setEstado(e), setDetalle(d)),
          paso: (c, _bloqueo, i) => {
            pasoEnVisor.current = i;
            setCoreografia(conPiezaNombrada(c, pack.piezas, idsPlano));
            const pieza = piezaACambiar(c, plano);
            if (pieza) onCambiarPieza?.(pieza);
          },
          decir: async (t, senal) => {
            await decir(t, senal);
            // El paso queda a la vista hasta el siguiente (antes se desvanecía y no se entendía).
            await esperar(PAUSA_ENTRE_PASOS_MS, senal);
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
    [casoId, pack, plano, idsPlano, manualFileId, fuente, decir, onCambiarPieza],
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

  /** Volver a ver un paso ya recibido (puntos de la tarjeta): lo anima y lo dice de nuevo. */
  const verPaso = (i: number) => reproductor.current?.irA(i);

  const cambiarModo = (auto: boolean) => {
    const m: ModoAvance = auto ? "auto" : "manual";
    modoRef.current = m;
    setModo(m);
    reproductor.current?.cambiarModo(m);
  };

  /** El visor devuelve cada paso después del filtro de seguridad: eso es lo que se muestra. */
  const alPaso = (c: Coreografia) => {
    const i = pasoEnVisor.current;
    setPasos((p) => {
      const n = [...p];
      n[i] = c; // por número de paso: se puede saltar a uno que todavía no se vio
      return n;
    });
    setIndice(i);
    if (!yaMostrados.current.has(i)) {
      yaMostrados.current.add(i);
      setMensajes((m) => [...m, { rol: "experto", c, id: ++idMensaje.current }]);
    }
  };
  const pasoActual = pasos[indice];
  // Página del manual del paso actual, si tiene imagen (nunca en un paso bloqueado).
  const [paginaAbierta, setPaginaAbierta] = useState<PaginaManual | null>(null);
  const cerrarPagina = useCallback(() => setPaginaAbierta(null), []);
  // "¿De dónde sale esto?": manual, origen del 3D y citas de esta respuesta (plan §10).
  const [transparenciaAbierta, setTransparenciaAbierta] = useState(false);
  const transparencia = useMemo(() => datosTransparencia(pack, plano, origenPlano, pasos), [pack, plano, origenPlano, pasos]);
  const paginaDelPaso = paginaParaPaso(pasoActual, imagenPagina);
  const etiquetaBoton = ocupado ? "Cambiar" : "Preguntar";
  // Lo que tapa la frase (y el aviso / estado) arriba del 3D: el visor encuadra y pone las etiquetas debajo.
  const [cabecera, reservado] = useAltoHastaAbajo<HTMLDivElement>();
  const horizontal = useCelularHorizontal();

  return (
    <div className={`flex flex-col bg-black text-texto ${className}`}>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <Visor
            className="h-full w-full"
            plano={plano}
            coreografia={coreografia}
            piezas={pack.piezas}
            tipoEquipo={tipoEquipo}
            casoId={casoId}
            onEvento={onEvento}
            onPaso={(p) => alPaso(p.coreografia)}
            efectos={efectos}
            reservadoArriba={reservado}
          />
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black via-black/70 to-transparent px-5 pt-5 pb-10 max-[440px]:px-3 max-[440px]:pt-3 max-[440px]:pb-6">
          <div ref={cabecera} className="flex flex-col gap-3 max-[440px]:gap-2">
            {origenPlano === "plantilla" && (
              <p className="self-start rounded-full border border-probable/50 bg-black/60 px-3 py-1 text-xs text-probable">
                Esquema genérico, no es tu modelo exacto
              </p>
            )}
            {pasoActual && (
              <TarjetaPaso
                key={`${indice}-${pasoActual.dice}`}
                c={pasoActual}
                indice={indice}
                total={Math.max(controles?.total ?? 0, pasos.length)}
                completa={completa}
                onElegir={verPaso}
                onVerManual={paginaDelPaso ? () => setPaginaAbierta(paginaDelPaso) : undefined}
                controles={
                  controles && (controles.total > 1 || !controles.completa) ? (
                    <ControlesGuia
                      c={{ ...controles, modo }}
                      onAnterior={() => reproductor.current?.anterior()}
                      onPausar={() => reproductor.current?.pausar()}
                      onSeguir={() => reproductor.current?.seguir()}
                      onSiguiente={() => reproductor.current?.siguiente()}
                      onModo={cambiarModo}
                    />
                  ) : undefined
                }
              />
            )}
            <EstadoExperto estado={estado} detalle={detalle} />
            {/* Dentro de la franja de arriba: el visor encuadra debajo y las etiquetas no lo tapan. */}
            {horizontal && (
              <p className="flex items-center gap-2 self-start rounded-full border border-white/20 bg-black/75 px-4 py-1.5 text-sm text-white backdrop-blur">
                <GirarCelular size={18} /> Girá el celular para ver mejor
              </p>
            )}
          </div>
        </div>
      </div>

      <FilaSugerencias
        sugerencias={ocupado ? [] : sugerencias}
        mensajes={mensajes}
        onPreguntar={(t) => void preguntar(t)}
        extra={
          <button
            type="button"
            onClick={() => setTransparenciaAbierta(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-borde px-3 text-sm font-medium whitespace-nowrap text-texto"
          >
            <Libro size={16} /> ¿De dónde sale esto?
          </button>
        }
      />

      <form
        className="flex shrink-0 items-center gap-2 bg-fondo px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
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
          aria-label={etiquetaBoton}
          className="flex h-12 shrink-0 items-center justify-center rounded-2xl bg-acento px-4 font-semibold text-black transition active:scale-95 disabled:opacity-30 max-[480px]:w-12 max-[480px]:px-0"
        >
          {/* En celulares (hasta 480 px, incluso los Pro Max de 430), solo el ícono: la fila siempre entra y la caja de texto tiene lugar. */}
          <span className="max-[480px]:hidden">{etiquetaBoton}</span>
          <FlechaEnviar className="hidden max-[480px]:block" />
        </button>
      </form>
      {paginaAbierta && <VerPaginaManual pagina={paginaAbierta} onCerrar={cerrarPagina} />}
      {transparenciaAbierta && <DeDondeSale datos={transparencia} onCerrar={() => setTransparenciaAbierta(false)} />}
    </div>
  );
}

function EstadoExperto({ estado, detalle }: { estado: EstadoGuia; detalle?: string }) {
  const texto =
    estado === "pensando"
      ? "Pensando…"
      : estado === "buscando"
        ? (detalle ?? "Buscando en el manual…")
        : estado === "error"
          ? detalle
          : null;
  if (!texto) return null;
  return <p className={`text-sm ${estado === "error" ? "text-peligro" : "animate-pulse text-texto-suave"}`}>{texto}</p>;
}

/** Alto (px) desde el borde de arriba del contenedor posicionado hasta el borde de abajo del elemento. */
function useAltoHastaAbajo<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [alto, setAlto] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const padre = el.offsetParent as HTMLElement | null;
      const arriba = padre ? padre.getBoundingClientRect().top : 0;
      setAlto(Math.round(el.getBoundingClientRect().bottom - arriba));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, alto];
}

/** Celular en horizontal (pantalla baja y apaisada): el 3D queda muy chico. */
function useCelularHorizontal(): boolean {
  const [horizontal, setHorizontal] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape) and (max-height: 500px)");
    const cambiar = () => setHorizontal(mq.matches);
    cambiar();
    mq.addEventListener("change", cambiar);
    return () => mq.removeEventListener("change", cambiar);
  }, []);
  return horizontal;
}
