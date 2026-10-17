"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GuiaExperto } from "@/components/viewer";
import { fuenteSimulada } from "@/components/viewer/guia/simulada";
import { callar, hablar } from "@/lib/voice/hablar";
import { useDictado } from "@/lib/voice/useDictado";
import { USAR_FIXTURE } from "../_datos/api";
import { useFlujo } from "../_estado/flujo";
import { useRequiereCaso } from "../_estado/requiere-caso";
import { Encabezado, Microfono } from "../_ui/experto";

/**
 * Pantallas 5 y 6 — Experto en 3D y conversación. Todo lo hace <GuiaExperto> (carril B):
 * visor, chat con el manual, frase que se desvanece, cita y bloqueo de pasos peligrosos.
 * Acá solo se monta con los datos del caso y se le da la voz (C3).
 */

/** La guía espera que la frase se diga entera; si cambia de tema, corta la voz. */
async function decir(texto: string, senal: AbortSignal) {
  if (senal.aborted) return;
  const voz = hablar(texto);
  senal.addEventListener("abort", voz.detener, { once: true });
  await voz.termino;
}

export default function Experto() {
  const router = useRouter();
  const caso = useRequiereCaso();
  const { preparado, plano, agregarEventos, guiaIniciada, marcarGuiaIniciada } = useFlujo();
  // La pregunta inicial se hace una sola vez por caso: al volver a esta pantalla no se repite
  // (ni la llamada a /api/chat ni la voz).
  const [preguntaInicial] = useState(() => (guiaIniciada ? undefined : caso?.sintoma));
  useEffect(() => {
    if (preparado && plano) marcarGuiaIniciada();
  }, [preparado, plano, marcarGuiaIniciada]);

  useEffect(() => {
    if (caso && (!preparado || !plano)) router.replace("/preparando");
  }, [caso, preparado, plano, router]);

  useEffect(() => callar, []);

  // Preguntar con la voz: cada frase dictada se manda como si la hubiera escrito.
  const [dictada, setDictada] = useState<{ texto: string; id: number }>();
  const dictado = useDictado((texto) => setDictada({ texto, id: Date.now() }));

  if (!caso || !preparado || !plano) return null;

  return (
    <main className="flex h-dvh w-full flex-col bg-black">
      <div className="mx-auto w-full max-w-xl shrink-0 px-5 pt-6 pb-3">
        <Encabezado paso={5} alVolver={() => router.push("/preparando")} />
      </div>
      <GuiaExperto
        className="min-h-0 flex-1"
        casoId={caso.id}
        pack={preparado.pack}
        plano={plano.plano}
        origenPlano={plano.origen}
        manualFileId={preparado.manualFileId}
        // El experto arranca solo, con lo que la persona contó en la pantalla 1.
        preguntaInicial={preguntaInicial}
        decir={decir}
        preguntaDictada={dictada}
        // Con NEXT_PUBLIC_DATOS=fixture el experto responde con el chat simulado de Diego: no gasta IA.
        fuente={USAR_FIXTURE ? fuenteSimulada : undefined}
        accesorioEntrada={
          <button
            type="button"
            onClick={() => {
              callar(); // si el experto está hablando, se calla para escuchar
              dictado.alternar();
            }}
            disabled={dictado.conectando}
            aria-pressed={dictado.escuchando}
            aria-label={dictado.escuchando ? "Dejar de escuchar" : "Preguntar con la voz"}
            title={dictado.error ?? (dictado.parcial || undefined)}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition active:scale-95 disabled:opacity-40 ${
              dictado.escuchando ? "animate-pulse bg-peligro text-white" : "border border-borde text-texto"
            }`}
          >
            <Microfono />
          </button>
        }
        onEvento={(e) => agregarEventos([e])}
      />
    </main>
  );
}
