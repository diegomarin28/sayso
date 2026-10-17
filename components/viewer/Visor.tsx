"use client";

import { CameraControls, ContactShadows } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Coreografia, Evento, PlanoDePiezas, Vec3 } from "../../shared";
import { SUFIJO_MALLA, construirEscena, type DatosPieza } from "../../lib/planogenerator";
import {
  OBJETIVO_GENERAL,
  aplicarAccion,
  comenzarPaso,
  desplazamientoDespiece,
  estadoInicial,
  type EstadoEscena,
} from "./reproductor";

export type VisorProps = {
  plano: PlanoDePiezas;
  /** Cada objeto nuevo se reproduce (aunque sea el mismo paso otra vez). */
  coreografia?: Coreografia | null;
  casoId?: string;
  /** Eventos para el feed de actividad (ej. pieza que no existe en el modelo). */
  onEvento?: (evento: Evento) => void;
  className?: string;
};

/** Pausa entre acciones de un mismo paso, para que se lean como una secuencia. */
const ESPACIO_ENTRE_ACCIONES_MS = 450;
const SUAVIZADO = 6;
const COLOR_RESALTE = new THREE.Color("#ff8a1f");
const FOV = 35;

export function Visor({ plano, coreografia, casoId = "sin-caso", onEvento, className }: VisorProps) {
  return (
    <div className={className} style={{ background: "#000", touchAction: "none" }}>
      <Canvas dpr={[1, 2]} camera={{ fov: FOV, near: 0.5, far: 1000, position: [0, 55, 60] }}>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.6} />
        <hemisphereLight args={["#dde6ef", "#0b0d10", 1.1]} />
        <directionalLight position={[25, 40, 30]} intensity={3} />
        <directionalLight position={[-20, 25, 35]} intensity={1.2} />
        <directionalLight position={[-30, 15, -25]} intensity={1.4} color="#8fb4ff" />
        <Escena plano={plano} coreografia={coreografia} casoId={casoId} onEvento={onEvento} />
      </Canvas>
    </div>
  );
}

type EscenaProps = Required<Pick<VisorProps, "plano" | "casoId">> & Pick<VisorProps, "coreografia" | "onEvento">;

function Escena({ plano, coreografia, casoId, onEvento }: EscenaProps) {
  const controles = useRef<CameraControls>(null);
  const camara = useThree((s) => s.camera);
  const escena = useMemo(() => prepararEscena(plano), [plano]);
  const estado = useRef<EstadoEscena>(estadoInicial(escena.nodos.keys()));
  const onEventoRef = useRef(onEvento);
  useEffect(() => {
    onEventoRef.current = onEvento;
  }, [onEvento]);

  // Plano nuevo: estado en reposo, avisos al feed y liberar la escena anterior al desmontar.
  // (El ref de CameraControls ya está asignado cuando corren los efectos.)
  useEffect(() => {
    estado.current = estadoInicial(escena.nodos.keys());
    for (const aviso of escena.avisos) onEventoRef.current?.(eventoAviso(aviso, casoId));
    if (controles.current) encuadrar(controles.current, camara, escena, OBJETIVO_GENERAL, 1, false);
    return () => liberar(escena.raiz);
  }, [escena, camara, casoId]);

  // Coreografía nueva: limpia resaltados y aplica las acciones una por una.
  useEffect(() => {
    if (!coreografia) return;
    estado.current = comenzarPaso(estado.current);
    const timers = coreografia.acciones.map((accion, i) =>
      setTimeout(() => {
        const r = aplicarAccion(estado.current, accion, { casoId });
        estado.current = r.estado;
        if (r.evento) onEventoRef.current?.(r.evento);
        else if (accion.t === "camara" && controles.current)
          encuadrar(controles.current, camara, escena, accion.objetivo, accion.zoom ?? 1, true);
      }, i * ESPACIO_ENTRE_ACCIONES_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [coreografia, casoId, escena, camara]);

  useFrame(({ clock }, delta) => animar(escena, estado.current, clock.elapsedTime, delta));

  return (
    <>
      <primitive object={escena.raiz} />
      <ContactShadows position={[0, escena.piso - 0.05, 0]} scale={escena.radio * 3} opacity={0.55} blur={2.4} far={escena.radio} />
      <CameraControls
        ref={controles}
        makeDefault
        minDistance={4}
        maxDistance={escena.radio * 8}
      />
    </>
  );
}

// ---------- Preparación de la escena ----------

type NodoAnimable = {
  nodo: THREE.Group;
  malla: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  reposo: THREE.Vector3;
  centroPadre: Vec3 | null;
  opacidadBase: number;
  transparenteBase: boolean;
};

type EscenaPreparada = {
  raiz: THREE.Group;
  nodos: Map<string, NodoAnimable>;
  avisos: string[];
  radio: number;
  piso: number;
};

function prepararEscena(plano: PlanoDePiezas): EscenaPreparada {
  const { raiz, nodos, avisos } = construirEscena(plano);
  const animables = new Map<string, NodoAnimable>();
  for (const [id, nodo] of nodos) {
    const malla = nodo.getObjectByName(id + SUFIJO_MALLA) as NodoAnimable["malla"];
    const padre = nodo.parent?.userData as Partial<DatosPieza> | undefined;
    malla.material.emissive.copy(COLOR_RESALTE);
    malla.material.emissiveIntensity = 0;
    animables.set(id, {
      nodo,
      malla,
      reposo: nodo.position.clone(),
      centroPadre: padre?.centro ?? null,
      opacidadBase: malla.material.opacity,
      transparenteBase: malla.material.transparent,
    });
  }
  const caja = new THREE.Box3().setFromObject(raiz);
  const radio = Math.max(caja.getBoundingSphere(new THREE.Sphere()).radius, 1);
  return { raiz, nodos: animables, avisos, radio, piso: caja.min.y };
}

function liberar(raiz: THREE.Object3D) {
  raiz.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    }
  });
}

