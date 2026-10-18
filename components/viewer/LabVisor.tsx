"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  PlanoDePiezas,
  coreografiaEjemplo,
  knowledgePackEjemplo,
  planoEjemplo,
  type Coreografia,
  type Evento,
} from "../../shared";
import { planoNotebookBase } from "../../lib/planogenerator";
import { ES_TAPA } from "../../lib/planogenerator/cubiertas";
import { EJEMPLOS } from "./ejemplos";
import { CLAVE_PLANO_GUARDADO } from "./lab-guardado";
import type { PasoPreparado } from "./paso";
import { Visor, type ModoEfectos } from "./Visor";

/** Banco de pruebas del visor: reproduce el fixture y acciones sueltas. */

const PLANOS: Record<string, { plano: PlanoDePiezas; tipoEquipo?: string; coreografia?: Coreografia[] }> = {
  plantilla: { plano: planoNotebookBase },
  fixture: { plano: planoEjemplo },
  ...EJEMPLOS,
};
type IdPlano = string;

const paso = (dice: string, acciones: Coreografia["acciones"]): Coreografia => ({
  paso: 1,
  dice,
  riesgo: "bajo",
  acciones,
});

/** "Abrir tapa" con la tapa del plano que se muestra (la del celular, la de la consola…), no siempre la de notebook. */
const conLaTapaDe = (c: Coreografia, plano: PlanoDePiezas): Coreografia => {
  const tapa = plano.piezas.find((p) => p.padre && ES_TAPA.test(p.pieza))?.pieza;
  return tapa ? { ...c, acciones: c.acciones.map((a) => (a.t === "rotar" ? { ...a, pieza: tapa } : a)) } : c;
};

const EXTRAS: Array<[string, Coreografia]> = [
  ["Abrir tapa", paso("Sacá la tapa inferior.", [
    { t: "camara", objetivo: "general" },
    { t: "rotar", pieza: "tapa_inferior", eje: "x", grados: -100 },
  ])],
  ["Despiezar", paso("Así se separa todo.", [{ t: "despiezar", cantidad: 1 }, { t: "camara", objetivo: "general" }])],
  ["Ocultar batería", paso("Escondo la batería.", [{ t: "ocultar", pieza: "bateria" }])],
  ["Pieza inexistente", paso("Esta pieza no existe.", [{ t: "resaltar", pieza: "condensador_de_flujo" }])],
  ["Paso peligroso", paso("Ahora abrí la batería con un destornillador.", [
    { t: "camara", objetivo: "bateria", zoom: 1.5 },
    { t: "resaltar", pieza: "bateria" },
    { t: "desplazar", pieza: "bateria", vec: [0, 5, 0] },
  ])],
  ["Restaurar", paso("Vuelvo todo a su lugar.", [{ t: "restaurar" }, { t: "camara", objetivo: "general" }])],
];

function leerGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE_PLANO_GUARDADO);
  } catch {
    return null;
  }
}

function planoGuardado(texto: string | null): { plano: PlanoDePiezas; tipoEquipo?: string } | null {
  if (!texto) return null;
  try {
    const d = JSON.parse(texto);
    return { plano: PlanoDePiezas.parse(d.plano), tipoEquipo: typeof d.tipoEquipo === "string" ? d.tipoEquipo : undefined };
  } catch (e) {
    console.warn("[lab] el plano guardado no es válido:", e);
    return null;
  }
}

