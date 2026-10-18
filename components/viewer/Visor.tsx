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
  COLOR_ACTIVO,
  animar,
  continuarAnimacion,
  encuadre,
  colocarEtiqueta,
  LINEA_ETIQUETA,
  liberar,
  piezasResaltadas,
  prepararEscenaSegura,
  type LadoEtiqueta,
  type EscenaPreparada,
  type ModoVista,
  type NodoAnimable,
} from "./escena";
import { resumenOrigen, textoOrigenPieza, textoResumen, todoDelManual } from "./origen";
import { prepararPaso, type PasoPreparado } from "./paso";
import { bajarCalidad, calidadInicial, esNegro, puntosVigia, soporteDe, Vigia, type Calidad } from "./salud";
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
  const [rindeBien, setRindeBien] = useState(true);
  // null hasta conocer el WebGL del equipo (ver salud.ts).
  const [calidad, setCalidad] = useState<Calidad | null>(null);
  const [falla, setFalla] = useState<Falla | null>(null);
  // Cambiar `intento` rearma el lienzo entero (contexto perdido o "Reintentar").
  const [intento, setIntento] = useState(0);
  const [vigiando, setVigiando] = useState(true);
  // Cambiar `ronda` arranca un vigía nuevo (después de bajar la calidad), sin rearmar el lienzo.
  const [ronda, setRonda] = useState(0);
  const efectosActivos = efectos !== "no" && !!calidad?.efectos && (efectos === "si" || rindeBien);
  // Se espera la biblioteca de piezas (o su plazo) para no armar la escena dos veces.
  const biblioteca = useBibliotecaPiezas(plano.piezas.map((p) => p.pieza));
  const soportaWebGL2 = useSoportaWebGL2();
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
      <div className={className} style={{ position: "relative", background: "#000" }}>
        <AvisoVisor falla="sin_webgl" />
      </div>
    );
  }

  return (
    <div className={className} style={{ position: "relative", background: "#000", touchAction: "none" }}>
      <Resguardo key={intento} onError={() => setFalla("error")}>
        <Canvas dpr={[1, 2]} onCreated={alCrear}>
          <color attach="background" args={["#000000"]} />
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
          {efectos === "auto" && (
            <PerformanceMonitor bounds={() => [30, 1000]} flipflops={1} onDecline={() => setRindeBien(false)} />
          )}
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
      {!falla && controles && (
        <p
          className="pointer-events-none absolute bottom-16 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[11px] text-white/80 backdrop-blur"
          title="De dónde sale la ubicación de las piezas del 3D"
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${origen.verificado ? "bg-confirmado" : "bg-probable"}`} />
          <span className="truncate">{origen.texto}</span>
        </p>
      )}
      {controles && (
        <button
          type="button"
          onClick={() => setVista((v) => (v === "perspectiva" ? "isometrica" : "perspectiva"))}
          className="absolute bottom-3 left-3 h-11 rounded-full border border-white/20 bg-black/70 px-4 text-xs text-white backdrop-blur active:scale-95"
        >
          {vista === "perspectiva" ? "Vista isométrica" : "Vista en perspectiva"}
        </button>
      )}
    </div>
  );
}

// ---------- Que nunca quede negro (ver salud.ts) ----------

type Falla = "sin_webgl" | "contexto" | "negro" | "error";

/** Si iOS pierde el contexto y no lo devuelve en este plazo, se arma un lienzo nuevo. */
const ESPERA_CONTEXTO_MS = 2500;
/** Lado de cada cuadrado de la imagen que mira el vigía (px del lienzo; ver `puntosVigia`). */
const LADO_VIGIA = 16;
/** El vigía mira una grilla de 5×5: un equipo con huecos (una impresora sin carcasa) igual cae en algún punto. */
const PUNTOS_VIGIA = 5;

const TEXTO_FALLA: Record<Falla, string> = {
  sin_webgl: "Este navegador no puede mostrar el 3D. La guía sigue funcionando por voz y texto.",
  contexto: "Reiniciando el 3D…",
  negro: "No pude mostrar el 3D en este equipo. La guía sigue funcionando por voz y texto.",
  error: "El 3D tuvo un problema. La guía sigue funcionando por voz y texto.",
};

function AvisoVisor({ falla, onReintentar }: { falla: Falla; onReintentar?: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black px-8 text-center text-sm text-white/80">
      <p>{TEXTO_FALLA[falla]}</p>
      {onReintentar && (
        <button type="button" onClick={onReintentar} className="rounded-full border border-white/30 px-4 py-1.5 text-xs text-white">
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
 * Mira la imagen (una grilla de puntos, ver `puntosVigia`) los primeros segundos (ver `Vigia`). Corre después de los efectos
 * (prioridad 2); con prioridad > 0 R3F deja de dibujar solo, así que sin efectos dibuja él.
 */
function VigiaNegro({ renderizaSolo, onNegro, onListo }: { renderizaSolo: boolean; onNegro: () => void; onListo: () => void }) {
  const vigia = useRef(new Vigia());
  const pixeles = useMemo(() => new Uint8Array(4 * LADO_VIGIA * LADO_VIGIA), []);
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
    // Negro solo si TODA la grilla está negra (un objeto oscuro en el centro no es una falla).
    const negro = puntosVigia(ctx.drawingBufferWidth, ctx.drawingBufferHeight, LADO_VIGIA, PUNTOS_VIGIA).every(([x, y]) => {
      ctx.readPixels(x, y, LADO_VIGIA, LADO_VIGIA, ctx.RGBA, ctx.UNSIGNED_BYTE, pixeles);
      return esNegro(pixeles);
    });
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
  const escena = useMemo(() => prepararEscenaSegura(plano, biblioteca, tipoEquipo), [plano, biblioteca, tipoEquipo]);
  const estado = useRef<EstadoEscena>(estadoInicial(escena.nodos.keys(), escena.cubiertas));
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
      acciones.current.actualizar(estadoInicial(escena.nodos.keys(), escena.cubiertas));
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
    const paso = prepararPaso(coreografia, { casoId });
    paso.eventos.forEach((e) => onEventoRef.current?.(e));
    onPasoRef.current?.(paso);
    const { actualizar } = acciones.current;
    // Un paso que solo vuelve a la vista general cierra el equipo (las tapas vuelven a su lugar).
    const inicio = comenzarPaso(estado.current);
    actualizar(soloVuelveAGeneral(paso.coreografia) ? cerrar(inicio) : inicio);
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
    // Sin `escena`: si llegan las piezas reales a mitad de un paso, el paso sigue (no se repite ni se corta).
  }, [coreografia, casoId, plano, tipoEquipo]);

  useFrame(({ clock }) => animar(escena, estado.current, clock.elapsedTime * 1000));

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
            origen={textoOrigenPieza(delPlano.get(id) ?? {})}
            reservado={reservado}
          />
        ) : null;
      })}
      <ContactShadows
        key={escena.raiz.uuid} // con las piezas nuevas, la sombra se vuelve a calcular
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
  /** De dónde sale la ubicación (ej. "Manual · HMM p. 54", "Estimada", "Genérica"). */
  origen: string;
  /** Px de arriba del lienzo tapados por la frase: la etiqueta nunca se mete ahí. */
  reservado: { current: number };
};

/**
 * Etiqueta anclada arriba de la pieza. La línea guía y el recuadro se dibujan en px de pantalla
 * hacia el lado donde entran (`ladoEtiqueta`): arriba a la derecha si se puede; abajo si arriba
 * se encimaría con la frase; a la izquierda si a la derecha se sale del lienzo.
 */
function Etiqueta({ animable, nombre, numeroKp, origen, reservado }: EtiquetaProps) {
  const datos = animable.nodo.userData as DatosPieza;
  const numero = datos.etiquetaManual ?? numeroKp;
  const base = animable.principal.position;
  const desde: [number, number, number] = [base.x, base.y + datos.dim[1] / 2, base.z];
  const camara = useThree((st) => st.camera);
  const tam = useThree((st) => st.size);
  const caja = useRef<HTMLDivElement>(null);
  const linea = useRef<SVGLineElement>(null);
  const lado = useRef<LadoEtiqueta | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Cada cuadro: dónde cae la pieza en pantalla y dónde va el recuadro (adentro del lienzo, sin
  // saltar de lado). Se escribe directo en el DOM: sin re-render ni transición de posición (no tiembla).
  const punto = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const el = caja.current;
    if (!el) return;
    punto.set(...desde);
    animable.nodo.localToWorld(punto).project(camara);
    const ancla = { x: ((punto.x + 1) / 2) * tam.width, y: ((1 - punto.y) / 2) * tam.height };
    const u = colocarEtiqueta(ancla, { ancho: el.offsetWidth, alto: el.offsetHeight }, tam, reservado.current, lado.current);
    lado.current = u.lado;
    el.style.left = `${u.caja.x}px`;
    el.style.top = `${u.caja.y}px`;
    linea.current?.setAttribute("x2", String(u.punta.x));
    linea.current?.setAttribute("y2", String(u.punta.y));
  });

  return createPortal(
    <Html position={desde} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div style={{ opacity: visible ? 1 : 0, transition: "opacity 300ms ease-out" }}>
        <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <line ref={linea} x1={0} y1={0} x2={LINEA_ETIQUETA.dx} y2={-LINEA_ETIQUETA.dy} stroke={COLOR_ACTIVO} strokeWidth={1.5} strokeOpacity={0.9} />
          <circle cx={0} cy={0} r={2.5} fill={COLOR_ACTIVO} />
        </svg>
        <div
          ref={caja}
          className="absolute flex items-center gap-1.5 whitespace-nowrap rounded-md border bg-black/80 py-1 pl-1 pr-2 text-xs font-medium text-white shadow-lg"
          style={{ left: LINEA_ETIQUETA.dx, top: -LINEA_ETIQUETA.dy, borderColor: COLOR_ACTIVO }}
        >
          {numero && (
            <span
              className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-black"
              style={{ background: COLOR_ACTIVO }}
            >
              {numero}
            </span>
          )}
          <span className={`flex flex-col leading-tight ${numero ? "" : "pl-1"}`}>
            <span>{nombre ?? nombreLegible(datos.pieza)}</span>
            <span className="text-[10px] font-normal text-white/60">{origen}</span>
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