// ---------- Animación cuadro a cuadro ----------

const damp = THREE.MathUtils.damp;

function animar(escena: EscenaPreparada, estado: EstadoEscena, t: number, delta: number) {
  const dt = Math.min(delta, 0.1); // si la pestaña estuvo en segundo plano, no saltar
  const latido = 0.6 + 0.3 * Math.sin(t * 5);
  for (const [id, a] of escena.nodos) {
    const e = estado.piezas[id];
    if (!e) continue;
    const centro = (a.nodo.userData as DatosPieza).centro;
    const despiece = desplazamientoDespiece(centro, a.centroPadre, estado.despiece);
    const { position: p, rotation: r } = a.nodo;
    p.x = damp(p.x, a.reposo.x + e.desp[0] + despiece[0], SUAVIZADO, dt);
    p.y = damp(p.y, a.reposo.y + e.desp[1] + despiece[1], SUAVIZADO, dt);
    p.z = damp(p.z, a.reposo.z + e.desp[2] + despiece[2], SUAVIZADO, dt);
    r.x = damp(r.x, e.rot[0], SUAVIZADO, dt);
    r.y = damp(r.y, e.rot[1], SUAVIZADO, dt);
    r.z = damp(r.z, e.rot[2], SUAVIZADO, dt);

    const m = a.malla.material;
    m.opacity = damp(m.opacity, e.visible ? a.opacidadBase : 0, SUAVIZADO, dt);
    const enTransicion = m.opacity < a.opacidadBase - 0.01;
    if (m.transparent !== (a.transparenteBase || enTransicion)) {
      m.transparent = a.transparenteBase || enTransicion;
      m.needsUpdate = true;
    }
    a.malla.visible = m.opacity > 0.01;
    m.emissiveIntensity = damp(m.emissiveIntensity, e.resaltada ? latido : 0, SUAVIZADO * 1.5, dt);
  }
}

// ---------- Cámara ----------

const DIRECCION_VISTA = new THREE.Vector3(0, 1.1, 1).normalize();

function encuadrar(
  controles: CameraControls,
  camara: THREE.Camera,
  escena: EscenaPreparada,
  objetivo: string,
  zoom: number,
  animado: boolean,
) {
  const nodo = objetivo === OBJETIVO_GENERAL ? escena.raiz : escena.nodos.get(objetivo)?.nodo;
  if (!nodo) return;
  const esfera = new THREE.Box3().setFromObject(nodo).getBoundingSphere(new THREE.Sphere());
  const fov = camara instanceof THREE.PerspectiveCamera ? camara.fov : FOV;
  // Una pieza se encuadra con su entorno para que se entienda dónde está.
  const radio = nodo === escena.raiz ? esfera.radius * 0.8 : Math.max(esfera.radius * 2.2, 9);
  const distancia = radio / Math.sin(THREE.MathUtils.degToRad(fov / 2)) / zoom;
  const pos = esfera.center.clone().addScaledVector(DIRECCION_VISTA, Math.max(distancia, 8));
  void controles.setLookAt(pos.x, pos.y, pos.z, esfera.center.x, esfera.center.y, esfera.center.z, animado);
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
