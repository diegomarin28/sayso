"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Coreografia, Evento, KnowledgePack, PlanoDePiezas } from "../../../shared";
import { Visor, type ModoEfectos } from "../Visor";
import { BotonConversacion, BotonIcono, ControlesGuia, FilaSugerencias, preguntasSugeridas, TarjetaPaso, type MensajeChat } from "./conversacion";
import { FlechaEnviar, GirarCelular, Libro, Siguiente } from "./iconos";
import { fotoParaPaso, paginaParaPaso, VerPaginaManual, type PaginaManual } from "./pagina-manual";
import { fuenteApi, type EventoChat, type FuenteChat, type MensajeHistorial } from "./eventos-chat";
import { pasosDelPack } from "./guia-del-pack";
import { conDesarme } from "./desarme";
import { conPiezaNombrada } from "./pieza-nombrada";
import { datosTransparencia, DeDondeSale } from "./transparencia";
import {
  esperar,
  guiaPendiente,
  Reproductor,
  tiempoDeLectura,
  type EstadoControles,
  type EstadoGuia,
  type GuiaGuardada,
  type ModoAvance,
} from "./reproducir";

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
  /** La foto del paso que cita el paso, por la URL de la cita (guías con fotos, ej. iFixit: `fotosPorPaso`). */
  fotoDePaso?: (url: string) => string | null | undefined;
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
  /**
   * Se llama una vez por respuesta cuando terminó de decirse su último paso (con cuántos pasos tuvo), ej. para
   * preguntar «¿Se resolvió?». No se llama si terminó en un bloqueo, con un error o si la persona preguntó
   * otra cosa a mitad. Retomar una guía con "Seguir con la guía" y llegar al final también avisa.
   */
  onUltimoPaso?: (pasos: number) => void;
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
  fotoDePaso,
  preguntaInicial,
  decir = decirConTiempoDeLectura,
  onEvento,
  accesorioEntrada,
  preguntaDictada,
  onCambiarPieza,
  onUltimoPaso,
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
  /** El chat (el ícono flotante sobre el 3D): la charla y el campo para preguntar. */
  const [preguntando, setPreguntando] = useState(false);
  const historial = useRef<MensajeHistorial[]>([]);
  const actual = useRef<AbortController | null>(null);
  const idMensaje = useRef(0);
  const sugerencias = useMemo(() => preguntasSugeridas(pack), [pack]);
  // B6: si el experto nombra una pieza del plano, el 3D va a ella y la resalta solo.
  const idsPlano = useMemo(() => new Set(plano.piezas.map((p) => p.pieza)), [plano]);

  /**
   * Una guía que quedó a medias porque la persona preguntó otra cosa (con el chat corto, la
   * respuesta nueva reemplaza la guía): el botón "Seguir con la guía" la retoma en ese paso.
   * Si pregunta varias cosas sueltas seguidas, se conserva la guía original.
   */
  const guiaGuardada = useRef<(GuiaGuardada & { vistos: Set<number> }) | null>(null);
  const [retomable, setRetomable] = useState<GuiaGuardada | null>(null);

  /** Reproduce una respuesta. Con `retomar`, los pasos ya vistos no se vuelven a sumar a la conversación. */
  const reproducirRespuesta = useCallback(
    async (eventos: (senal: AbortSignal) => AsyncIterable<EventoChat>, opciones: { inicio?: number; vistos?: Set<number> } = {}) => {
      // Lo que estaba a medias se guarda antes de cortarlo (si no había ya una guía guardada).
      const previa = reproductor.current && !guiaGuardada.current ? guiaPendiente(reproductor.current) : null;
      if (previa) {
        guiaGuardada.current = { ...previa, vistos: new Set(yaMostrados.current) };
        setRetomable(previa);
      }
      actual.current?.abort();
      const ctl = new AbortController();
      actual.current = ctl;
      setPasos([]);
      setIndice(0);
      yaMostrados.current = new Set(opciones.vistos);
      const r = new Reproductor({ modo: modoRef.current, alCambiar: setControles, alUltimoPaso: onUltimoPaso, inicio: opciones.inicio });
      reproductor.current = r;
      return r.reproducir(
        eventos(ctl.signal),
        {
          estado: (e, d) => (setEstado(e), setDetalle(d)),
          paso: (c, _bloqueo, i) => {
            pasoEnVisor.current = i;
            // #233: si el paso saca una tapa (o la pantalla de una tablet) o sus tornillos, el 3D lo desarma.
            setCoreografia(conDesarme(conPiezaNombrada(c, pack.piezas, idsPlano), plano, pack.piezas));
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
    },
    [pack, plano, idsPlano, decir, onCambiarPieza, onUltimoPaso],
  );

  const preguntar = useCallback(
    async (pregunta: string) => {
      const limpia = pregunta.trim();
      if (!limpia) return;
      // Con el chat abierto, se cierra: la respuesta se ve en el 3D y en la hoja.
      setPreguntando(false);
      const pedido = { casoId, pack, plano, manualFileId, historial: historial.current.slice(-HISTORIAL_MAX), pregunta: limpia, tipoEquipo };
      historial.current = [...historial.current, { rol: "persona", texto: limpia }];
      setMensajes((m) => [...m, { rol: "persona", texto: limpia, id: ++idMensaje.current }]);
      const dicho = await reproducirRespuesta((senal) => fuente(pedido, senal));
      if (dicho) historial.current = [...historial.current, dicho];
    },
    [casoId, pack, plano, manualFileId, tipoEquipo, fuente, reproducirRespuesta],
  );

  /**
   * Al abrir un caso guardado ("Mis casos") la guía no vuelve a preguntar (no gasta): se ofrece "Seguir con
   * la guía" con los pasos guardados del pack, sin IA (#219). Quedan en el historial para lo que se pregunte después.
   */
  const pasosGuardados = useMemo(() => (preguntaInicial ? [] : pasosDelPack(pack, plano)), [preguntaInicial, pack, plano]);
  const seguirGuardada = useCallback(async () => {
    const pasos = pasosGuardados;
    const dicho = await reproducirRespuesta(async function* () {
      for (const c of pasos) yield { tipo: "paso", coreografia: c } satisfies EventoChat;
      yield { tipo: "fin", pasos: pasos.length } satisfies EventoChat;
    });
    if (dicho) historial.current = [...historial.current, dicho];
  }, [pasosGuardados, reproducirRespuesta]);

  /** Retoma la guía guardada en el paso donde quedó (sin IA: los pasos ya llegaron). */
  const seguirGuia = useCallback(() => {
    const g = guiaGuardada.current;
    if (!g) return;
    guiaGuardada.current = null;
    setRetomable(null);
    reproductor.current = null; // la respuesta suelta no se guarda en lugar de la guía
    void reproducirRespuesta(
      async function* () {
        for (const c of g.pasos) yield { tipo: "paso", coreografia: c } satisfies EventoChat;
        yield { tipo: "fin", pasos: g.pasos.length } satisfies EventoChat;
      },
      { inicio: g.indice, vistos: g.vistos },
    );
  }, [reproducirRespuesta]);

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
  // La página del manual que cita el paso o, si cita un paso con foto (iFixit), esa foto.
  const paginaDelPaso = paginaParaPaso(pasoActual, imagenPagina) ?? fotoParaPaso(pasoActual, fotoDePaso);
  const etiquetaBoton = ocupado ? "Cambiar" : "Preguntar";
  // Lo que tapan los avisos de arriba del 3D: el visor encuadra y pone las etiquetas debajo.
  const [cabecera, reservado] = useAltoHastaAbajo<HTMLDivElement>();
  // El campo para preguntar va abajo del chat.
  const campo = (
        <form
          className="flex items-center gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            // Corto a propósito: en un iPhone SE la caja mide ~140 px y "Preguntale al experto…" se cortaba.
            placeholder={estado === "bloqueado" ? "Otra pregunta…" : "Tu pregunta…"}
            aria-label="Pregunta para el experto"
            // Al abrir el chat, el cursor ya queda en el campo.
            autoFocus
            className="h-12 min-w-0 flex-1 rounded-2xl border border-borde bg-fondo px-4 text-base text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none"
          />
          {accesorioEntrada}
          <button
            type="submit"
            disabled={!texto.trim()}
            aria-label={etiquetaBoton}
            className="flex h-12 shrink-0 items-center justify-center rounded-2xl bg-acento px-4 font-semibold text-fondo transition active:scale-95 disabled:opacity-30 max-[480px]:w-12 max-[480px]:px-0"
          >
            {/* En celulares (hasta 480 px, incluso los Pro Max de 430), solo el ícono: la fila siempre entra y la caja de texto tiene lugar. */}
            <span className="max-[480px]:hidden">{etiquetaBoton}</span>
            <FlechaEnviar className="hidden max-[480px]:block" />
          </button>
        </form>
  );
  const horizontal = useCelularHorizontal();

  return (
    <div className={`flex flex-col bg-escena text-texto ${className}`}>
      {/* El 3D ocupa todo el espacio entre el encabezado y la hoja. La hoja tiene alto fijo: sea una
          heladera o un celular, la página no cambia; la cámara acerca o aleja el equipo para que entre
          entero (encuadre) y nada lo tapa, porque la hoja va debajo del 3D y no encima. */}
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

        {/* Arriba, sobre el 3D, solo avisos chicos: el visor encuadra y pone las etiquetas debajo. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 px-4 pt-2">
          <div ref={cabecera} className="flex flex-col items-start gap-2">
            {origenPlano === "plantilla" && (
              <p className="rounded-full border border-probable/50 bg-escena/80 px-3 py-1 text-xs text-probable">
                Esquema genérico, no es tu modelo exacto
              </p>
            )}
            {horizontal && (
              <p className="flex items-center gap-2 rounded-full border border-borde bg-superficie/90 px-4 py-1.5 text-sm text-texto backdrop-blur">
                <GirarCelular size={18} /> Girá el celular para ver mejor
              </p>
            )}
          </div>
        </div>

        {/* Abajo a la derecha del 3D, justo arriba de la hoja: la charla (con el número de preguntas) y la transparencia (#95). */}
        <div className="pointer-events-none absolute right-3 bottom-3 flex gap-2">
          <BotonConversacion mensajes={mensajes} abierta={preguntando} onCambiar={setPreguntando} pie={campo} />
          <BotonIcono etiqueta="¿De dónde sale esto?" onClick={() => setTransparenciaAbierta(true)}>
            <Libro size={20} />
          </BotonIcono>
        </div>
      </div>

      {/* La hoja: el paso y sus controles, al alcance del pulgar, con lo justo de alto (el texto ocupa 2 o 3
          líneas, así la hoja casi no cambia entre pasos). La pregunta se abre con el botón de mensajes. Nunca
          pasa de la mitad de la pantalla: lo que no entra se lee con scroll adentro. En pantallas anchas el
          contenido va centrado y angosto. */}
      <section
        aria-label="Guía del experto"
        className="flex max-h-[50dvh] shrink-0 flex-col rounded-t-3xl border-t border-borde bg-superficie shadow-[0_-12px_32px_rgb(0_0_0/0.35)]"
      >
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-borde" />
        <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-col gap-2 overflow-y-auto px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* Caso abierto desde "Mis casos": los pasos guardados del pack, sin IA (#219). */}
          {!pasoActual && !ocupado && mensajes.length === 0 && pasosGuardados.length > 0 && (
            <button
              type="button"
              onClick={() => void seguirGuardada()}
              className="flex min-h-11 items-center gap-2 rounded-2xl border border-acento/60 bg-acento/10 px-4 py-2.5 text-left text-texto active:scale-[0.99]"
            >
              <Siguiente size={20} className="shrink-0 text-acento" />
              <span className="flex flex-col leading-tight">
                <span className="font-semibold">Seguir con la guía · {pasosGuardados.length} {pasosGuardados.length === 1 ? "paso" : "pasos"}</span>
                <span className="text-xs text-texto-suave">Los pasos que ya armamos para tu caso, sin volver a preguntar</span>
              </span>
            </button>
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
              verFoto={!!paginaDelPaso?.foto}
              controles={
                <>
                  {controles && (controles.total > 1 || !controles.completa) && (
                    <ControlesGuia
                      c={{ ...controles, modo }}
                      onAnterior={() => reproductor.current?.anterior()}
                      onPausar={() => reproductor.current?.pausar()}
                      onSeguir={() => reproductor.current?.seguir()}
                      onSiguiente={() => reproductor.current?.siguiente()}
                      onModo={cambiarModo}
                    />
                  )}
                  {retomable && <BotonSeguirGuia guia={retomable} onSeguir={seguirGuia} />}
                </>
              }
            />
          )}
          <EstadoExperto estado={estado} detalle={detalle} />
          {!pasoActual && !ocupado && estado !== "error" && pasosGuardados.length === 0 && (
            <p className="text-sm text-texto-suave">Tocá el ícono de mensajes para preguntarle al experto lo que quieras.</p>
          )}
        </div>

        {/* Las sugerencias, solo cuando no hay un paso a la vista. */}
        <div className="mx-auto w-full max-w-2xl">
          <FilaSugerencias sugerencias={ocupado || pasoActual ? [] : sugerencias} onPreguntar={(t) => void preguntar(t)} />
        </div>

      </section>
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

/** Después de una pregunta suelta: vuelve a la guía en el paso donde había quedado. */
function BotonSeguirGuia({ guia, onSeguir }: { guia: GuiaGuardada; onSeguir: () => void }) {
  return (
    <button
      type="button"
      onClick={onSeguir}
      className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-acento/60 bg-acento/10 px-3 text-sm font-medium text-texto transition active:scale-95"
    >
      <Siguiente size={18} /> Seguir con la guía · paso {guia.indice + 1} de {guia.pasos.length}
    </button>
  );
}

