"use client";

import { useState } from "react";
import { coreografiaEjemplo, knowledgePackEjemplo, planoEjemplo, type Coreografia, type Evento } from "../../shared";
import { planoNotebookBase } from "../../lib/planogenerator";
import type { PasoPreparado } from "./paso";
import { Visor, type ModoEfectos } from "./Visor";

/** Banco de pruebas del visor: reproduce el fixture y acciones sueltas. */

const PLANOS = { plantilla: planoNotebookBase, fixture: planoEjemplo } as const;

const paso = (dice: string, acciones: Coreografia["acciones"]): Coreografia => ({
  paso: 1,
  dice,
  riesgo: "bajo",
  acciones,
});

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

export function LabVisor() {
  const [planoId, setPlanoId] = useState<keyof typeof PLANOS>("plantilla");
  const [coreografia, setCoreografia] = useState<Coreografia | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [filtrado, setFiltrado] = useState<PasoPreparado | null>(null);
  const [efectos, setEfectos] = useState<ModoEfectos>("auto");
  const [efectosActivos, setEfectosActivos] = useState(true);
  const plano = PLANOS[planoId];
  // Copia nueva en cada clic: así el mismo paso se puede reproducir otra vez.
  const reproducir = (c: Coreografia) => setCoreografia({ ...c });

  return (
    <main className="flex min-h-screen flex-col bg-black text-neutral-100 md:flex-row">
      <Visor
        className="h-[60vh] w-full md:h-screen md:flex-1"
        plano={plano}
        coreografia={coreografia}
        casoId="caso-demo-1"
        onEvento={(e) => setEventos((prev) => [e, ...prev].slice(0, 20))}
        onPaso={setFiltrado}
        piezas={knowledgePackEjemplo.piezas}
        efectos={efectos}
        onEfectos={setEfectosActivos}
      />
      <aside className="flex w-full flex-col gap-4 p-4 text-sm md:w-80">
        <h1 className="text-lg font-semibold">Lab · visor 3D</h1>
        <div className="flex gap-2">
          {(Object.keys(PLANOS) as Array<keyof typeof PLANOS>).map((id) => (
            <Boton key={id} activo={id === planoId} onClick={() => { setPlanoId(id); setCoreografia(null); }}>
              {id}
            </Boton>
          ))}
        </div>

        <Seccion titulo={`Efectos (bloom ${efectosActivos ? "encendido" : "apagado"})`}>
          {(["auto", "si", "no"] as const).map((m) => (
            <Boton key={m} activo={m === efectos} onClick={() => setEfectos(m)}>{m}</Boton>
          ))}
        </Seccion>

        <Seccion titulo="Coreografía del fixture">
          {coreografiaEjemplo.map((c) => (
            <Boton key={c.paso} onClick={() => reproducir(c)}>Paso {c.paso}</Boton>
          ))}
        </Seccion>

        <Seccion titulo="Acciones sueltas">
          {EXTRAS.map(([nombre, c]) => (
            <Boton key={nombre} onClick={() => reproducir(c)}>{nombre}</Boton>
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
