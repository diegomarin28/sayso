"use client";

import {
  CameraControls,
  ContactShadows,
  Environment,
  Html,
  Lightformer,
  OrthographicCamera,
  PerformanceMonitor,
  PerspectiveCamera,
} from "@react-three/drei";
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Coreografia, Evento, Pieza, PlanoDePiezas } from "../../shared";
import type { BibliotecaPiezas, DatosPieza } from "../../lib/planogenerator";
import { useBibliotecaPiezas } from "./biblioteca";
import {
  animar,
  continuarAnimacion,
  encuadre,
  colocarEtiqueta,
  LINEA_ETIQUETA,
  liberar,
  piezasResaltadas,
  prepararEscenaSegura,
  separarEtiquetas,
  suavizar,
  type CambioLado,
  type LadoEtiqueta,
  type UbicacionEtiqueta,
  type EscenaPreparada,
  type ModoVista,
  type NodoAnimable,
  usarColorActivo,
} from "./escena";
import { Cubo } from "./guia/iconos";
import { piezasGenericas, resumenOrigen, textoEtiquetaPieza, textoResumen, todoDelManual } from "./origen";
import { prepararPaso, type PasoPreparado } from "./paso";
import {
  bajarCalidad,
  bajarRendimiento,
  calidadInicial,
  dprPara,
  imagenPlana,
  RENDIMIENTO_PLENO,
  soporteDe,
  Vigia,
  type Calidad,
} from "./salud";
import { CSS_ACTIVO, colorActivoDelDocumento } from "./tema";
import { OBJETIVO_GENERAL, aplicarAccion, cerrar, comenzarPaso, estadoInicial, soloVuelveAGeneral, type EstadoEscena } from "./reproductor";

/**
 * "auto": bloom encendido, se apaga solo si el equipo no sostiene ~30 fps.
 * En cualquier modo, si el equipo no lo soporta o deja la imagen en negro, se apaga (ver salud.ts).
 */
export type ModoEfectos = "auto" | "si" | "no";
export type { ModoVista };

export type VisorProps = {
  plano: PlanoDePiezas;
  /**
   * Cada objeto nuevo se reproduce (aunque sea el mismo paso otra vez).
   * Siempre pasa antes por el filtro de seguridad: un paso de riesgo alto no se anima.
   */
  coreografia?: Coreografia | null;
  /** Piezas del knowledge pack: dan el nombre de las etiquetas. Si falta, se usa el id. */
  piezas?: Pieza[];
  /** Tipo de equipo en texto libre (de la recepción): elige la versión de cada pieza (ej. la batería de celular). */
  tipoEquipo?: string;
  casoId?: string;
  /** Eventos para el feed de actividad (ej. pieza que no existe en el modelo). */
  onEvento?: (evento: Evento) => void;
  /** Lo que realmente se reproduce tras el filtro (ej. para mostrar la derivación en vez del texto de la IA). */
  onPaso?: (paso: PasoPreparado) => void;
  efectos?: ModoEfectos;
  /** Avisa si el posprocesado quedó encendido o apagado (útil con "auto"). */
  onEfectos?: (activos: boolean) => void;
  vistaInicial?: ModoVista;
  /**
   * Px de arriba del lienzo tapados por algo encima del visor (ej. la frase del experto). Las
   * piezas se encuadran en lo que queda libre y las etiquetas nunca se meten en esa franja.
   */
  reservadoArriba?: number;
  /** `false`: solo el 3D, sin el botón de vista ni el aviso de origen (ej. las tarjetas de /lab/galeria). */
  controles?: boolean;
  className?: string;
};

/** Pausa entre acciones de un mismo paso, para que se lean como una secuencia. */
const ESPACIO_ENTRE_ACCIONES_MS = 450;
/** Si la frase cambia de alto más que esto, se vuelve a encuadrar la pieza. */
const REENCUADRAR_DESDE_PX = 24;
const FOV = 35;