/** `planoInicial`: uno de PLANOS (ej. `/lab/visor?plano=heladera`, para capturas) o "guardado". */
export function LabVisor({ planoInicial }: { planoInicial?: string }) {
  const [planoId, setPlanoId] = useState<IdPlano>(planoInicial && planoInicial in PLANOS ? planoInicial : "plantilla");
  const textoGuardado = useSyncExternalStore(
    () => () => {},
    () => (planoInicial === "guardado" ? leerGuardado() : null),
    () => null,
  );
  const guardado = useMemo(() => planoGuardado(textoGuardado), [textoGuardado]);
  const [generado, setGenerado] = useState<PlanoDePiezas | null>(null);
  const [estadoGenerador, setEstadoGenerador] = useState("");
  const [pegado, setPegado] = useState("");
  const [coreografia, setCoreografia] = useState<Coreografia | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [filtrado, setFiltrado] = useState<PasoPreparado | null>(null);
  const [efectos, setEfectos] = useState<ModoEfectos>("auto");
  const [efectosActivos, setEfectosActivos] = useState(true);
  const elegido: (typeof PLANOS)[string] =
    planoId === "generado" && generado ? { plano: generado } : guardado && planoInicial === "guardado" && planoId === "plantilla" ? guardado : (PLANOS[planoId] ?? PLANOS.plantilla);
  const plano = elegido.plano;
  const usarGenerado = (p: PlanoDePiezas) => {
    setGenerado(p);
    setPlanoId("generado");
    setCoreografia(null);
  };
  const generarConIA = async () => {
    setEstadoGenerador("Generando…");
    try {
      const res = await fetch("/api/plano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ casoId: "caso-demo-1", knowledgePack: knowledgePackEjemplo }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? res.statusText);
      usarGenerado(PlanoDePiezas.parse(datos.plano));
      setEventos((prev) => [...datos.eventos, ...prev].slice(0, 20));
      setEstadoGenerador(`Listo (${datos.origen}, ${datos.avisos.length} avisos).`);
    } catch (e) {
      setEstadoGenerador(`Error: ${(e as Error).message}`);
    }
  };
  const usarPegado = () => {
    try {
      usarGenerado(PlanoDePiezas.parse(JSON.parse(pegado)));
      setEstadoGenerador("Plano pegado.");
    } catch {
      setEstadoGenerador("El texto no es un PlanoDePiezas válido.");
    }
  };
  // Copia nueva en cada clic: así el mismo paso se puede reproducir otra vez.
  const reproducir = (c: Coreografia) => setCoreografia({ ...c });

  return (
    <main className="flex min-h-screen flex-col bg-black text-neutral-100 md:flex-row">
      <Medidor efectos={efectosActivos} />
      <Visor
        className="h-[60vh] w-full md:h-screen md:flex-1"
        plano={plano}
        coreografia={coreografia}
        casoId="caso-demo-1"
        onEvento={(e) => setEventos((prev) => [e, ...prev].slice(0, 20))}
        onPaso={setFiltrado}
        piezas={knowledgePackEjemplo.piezas}
        tipoEquipo={elegido.tipoEquipo}
        efectos={efectos}
        onEfectos={setEfectosActivos}
      />
      <aside className="flex w-full flex-col gap-4 p-4 text-sm md:w-80">
        <h1 className="text-lg font-semibold">Lab · visor 3D</h1>
        <div className="flex flex-wrap gap-2">
          {[...Object.keys(PLANOS), ...(generado ? ["generado"] : [])].map((id) => (
            <Boton key={id} activo={id === planoId} onClick={() => { setPlanoId(id); setCoreografia(null); }}>
              {id}
            </Boton>
          ))}
        </div>

        <Seccion titulo="Generador desde el manual (B4)">
          <Boton onClick={generarConIA}>Generar con IA (gasta créditos)</Boton>
          <textarea
            value={pegado}
            onChange={(e) => setPegado(e.target.value)}
            placeholder="…o pegá un plano JSON"
            className="h-16 w-full rounded bg-neutral-900 p-2 font-mono text-xs"
          />
          <Boton onClick={usarPegado}>Usar plano pegado</Boton>
          {estadoGenerador && <p className="w-full text-xs text-neutral-400">{estadoGenerador}</p>}
        </Seccion>

        <Seccion titulo={`Efectos (bloom ${efectosActivos ? "encendido" : "apagado"})`}>
          {(["auto", "si", "no"] as const).map((m) => (
            <Boton key={m} activo={m === efectos} onClick={() => setEfectos(m)}>{m}</Boton>
          ))}
        </Seccion>

        <Seccion titulo={elegido.coreografia ? `Coreografía de ${planoId}` : "Coreografía del fixture"}>
          {(elegido.coreografia ?? coreografiaEjemplo).map((c) => (
            <Boton key={c.paso} onClick={() => reproducir(c)}>Paso {c.paso}</Boton>
          ))}
        </Seccion>

        <Seccion titulo="Acciones sueltas">
          {EXTRAS.map(([nombre, c]) => (
            <Boton key={nombre} onClick={() => reproducir(nombre === "Abrir tapa" ? conLaTapaDe(c, plano) : c)}>{nombre}</Boton>
          ))}
        </Seccion>

        <Seccion titulo="Resaltar pieza">
          {plano.piezas.map((p) => (
            <Boton key={p.pieza} onClick={() => reproducir(paso(p.pieza, [
              { t: "camara", objetivo: p.pieza, zoom: 1.4 },
              { t: "resaltar", pieza: p.pieza },
            ]))}>
              {p.pieza}
            </Boton>
          ))}
        </Seccion>

        {coreografia && filtrado && (
          <p className={`rounded p-3 ${filtrado.evaluacion.bloqueado ? "bg-red-950 text-red-100" : "bg-neutral-900"}`}>
            “{filtrado.coreografia.dice}”
            {filtrado.coreografia.cita && (
              <span className="block pt-1 text-xs text-neutral-400">
                {filtrado.coreografia.cita.doc}, pág. {filtrado.coreografia.cita.pagina} · {filtrado.coreografia.cita.estado}
              </span>
            )}
          </p>
        )}

        <Seccion titulo="Eventos">
          <ul className="w-full space-y-1 text-xs text-neutral-400">
            {eventos.length === 0 && <li>Sin eventos.</li>}
            {eventos.map((e) => <li key={e.id}>[{e.tipo}] {e.mensaje}</li>)}
          </ul>
        </Seccion>
      </aside>
    </main>
  );
}

/**
 * Para medir en un celular de verdad (la placa de video de la Mac no se puede frenar): cuadros por
 * segundo del último segundo y el peor desde que abrió, la densidad del lienzo (baja a 1 si el visor no
 * llega a 30 fps) y si siguen los efectos (se apagan primero). No tapa los toques.
 */
const SEGUNDOS_DE_CARGA = 2;

function Medidor({ efectos }: { efectos: boolean }) {
  const [m, setM] = useState({ fps: 0, peor: 0, densidad: 0 });
  useEffect(() => {
    let cuadros = 0;
    let segundos = 0;
    let desde = performance.now();
    let peor = 0;
    let id = requestAnimationFrame(function cuadro(t) {
      cuadros++;
      if (t - desde >= 1000) {
        const fps = Math.round((cuadros * 1000) / (t - desde));
        // Los primeros segundos (mientras carga) no cuentan para el peor.
        if (++segundos > SEGUNDOS_DE_CARGA) peor = peor ? Math.min(peor, fps) : fps;
        const lienzo = document.querySelector("canvas");
        const densidad = lienzo ? +(lienzo.width / Math.max(lienzo.getBoundingClientRect().width, 1)).toFixed(1) : 0;
        setM({ fps, peor, densidad });
        cuadros = 0;
        desde = t;
      }
      id = requestAnimationFrame(cuadro);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <p className="pointer-events-none fixed right-2 top-2 z-50 rounded-md bg-neutral-900/85 px-2 py-1 font-mono text-[11px] text-neutral-100">
      {m.fps} fps (peor {m.peor}) · densidad {m.densidad} · efectos {efectos ? "sí" : "no"}
    </p>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">{titulo}</h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function Boton({ activo, onClick, children }: { activo?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-3 py-1.5 ${activo ? "bg-orange-500 text-black" : "bg-neutral-800 hover:bg-neutral-700"}`}
    >
      {children}
    </button>
  );
}
