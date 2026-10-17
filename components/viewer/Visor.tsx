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
import { useEffect, useMemo, useRef, useState } from "react";
import type { Coreografia, Evento, Pieza, PlanoDePiezas } from "../../shared";
import type { BibliotecaPiezas, DatosPieza } from "../../lib/planogenerator";
import { useBibliotecaPiezas } from "./biblioteca";
import {
  COLOR_ACTIVO,
  animar,
  encuadre,
  ladoEtiqueta,
  LINEA_ETIQUETA,
  liberar,
  piezasResaltadas,
  prepararEscena,
  type LadoEtiqueta,
  type ModoVista,
  type NodoAnimable,
} from "./escena";
import { prepararPaso, type PasoPreparado } from "./paso";
import { OBJETIVO_GENERAL, aplicarAccion, comenzarPaso, estadoInicial, type EstadoEscena } from "./reproductor";

/** "auto": bloom encendido, se apaga solo si el equipo no sostiene ~30 fps. */
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
  className,
}: VisorProps) {
  const [vista, setVista] = useState<ModoVista>(vistaInicial);
  const [rindeBien, setRindeBien] = useState(true);
  const efectosActivos = efectos === "si" || (efectos === "auto" && rindeBien);
  // Se espera la biblioteca de piezas (o su plazo) para no armar la escena dos veces.
  const biblioteca = useBibliotecaPiezas(plano.piezas.map((p) => p.pieza));

  useEffect(() => {
    onEfectos?.(efectosActivos);
  }, [efectosActivos, onEfectos]);

  return (
    <div className={className} style={{ position: "relative", background: "#000", touchAction: "none" }}>
      <Canvas dpr={[1, 2]}>
        <color attach="background" args={["#000000"]} />
        {vista === "isometrica" ? (
          <OrthographicCamera makeDefault position={[100, 100, 100]} near={0.1} far={2000} zoom={10} />
        ) : (
          <PerspectiveCamera makeDefault position={[0, 55, 60]} fov={FOV} near={0.5} far={1000} />
        )}
        <LuzDeEstudio />
        {biblioteca !== undefined && (
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
        {efectos === "auto" && (
          <PerformanceMonitor bounds={() => [30, 1000]} flipflops={1} onDecline={() => setRindeBien(false)} />
        )}
        {efectosActivos && (
          <EffectComposer multisampling={4}>
            <Bloom mipmapBlur luminanceThreshold={0.8} luminanceSmoothing={0.2} intensity={1.2} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
        )}
      </Canvas>
      <button
        type="button"
        onClick={() => setVista((v) => (v === "perspectiva" ? "isometrica" : "perspectiva"))}
        className="absolute bottom-3 left-3 h-11 rounded-full border border-white/20 bg-black/70 px-4 text-xs text-white backdrop-blur active:scale-95"
      >
        {vista === "perspectiva" ? "Vista isométrica" : "Vista en perspectiva"}
      </button>
    </div>
  );
}

/** Luz de estudio armada con paneles (sin descargar HDRIs: el Wi-Fi del evento no es confiable). */
function LuzDeEstudio() {
  return (
    <>
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 40, 0]} rotation-x={Math.PI / 2} scale={[60, 30, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[-40, 12, 15]} rotation-y={Math.PI / 2} scale={[40, 12, 1]} />
        <Lightformer form="rect" intensity={1} position={[40, 12, -15]} rotation-y={-Math.PI / 2} scale={[40, 12, 1]} />
        <Lightformer form="ring" color="#9fc0ff" intensity={0.8} position={[0, 15, -45]} scale={25} />
      </Environment>
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
  const escena = useMemo(() => prepararEscena(plano, biblioteca ?? undefined, tipoEquipo), [plano, biblioteca, tipoEquipo]);
  const estado = useRef<EstadoEscena>(estadoInicial(escena.nodos.keys()));
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
      const e = encuadre(escena, objetivo, zoom, camara, tam, estado.current.despiece, reservado.current);
      void c.setLookAt(e.posicion.x, e.posicion.y, e.posicion.z, e.objetivo.x, e.objetivo.y, e.objetivo.z, animado);
      // Corre la vista para que la pieza quede en el centro de lo que no tapa la frase.
      void c.setFocalOffset(0, e.focal, 0, animado);
      if (e.zoomOrto !== null) void c.zoomTo(e.zoomOrto, animado);
    };
  }, [escena, camara, tam]);

  // Plano nuevo: estado en reposo, avisos al feed y liberar la escena anterior al desmontar.
  useEffect(() => {
    acciones.current.actualizar(estadoInicial(escena.nodos.keys()));
    for (const aviso of escena.avisos) onEventoRef.current?.(eventoAviso(aviso, casoId));
    return () => liberar(escena.raiz);
  }, [escena, casoId]);

  // Cámara nueva (cambio de vista) o plano nuevo: reencuadrar sin tocar el estado de las piezas.
  // (El ref de CameraControls ya está asignado cuando corren los efectos.)
  useEffect(() => {
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
    const paso = prepararPaso(coreografia, { casoId });
    paso.eventos.forEach((e) => onEventoRef.current?.(e));
    onPasoRef.current?.(paso);
    const { actualizar } = acciones.current;
    actualizar(comenzarPaso(estado.current));
    const timers = paso.coreografia.acciones.map((accion, i) =>
      setTimeout(() => {
        const r = aplicarAccion(estado.current, accion, { casoId });
        actualizar(r.estado);
        if (r.evento) onEventoRef.current?.(r.evento);
        else if (accion.t === "camara") acciones.current.mirar(accion.objetivo, accion.zoom ?? 1, true);
        else if (accion.t === "restaurar") acciones.current.mirar(OBJETIVO_GENERAL, 1, true);
      }, i * ESPACIO_ENTRE_ACCIONES_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [coreografia, casoId, escena]);

  useFrame(({ clock }) => animar(escena, estado.current, clock.elapsedTime * 1000));

  const delKp = useMemo(() => new Map(piezas?.map((p) => [p.id, p]) ?? []), [piezas]);

  return (
    <>
      <primitive object={escena.raiz} />
      {activos.map((id) => {
        const a = escena.nodos.get(id);
        const kp = delKp.get(id);
        return a ? (
          <Etiqueta key={id} animable={a} nombre={kp?.nombre} numeroKp={kp?.etiquetaManual} reservado={reservado} />
        ) : null;
      })}
      <ContactShadows
        position={[0, escena.piso - 0.05, 0]}
        scale={escena.radio * 3}
        opacity={0.6}
        blur={2.4}
        far={escena.radio}
        frames={sombrasEnVivo ? Infinity : 1}
      />
      <CameraControls ref={controles} makeDefault smoothTime={0.55} minDistance={4} maxDistance={escena.radio * 8} />
    </>
  );
}

// ---------- Etiquetas con línea guía ----------

type EtiquetaProps = {
  animable: NodoAnimable;
  nombre?: string;
  numeroKp?: string;
  /** Px de arriba del lienzo tapados por la frase: la etiqueta nunca se mete ahí. */
  reservado: { current: number };
};

/**
 * Etiqueta anclada arriba de la pieza. La línea guía y el recuadro se dibujan en px de pantalla
 * hacia el lado donde entran (`ladoEtiqueta`): arriba a la derecha si se puede; abajo si arriba
 * se encimaría con la frase; a la izquierda si a la derecha se sale del lienzo.
 */
function Etiqueta({ animable, nombre, numeroKp, reservado }: EtiquetaProps) {
  const datos = animable.nodo.userData as DatosPieza;
  const numero = datos.etiquetaManual ?? numeroKp;
  const base = animable.principal.position;
  const desde: [number, number, number] = [base.x, base.y + datos.dim[1] / 2, base.z];
  const camara = useThree((st) => st.camera);
  const tam = useThree((st) => st.size);
  const caja = useRef<HTMLDivElement>(null);
  const [lado, setLado] = useState<LadoEtiqueta>({ h: "derecha", v: "arriba" });
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const punto = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (!caja.current) return;
    punto.set(...desde);
    animable.nodo.localToWorld(punto).project(camara);
    const ancla = { x: ((punto.x + 1) / 2) * tam.width, y: ((1 - punto.y) / 2) * tam.height };
    const nuevo = ladoEtiqueta(ancla, { ancho: caja.current.offsetWidth, alto: caja.current.offsetHeight }, tam, reservado.current);
    setLado((l) => (l.h === nuevo.h && l.v === nuevo.v ? l : nuevo));
  });

  const sx = lado.h === "derecha" ? 1 : -1;
  const sy = lado.v === "arriba" ? -1 : 1;
  const { dx, dy } = LINEA_ETIQUETA;
  return createPortal(
    <Html position={desde} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div style={{ opacity: visible ? 1 : 0, transition: "opacity 300ms ease-out" }}>
        <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <line x1={0} y1={0} x2={sx * dx} y2={sy * dy} stroke={COLOR_ACTIVO} strokeWidth={1.5} strokeOpacity={0.9} />
          <circle cx={0} cy={0} r={2.5} fill={COLOR_ACTIVO} />
        </svg>
        <div
          ref={caja}
          className="absolute flex items-center gap-1.5 whitespace-nowrap rounded-md border bg-black/80 py-1 pl-1 pr-2 text-xs font-medium text-white shadow-lg"
          style={{
            left: sx * dx,
            top: sy * dy,
            borderColor: COLOR_ACTIVO,
            transform: `translate(${sx > 0 ? 0 : -100}%, ${sy < 0 ? -100 : 0}%) translateY(${visible ? 0 : sy * -6}px)`,
            transition: "transform 300ms ease-out",
          }}
        >
          {numero && (
            <span
              className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-black"
              style={{ background: COLOR_ACTIVO }}
            >
              {numero}
            </span>
          )}
          <span className={numero ? "" : "pl-1"}>{nombre ?? nombreLegible(datos.pieza)}</span>
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