export function Visor({
  plano,
  coreografia,
  piezas,
  tipoEquipo,
  casoId = "sin-caso",
  onEvento,
  onPaso,
  efectos = "auto",
  onEfectos,
  vistaInicial = "perspectiva",
  reservadoArriba = 0,
  controles = true,
  className,
}: VisorProps) {
  const [vista, setVista] = useState<ModoVista>(vistaInicial);
  /** Panel de opciones del 3D (vista y origen de las ubicaciones), cerrado: solo el ícono en la esquina. */
  const [opciones, setOpciones] = useState(false);
  // Escalones cuando el equipo no llega a 30 fps (ver `bajarRendimiento` en salud.ts).
  const [rendimiento, setRendimiento] = useState(RENDIMIENTO_PLENO);
  // null hasta conocer el WebGL del equipo (ver salud.ts).
  const [calidad, setCalidad] = useState<Calidad | null>(null);
  const [falla, setFalla] = useState<Falla | null>(null);
  // Cambiar `intento` rearma el lienzo entero (contexto perdido o "Reintentar").
  const [intento, setIntento] = useState(0);
  const [vigiando, setVigiando] = useState(true);
  // Cambiar `ronda` arranca un vigía nuevo (después de bajar la calidad), sin rearmar el lienzo.
  const [ronda, setRonda] = useState(0);
  const efectosActivos = efectos !== "no" && !!calidad?.efectos && (efectos === "si" || !rendimiento.sinBloom);
  // Con los efectos forzados ("si", para comparar en /lab) no se baja nada.
  const alBajarRendimiento = useCallback(() => setRendimiento((r) => bajarRendimiento(r, efectosActivos)), [efectosActivos]);
  // Se espera la biblioteca de piezas (o su plazo) para no armar la escena dos veces.
  const biblioteca = useBibliotecaPiezas(plano.piezas.map((p) => p.pieza));
  const soportaWebGL2 = useSoportaWebGL2();
  // Una vez al montar (el lienzo solo existe en el cliente) y antes de preparar la escena: ver tema.ts.
  useState(() => usarColorActivo(colorActivoDelDocumento()));
  // Un plano mixto no se muestra como verificado entero (ver origen.ts).
  const origen = useMemo(() => {
    const r = resumenOrigen(plano);
    const medidas = r.medidasEstimadas && r.manual + r.estimada + r.plantilla > 0 && !todoDelManual(r) ? " · medidas estimadas" : "";
    return { texto: textoResumen(r) + medidas, verificado: todoDelManual(r) };
  }, [plano]);

  useEffect(() => {
    onEfectos?.(efectosActivos);
  }, [efectosActivos, onEfectos]);

  /** Contexto perdido (iOS lo hace con poca memoria): se rearma el lienzo sin efectos. */
  const rearmar = useCallback(() => {
    setCalidad((c) => (c ? { ...c, efectos: false, multisampling: 0 } : c));
    setFalla(null);
    setVigiando(true);
    setIntento((i) => i + 1);
  }, []);

  const alCrear = useCallback(
    ({ gl }: { gl: THREE.WebGLRenderer }) => {
      const tactil = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
      const inicial = calidadInicial(soporteDe(gl.getContext(), gl.capabilities.maxSamples, tactil));
      // Al rearmar, no se vuelve a prender lo que ya se apagó.
      setCalidad((c) =>
        c
          ? {
              efectos: inicial.efectos && c.efectos,
              multisampling: Math.min(c.multisampling, inicial.multisampling),
              entorno: inicial.entorno && c.entorno,
            }
          : inicial,
      );
      // Un shader que no compila (ej. el del bloom en algún Safari) apaga los efectos.
      gl.debug.onShaderError = (_gl, _programa, vertice, fragmento) => {
        console.error("[visor] un shader no compiló: apago los efectos.", gl.getContext().getShaderInfoLog(fragmento) || gl.getContext().getShaderInfoLog(vertice));
        setCalidad((c) => (c ? { ...c, efectos: false } : c));
      };
      const lienzo = gl.domElement;
      let plazo: ReturnType<typeof setTimeout> | undefined;
      lienzo.addEventListener("webglcontextlost", (e) => {
        // Al desmontar el visor, R3F suelta el contexto a propósito: no es una falla.
        if (!lienzo.isConnected) return;
        e.preventDefault();
        console.warn("[visor] se perdió el contexto WebGL: rearmo el 3D.");
        setFalla("contexto");
        plazo = setTimeout(rearmar, ESPERA_CONTEXTO_MS);
      });
      lienzo.addEventListener("webglcontextrestored", () => {
        clearTimeout(plazo);
        rearmar();
      });
    },
    [rearmar],
  );

  /** El vigía vio negro: se apaga lo siguiente; si no queda nada, aviso en vez de lienzo vacío. */
  const alVerNegro = useCallback(() => {
    if (!calidad) return;
    const menos = bajarCalidad(calidad);
    console.warn("[visor] el 3D quedó en negro:", menos ? "bajo la calidad y vuelvo a mirar." : "muestro el aviso.");
    if (menos) {
      setCalidad(menos);
      setRonda((r) => r + 1); // vigía nuevo con la calidad nueva
    } else {
      setVigiando(false);
      setFalla("negro");
    }
  }, [calidad]);

  if (soportaWebGL2 === false) {
    return (
      <div className={className} style={{ position: "relative", background: "var(--escena)" }}>
        <AvisoVisor falla="sin_webgl" />
      </div>
    );
  }

  return (
    <div className={className} style={{ position: "relative", background: "var(--escena)", touchAction: "none" }}>
      <Resguardo key={intento} onError={() => setFalla("error")}>
        <Canvas dpr={dprPara(rendimiento)} onCreated={alCrear}>
          {/* Sin fondo propio: el lienzo es transparente y se ve var(--escena) del contenedor tal cual
              (un color de fondo en la escena pasaría por el tone mapping del posprocesado y saldría más oscuro). */}
          {vista === "isometrica" ? (
            <OrthographicCamera makeDefault position={[100, 100, 100]} near={0.1} far={2000} zoom={10} />
          ) : (
            <PerspectiveCamera makeDefault position={[0, 55, 60]} fov={FOV} near={0.5} far={1000} />
          )}
          {calidad && <LuzDeEstudio entorno={calidad.entorno} />}
          {calidad && biblioteca !== undefined && (
            <Escena
              plano={plano}
              biblioteca={biblioteca}
              tipoEquipo={tipoEquipo}
              coreografia={coreografia}
              piezas={piezas}
              casoId={casoId}
              onEvento={onEvento}
              onPaso={onPaso}
              sombrasEnVivo={efectosActivos}
              reservadoArriba={reservadoArriba}
            />
          )}
          {/* Con el contexto perdido todo se lee negro: el vigía espera al lienzo nuevo. */}
          {calidad && biblioteca !== undefined && vigiando && !falla && (
            <VigiaNegro key={ronda} renderizaSolo={!efectosActivos} onNegro={alVerNegro} onListo={() => setVigiando(false)} />
          )}
          {/* Ventanas cortas (6 × 250 ms): un celular que no llega a 30 fps baja la calidad en ~1,5 s, no en 10. */}
          {efectos !== "si" && <PerformanceMonitor ms={250} iterations={6} bounds={() => [30, 1000]} flipflops={1} onDecline={alBajarRendimiento} />}
          {calidad && efectosActivos && (
            <Resguardo onError={() => setCalidad((c) => (c ? { ...c, efectos: false } : c))}>
              <EffectComposer multisampling={calidad.multisampling}>
                <Bloom mipmapBlur luminanceThreshold={0.8} luminanceSmoothing={0.2} intensity={1.2} />
                <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
              </EffectComposer>
            </Resguardo>
          )}
        </Canvas>
      </Resguardo>
      {falla && <AvisoVisor falla={falla} onReintentar={falla === "contexto" ? undefined : rearmar} />}
      {/* Un solo botón de ícono en la esquina (prueba real: el 3D se veía chico): abre la vista y de dónde sale cada ubicación. */}
      {controles && (
        <div className="absolute bottom-3 left-3 flex flex-col items-start gap-2">
          {opciones && (
            <div className="aparece flex max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-2xl border border-borde bg-superficie/95 p-3 text-xs text-texto shadow-xl backdrop-blur">
              {!falla && (
                <p className="flex items-center gap-1.5 text-texto-suave" title="De dónde sale la ubicación de las piezas del 3D">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${origen.verificado ? "bg-confirmado" : "bg-probable"}`} />
                  {origen.texto}
                </p>
              )}
              <button
                type="button"
                onClick={() => setVista((v) => (v === "perspectiva" ? "isometrica" : "perspectiva"))}
                className="h-11 rounded-xl border border-borde bg-fondo/60 px-3 text-left font-medium active:scale-95"
              >
                {vista === "perspectiva" ? "Ver en vista isométrica" : "Ver en perspectiva"}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpciones((o) => !o)}
            aria-label="Opciones del 3D: vista y de dónde salen las ubicaciones"
            aria-expanded={opciones}
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-borde bg-superficie/85 text-texto shadow-lg backdrop-blur active:scale-95"
          >
            <Cubo size={20} />
            {/* El punto dice de un vistazo si las ubicaciones son del manual (verde) o no (amarillo). */}
            {!falla && (
              <span aria-hidden className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${origen.verificado ? "bg-confirmado" : "bg-probable"}`} />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Que nunca quede negro (ver salud.ts) ----------

type Falla = "sin_webgl" | "contexto" | "negro" | "error";

/** Si iOS pierde el contexto y no lo devuelve en este plazo, se arma un lienzo nuevo. */
const ESPERA_CONTEXTO_MS = 2500;

const TEXTO_FALLA: Record<Falla, string> = {
  sin_webgl: "Este navegador no puede mostrar el 3D. La guía sigue funcionando por voz y texto.",
  contexto: "Reiniciando el 3D…",
  negro: "No pude mostrar el 3D en este equipo. La guía sigue funcionando por voz y texto.",
  error: "El 3D tuvo un problema. La guía sigue funcionando por voz y texto.",
};

function AvisoVisor({ falla, onReintentar }: { falla: Falla; onReintentar?: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-escena px-8 text-center text-sm text-texto-suave">
      <p>{TEXTO_FALLA[falla]}</p>
      {onReintentar && (
        <button type="button" onClick={onReintentar} className="rounded-full border border-borde px-4 py-1.5 text-xs text-texto">
          Reintentar
        </button>
      )}
    </div>
  );
}

let webgl2: boolean | undefined;
/** Se prueba una sola vez y se libera el contexto de prueba (iOS tiene pocos contextos WebGL). */
function hayWebGL2(): boolean {
  if (webgl2 === undefined) {
    try {
      const ctx = document.createElement("canvas").getContext("webgl2");
      webgl2 = !!ctx;
      ctx?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webgl2 = false;
    }
  }
  return webgl2;
}
const sinCambios = () => () => {};

/** `false` si el navegador no tiene WebGL2 (three.js lo necesita); `undefined` en el servidor. */
function useSoportaWebGL2(): boolean | undefined {
  return useSyncExternalStore(sinCambios, hayWebGL2, () => undefined);
}

/** Atrapa un error de lo que envuelve (el lienzo o los efectos) y avisa en vez de dejar todo negro. */
class Resguardo extends Component<{ children: ReactNode; onError: (e: unknown) => void }, { roto: boolean }> {
  state = { roto: false };
  static getDerivedStateFromError() {
    return { roto: true };
  }
  componentDidCatch(e: unknown) {
    console.error("[visor]", e);
    this.props.onError(e);
  }
  render() {
    return this.state.roto ? null : this.props.children;
  }
}

/**
 * Mira la imagen (filas y columnas enteras, ver `lineasVigia`) los primeros segundos (ver `Vigia`). Corre después de los efectos
 * (prioridad 2); con prioridad > 0 R3F deja de dibujar solo, así que sin efectos dibuja él.
 */
function VigiaNegro({ renderizaSolo, onNegro, onListo }: { renderizaSolo: boolean; onNegro: () => void; onListo: () => void }) {
  const vigia = useRef(new Vigia());
  const esquina = useMemo(() => new Uint8Array(4), []);
  const avisado = useRef(false);
  useFrame(({ gl, scene, camera }) => {
    if (renderizaSolo) gl.render(scene, camera);
    const v = vigia.current;
    if (!v.siguiente()) {
      if (v.terminado && !avisado.current) {
        avisado.current = true;
        onListo();
      }
      return;
    }
    if (avisado.current) return;
    gl.setRenderTarget(null);
    const ctx = gl.getContext();
    // Falla solo si TODAS las líneas son del color de la esquina (el fondo, o negro si se rompió todo):
    // un objeto oscuro (la pantalla de una TV de frente) no es una falla: sus bordes no son del fondo.
    ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, esquina);
    const negro = imagenPlana(
      (t) => {
        const px = new Uint8Array(4 * t.ancho * t.alto);
        ctx.readPixels(t.x, t.y, t.ancho, t.alto, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
        return px;
      },
      ctx.drawingBufferWidth,
      ctx.drawingBufferHeight,
      esquina,
    );
    if (v.registrar(negro) === "negro") {
      avisado.current = true;
      onNegro();
    }
  }, 2);
  return null;
}

/** Luz de estudio armada con paneles (sin descargar HDRIs: el Wi-Fi del evento no es confiable). */
function LuzDeEstudio({ entorno }: { entorno: boolean }) {
  return (
    <>
      {entorno ? (
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2.2} position={[0, 40, 0]} rotation-x={Math.PI / 2} scale={[60, 30, 1]} />
          <Lightformer form="rect" intensity={1.4} position={[-40, 12, 15]} rotation-y={Math.PI / 2} scale={[40, 12, 1]} />
          <Lightformer form="rect" intensity={1} position={[40, 12, -15]} rotation-y={-Math.PI / 2} scale={[40, 12, 1]} />
          <Lightformer form="ring" color="#9fc0ff" intensity={0.8} position={[0, 15, -45]} scale={25} />
        </Environment>
      ) : (
        // Sin luz de entorno (el equipo no tiene buffers flotantes): luz de relleno para que los metales no queden negros.
        <hemisphereLight args={["#ffffff", "#30343a", 1.6]} />
      )}
      <ambientLight intensity={0.15} />
      <directionalLight position={[25, 40, 30]} intensity={1.4} />
    </>
  );
}

type EscenaProps = Required<Pick<VisorProps, "plano" | "casoId">> &
  Pick<VisorProps, "coreografia" | "piezas" | "tipoEquipo" | "onEvento" | "onPaso"> & {
    sombrasEnVivo: boolean;
    reservadoArriba: number;
    biblioteca: BibliotecaPiezas | null;
  };

function Escena({ plano, biblioteca, tipoEquipo, coreografia, piezas, casoId, onEvento, onPaso, sombrasEnVivo, reservadoArriba }: EscenaProps) {
  // Por ref: la frase cambia de alto seguido y no hace falta re-renderizar; se usa al encuadrar y en cada cuadro.
  const reservado = useRef(reservadoArriba);
  const controles = useRef<CameraControls>(null);
  const camara = useThree((s) => s.camera);
  const tam = useThree((s) => s.size);
  // Por texto: `piezas` puede llegar como un array nuevo con lo mismo y no hace falta rearmar la escena.
  const claveGenericas = [...piezasGenericas(plano, piezas)].sort().join(",");
  const escena = useMemo(
    () => prepararEscenaSegura(plano, biblioteca, tipoEquipo, new Set(claveGenericas ? claveGenericas.split(",") : [])),
    [plano, biblioteca, tipoEquipo, claveGenericas],
  );
  const estado = useRef<EstadoEscena>(estadoInicial(escena.nodos.keys(), escena.cubiertas, escena.lados));
  const [activos, setActivos] = useState<string[]>([]);
  const onEventoRef = useRef(onEvento);
  const onPasoRef = useRef(onPaso);
  useEffect(() => {
    onEventoRef.current = onEvento;
    onPasoRef.current = onPaso;
  }, [onEvento, onPaso]);

  // Encuadrar y actualizar el estado se usan desde timers: van por ref para leer siempre lo último.
  const acciones = useRef({
    actualizar: (nuevo: EstadoEscena) => {
      estado.current = nuevo;
      const ids = piezasResaltadas(nuevo);
      setActivos((prev) => (prev.join() === ids.join() ? prev : ids));
    },
    mirar: (() => {}) as (objetivo: string, zoom: number, animado: boolean) => void,
  });
  useEffect(() => {
    acciones.current.mirar = (objetivo, zoom, animado) => {
      const c = controles.current;
      if (!c) return;
      const { despiece, lado, piezas } = estado.current;
      const corridas = Object.fromEntries(Object.entries(piezas).filter(([, p]) => p.desp.some((v) => v !== 0)).map(([id, p]) => [id, p.desp]));
      const e = encuadre(escena, objetivo, zoom, camara, tam, despiece, reservado.current, lado, corridas);
      void c.setLookAt(e.posicion.x, e.posicion.y, e.posicion.z, e.objetivo.x, e.objetivo.y, e.objetivo.z, animado);
      // Corre la vista para que la pieza quede en el centro de lo que no tapa la frase.
      void c.setFocalOffset(0, e.focal, 0, animado);
      if (e.zoomOrto !== null) void c.zoomTo(e.zoomOrto, animado);
    };
  }, [escena, camara, tam]);

  // ¿Qué cambió? El plano (o el equipo), o solo las piezas: las reales llegaron después del plazo
  // y reemplazan a las primitivas. En ese caso la escena nueva sigue la animación donde iba y no
  // se tocan el estado, la cámara ni el paso. Corre antes que los efectos de abajo.
  const ultima = useRef<{ escena: EscenaPreparada; plano: PlanoDePiezas; tipoEquipo?: string } | null>(null);
  const soloPiezas = useRef(false);
  useLayoutEffect(() => {
    const previa = ultima.current;
    soloPiezas.current = !!previa && previa.plano === plano && previa.tipoEquipo === tipoEquipo;
    if (previa && soloPiezas.current) continuarAnimacion(previa.escena, escena);
    ultima.current = { escena, plano, tipoEquipo };
    return () => liberar(escena.raiz);
  }, [escena, plano, tipoEquipo]);

  // Plano nuevo: estado en reposo y avisos al feed (con las piezas nuevas, solo los avisos que falten).
  const avisosDados = useRef(new Set<string>());
  useEffect(() => {
    if (!soloPiezas.current) {
      acciones.current.actualizar(estadoInicial(escena.nodos.keys(), escena.cubiertas, escena.lados));
      avisosDados.current = new Set();
    }
    for (const aviso of escena.avisos) {
      if (avisosDados.current.has(aviso)) continue;
      avisosDados.current.add(aviso);
      onEventoRef.current?.(eventoAviso(aviso, casoId));
    }
  }, [escena, casoId]);

  // Cámara nueva (cambio de vista) o plano nuevo: reencuadrar sin tocar el estado de las piezas.
  // Si solo llegaron las piezas reales, la cámara queda donde está (incluso si la persona la giró).
  // (El ref de CameraControls ya está asignado cuando corren los efectos.)
  const camaraPrevia = useRef(camara);
  useEffect(() => {
    const cambioCamara = camaraPrevia.current !== camara;
    camaraPrevia.current = camara;
    if (soloPiezas.current && !cambioCamara) return;
    const { objetivo, zoom } = estado.current.camara;
    acciones.current.mirar(objetivo, zoom, false);
  }, [camara, escena]);

  // La frase cambió de alto (llegó una más larga o más corta): la pieza vuelve al centro de lo libre.
  useEffect(() => {
    const antes = reservado.current;
    reservado.current = reservadoArriba;
    if (Math.abs(reservadoArriba - antes) < REENCUADRAR_DESDE_PX) return;
    const { objetivo, zoom } = estado.current.camara;
    acciones.current.mirar(objetivo, zoom, true);
  }, [reservadoArriba]);

  // Coreografía nueva: filtro de seguridad, limpia resaltados y aplica las acciones una por una.
  useEffect(() => {
    if (!coreografia) return;
    const paso = prepararPaso(coreografia, { casoId, tipoEquipo });
    paso.eventos.forEach((e) => onEventoRef.current?.(e));
    onPasoRef.current?.(paso);
    const { actualizar } = acciones.current;
    // Un paso que solo vuelve a la vista general cierra el equipo (las tapas vuelven a su lugar).
    const inicio = comenzarPaso(estado.current);
    actualizar(soloVuelveAGeneral(paso.coreografia) ? cerrar(inicio) : inicio);
    const timers = paso.coreografia.acciones.map((accion, i) =>
      setTimeout(() => {
        const antes = estado.current;
        const r = aplicarAccion(estado.current, accion, { casoId });
        actualizar(r.estado);
        if (r.evento) onEventoRef.current?.(r.evento);
        // La cámara va a la pieza del plano (la guía pudo nombrarla de otra forma: ver `resolverPieza`).
        else if (accion.t === "camara") acciones.current.mirar(r.estado.camara.objetivo, accion.zoom ?? 1, true);
        else if (accion.t === "restaurar") acciones.current.mirar(OBJETIVO_GENERAL, 1, true);
        // Se sacó una tapa (o se despegó la pantalla): la cámara va al equipo abierto, del lado de la tapa (#233).
        else if (r.estado.lado !== antes.lado || r.estado.camara !== antes.camara) acciones.current.mirar(r.estado.camara.objetivo, r.estado.camara.zoom, true);
      }, i * ESPACIO_ENTRE_ACCIONES_MS),
    );
    return () => timers.forEach(clearTimeout);
    // Sin `escena`: si llegan las piezas reales a mitad de un paso, el paso sigue (no se repite ni se corta).
  }, [coreografia, casoId, plano, tipoEquipo]);

  useFrame(({ clock }) => animar(escena, estado.current, clock.elapsedTime * 1000));

  // Etiquetas de las piezas resaltadas: cada una dice dónde quiere ir y acá se acomodan juntas, en el
  // orden en que se resaltaron, para que no se pisen (#179). Se escribe directo en el DOM (no tiembla).
  const etiquetas = useRef(new Map<string, RegistroEtiqueta>());
  useFrame(() => {
    const medidas = activos.flatMap((id) => {
      const r = etiquetas.current.get(id);
      const m = r?.medir();
      return r && m ? [{ r, m }] : [];
    });
    if (!medidas.length) return;
    const rects = medidas.map(({ m }) => ({ x: m.ancla.x + m.u.caja.x, y: m.ancla.y + m.u.caja.y, ancho: m.ancho, alto: m.alto }));
    const separados = separarEtiquetas(rects, lienzoEtiquetas(tam), reservado.current);
    medidas.forEach(({ r, m }, i) => r.aplicar({ x: separados[i].x - m.ancla.x, y: separados[i].y - m.ancla.y }));
  });

  const delKp = useMemo(() => new Map(piezas?.map((p) => [p.id, p]) ?? []), [piezas]);
  const delPlano = useMemo(() => new Map(plano.piezas.map((p) => [p.pieza, p])), [plano]);

  return (
    <>
      <primitive object={escena.raiz} />
      {activos.map((id) => {
        const a = escena.nodos.get(id);
        const kp = delKp.get(id);
        return a ? (
          <Etiqueta
            key={id}
            animable={a}
            nombre={kp?.nombre}
            numeroKp={kp?.etiquetaManual}
            origen={textoEtiquetaPieza(delPlano.get(id) ?? {})}
            reservado={reservado}
            id={id}
            registro={etiquetas}
          />
        ) : null;
      })}
      <SombraDeContacto
        key={escena.raiz.uuid} // con las piezas nuevas, la sombra se vuelve a calcular
        position={[0, escena.piso - 0.05, 0]}
        scale={escena.radio * 3}
        far={escena.radio}
        frames={sombrasEnVivo ? Infinity : 1}
      />
      <CameraControls ref={controles} makeDefault smoothTime={0.55} minDistance={4} maxDistance={escena.radio * 8} />
    </>
  );
}

/**
 * La sombra de contacto de drei dibuja en su propia textura sin limpiarla: confía en `autoClear`. El
 * posprocesado (EffectComposer) lo apaga, y entonces la textura queda opaca y el piso se ve como un
 * trapecio oscuro sobre el fondo de la app (con el lienzo transparente, #135). Se prende solo mientras
 * se dibuja la sombra y después vuelve a como estaba. Las tres partes se montan juntas, en este orden.
 */
function SombraDeContacto(props: { position: [number, number, number]; scale: number; far: number; frames: number }) {
  const previoRef = useRef(true);
  return (
    <>
      <Limpieza fase="antes" previoRef={previoRef} />
      <ContactShadows {...props} opacity={0.6} blur={2.4} />
      <Limpieza fase="despues" previoRef={previoRef} />
    </>
  );
}

function Limpieza({ fase, previoRef }: { fase: "antes" | "despues"; previoRef: { current: boolean } }) {
  useFrame(({ gl }) => {
    if (fase === "antes") {
      previoRef.current = gl.autoClear;
      gl.autoClear = true;
    } else gl.autoClear = previoRef.current;
  });
  return null;
}

// ---------- Etiquetas con línea guía ----------

/** Franja de abajo del lienzo con los botones de ícono (opciones del 3D; en la guía, charla y "¿de dónde sale?"): las etiquetas no se meten ahí. */
const RESERVADO_ABAJO_PX = 60;
const lienzoEtiquetas = (tam: { width: number; height: number }) => ({ width: tam.width, height: Math.max(tam.height - RESERVADO_ABAJO_PX, 0) });

type EtiquetaProps = {
  animable: NodoAnimable;
  nombre?: string;
  numeroKp?: string;
  /** Si la ubicación sale del manual, de dónde (ej. "Manual · HMM p. 54"); si no, null: solo el nombre (#209). */
  origen: string | null;
  /** Px de arriba del lienzo tapados por la frase: la etiqueta nunca se mete ahí. */
  reservado: { current: number };
  id: string;
  /** Donde la etiqueta se anota para que la escena la acomode junto con las otras (ver `separarEtiquetas`). */
  registro: { current: Map<string, RegistroEtiqueta> };
};

/** Lo que la escena necesita de cada etiqueta: dónde quiere ir y cómo moverla. */
type RegistroEtiqueta = {
  medir: () => { ancla: { x: number; y: number }; u: UbicacionEtiqueta; ancho: number; alto: number } | null;
  /** Esquina del recuadro relativa a la pieza, ya acomodada. */
  aplicar: (caja: { x: number; y: number }) => void;
};

/**
 * Etiqueta anclada arriba de la pieza. La línea guía y el recuadro se dibujan en px de pantalla
 * hacia el lado donde entran (`ladoEtiqueta`): arriba a la derecha si se puede; abajo si arriba
 * se encimaría con la frase; a la izquierda si a la derecha se sale del lienzo.
 */
function Etiqueta({ animable, nombre, numeroKp, origen, reservado, id, registro }: EtiquetaProps) {
  const datos = animable.nodo.userData as DatosPieza;
  const numero = datos.etiquetaManual ?? numeroKp;
  const base = animable.principal.position;
  const desde: [number, number, number] = [base.x, base.y + datos.dim[1] / 2, base.z];
  const camara = useThree((st) => st.camera);
  const tam = useThree((st) => st.size);
  const caja = useRef<HTMLDivElement>(null);
  const linea = useRef<SVGLineElement>(null);
  const lado = useRef<LadoEtiqueta | undefined>(undefined);
  const cambio = useRef<CambioLado>({ h: -Infinity, v: -Infinity });
  /** Dónde está dibujado el recuadro (relativo a la pieza) y cuándo, para suavizar el movimiento. */
  const dibujada = useRef<{ x: number; y: number; t: number } | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Cada cuadro, la escena pregunta dónde cae la pieza en pantalla y dónde iría el recuadro (adentro del
  // lienzo, sin saltar de lado), los acomoda con los de las otras etiquetas y escribe el resultado en el DOM.
  const punto = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const mapa = registro.current;
    mapa.set(id, {
      medir: () => {
        const el = caja.current;
        if (!el) return null;
        punto.set(...desde);
        animable.nodo.localToWorld(punto).project(camara);
        const ancla = { x: ((punto.x + 1) / 2) * tam.width, y: ((1 - punto.y) / 2) * tam.height };
        const etiqueta = { ancho: el.offsetWidth, alto: el.offsetHeight };
        const u = colocarEtiqueta(ancla, etiqueta, lienzoEtiquetas(tam), reservado.current, lado.current, { ahora: performance.now(), cambio: cambio.current });
        lado.current = u.lado;
        cambio.current = u.cambio;
        return { ancla, u, ...etiqueta };
      },
      aplicar: (objetivo) => {
        const el = caja.current;
        if (!el) return;
        // Sigue a la pieza al girar (es relativo a ella); lo que se suaviza es el cambio de lugar del recuadro.
        const t = performance.now();
        const previa = dibujada.current;
        const c = suavizar(previa, objetivo, previa ? t - previa.t : 0);
        dibujada.current = { ...c, t };
        el.style.left = `${c.x}px`;
        el.style.top = `${c.y}px`;
        // La línea guía va al punto del recuadro más cercano a la pieza (el recuadro pudo correrse).
        const cerca = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
        linea.current?.setAttribute("x2", String(cerca(0, c.x, c.x + el.offsetWidth)));
        linea.current?.setAttribute("y2", String(cerca(0, c.y, c.y + el.offsetHeight)));
      },
    });
    return () => void mapa.delete(id);
  });

  return createPortal(
    <Html position={desde} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div style={{ opacity: visible ? 1 : 0, transition: "opacity 300ms ease-out" }}>
        <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <line ref={linea} x1={0} y1={0} x2={LINEA_ETIQUETA.dx} y2={-LINEA_ETIQUETA.dy} stroke={CSS_ACTIVO} strokeWidth={1.5} strokeOpacity={0.9} />
          <circle cx={0} cy={0} r={2.5} fill={CSS_ACTIVO} />
        </svg>
        <div
          ref={caja}
          className="absolute flex items-center gap-1.5 whitespace-nowrap rounded-md border bg-superficie/90 py-1 pl-1 pr-2 text-xs font-medium text-texto shadow-lg"
          style={{ left: LINEA_ETIQUETA.dx, top: -LINEA_ETIQUETA.dy, borderColor: CSS_ACTIVO }}
        >
          {numero && (
            <span
              className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-black"
              style={{ background: CSS_ACTIVO }}
            >
              {numero}
            </span>
          )}
          <span className={`flex flex-col leading-tight ${numero ? "" : "pl-1"}`}>
            <span>{nombre ?? nombreLegible(datos.pieza)}</span>
            {origen && <span className="text-[10px] font-normal text-texto-suave">{origen}</span>}
          </span>
        </div>
      </div>
    </Html>,
    animable.nodo,
  );
}

function nombreLegible(id: string) {
  const s = id.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function eventoAviso(aviso: string, casoId: string): Evento {
  return {
    id: `ev-plano-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    casoId,
    agente: "cartografo",
    tipo: "plano_corregido",
    mensaje: aviso,
    ts: new Date().toISOString(),
  };
}
