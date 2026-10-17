"use client";

import { useState } from "react";
import { knowledgePackEjemplo, type Evento } from "../../../shared";
import { planoNotebookBase } from "../../../lib/planogenerator";
import { fuenteApi } from "./eventos-chat";
import { GuiaExperto } from "./GuiaExperto";
import { Cerrar, Engranaje, Microfono } from "./iconos";
import { fuenteSimulada } from "./simulada";

/** Banco de pruebas de <GuiaExperto> con el caso del fixture. */
const SUGERIDAS = ["¿Dónde está el SSD?", "Se apaga sola y el ventilador suena fuerte", "¿Cómo abro la batería para cambiarle las celdas?"];

export function LabGuia() {
  const [origen, setOrigen] = useState<"ia" | "plantilla">("ia");
  const [real, setReal] = useState(false);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [dictada, setDictada] = useState<{ texto: string; id: number }>();
  // En el celular el panel va escondido: así la guía se ve del tamaño que tiene en la app.
  const [panel, setPanel] = useState(false);
  // Cambiar de modo remonta la guía (arranca de nuevo con la pregunta inicial).
  const clave = `${origen}-${real}`;

  return (
    <main className="flex h-dvh flex-col bg-black md:flex-row">
      <GuiaExperto
        key={clave}
        className="min-h-0 flex-1"
        casoId="caso-demo-1"
        pack={knowledgePackEjemplo}
        plano={planoNotebookBase}
        origenPlano={origen}
        preguntaInicial="Se apaga sola a los diez minutos y el ventilador suena muy fuerte."
        fuente={real ? fuenteApi : fuenteSimulada}
        onEvento={(e) => setEventos((p) => [e, ...p].slice(0, 12))}
        preguntaDictada={dictada}
        accesorioEntrada={
          // Simula el micrófono: "dicta" la primera pregunta sugerida.
          <button
            type="button"
            aria-label="Hablar (simulado)"
            onClick={() => setDictada((d) => ({ texto: SUGERIDAS[0], id: (d?.id ?? 0) + 1 }))}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-borde text-texto-suave"
          >
            <Microfono />
          </button>
        }
      />
      <button
        type="button"
        aria-label={panel ? "Cerrar el panel de pruebas" : "Abrir el panel de pruebas"}
        aria-expanded={panel}
        onClick={() => setPanel((p) => !p)}
        className="fixed right-3 bottom-24 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/75 text-lg text-white backdrop-blur md:hidden"
      >
        {panel ? <Cerrar /> : <Engranaje />}
      </button>
      <aside
        className={`${panel ? "flex" : "hidden"} fixed inset-x-0 bottom-0 z-30 max-h-[70dvh] flex-col gap-3 overflow-y-auto rounded-t-2xl border-t border-borde bg-fondo p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-texto md:static md:flex md:max-h-none md:w-72 md:rounded-none md:border-t-0 md:border-l md:bg-transparent`}
      >
        <h1 className="font-semibold">Lab · guía del experto</h1>
        <Opcion titulo="Plano" valor={origen} opciones={["ia", "plantilla"]} onCambio={setOrigen} />
        <Opcion
          titulo="Respuestas"
          valor={real ? "API real" : "simuladas"}
          opciones={["simuladas", "API real"]}
          onCambio={(v) => setReal(v === "API real")}
        />
        {real && <p className="text-xs text-probable">Con la API real cada pregunta gasta créditos.</p>}
        <div>
          <h2 className="mb-1 text-xs tracking-wide text-texto-suave uppercase">Preguntas para copiar</h2>
          <ul className="space-y-1 text-xs text-texto-suave">
            {SUGERIDAS.map((s) => (
              <li key={s}>“{s}”</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-1 text-xs tracking-wide text-texto-suave uppercase">Eventos</h2>
          <ul className="space-y-1 text-xs text-texto-suave">
            {eventos.length === 0 && <li>Sin eventos.</li>}
            {eventos.map((e) => (
              <li key={e.id}>
                [{e.tipo}] {e.mensaje}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}

function Opcion<T extends string>({ titulo, valor, opciones, onCambio }: { titulo: string; valor: T | string; opciones: T[]; onCambio: (v: T) => void }) {
  return (
    <div>
      <h2 className="mb-1 text-xs tracking-wide text-texto-suave uppercase">{titulo}</h2>
      <div className="flex gap-2">
        {opciones.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onCambio(o)}
            className={`rounded px-3 py-1.5 ${o === valor ? "bg-acento text-black" : "bg-superficie"}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
