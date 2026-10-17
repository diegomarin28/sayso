"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { GuiaExperto } from "@/components/viewer";
import { callar, hablar } from "@/lib/voice/hablar";
import { useFlujo } from "../_estado/flujo";
import { useRequiereCaso } from "../_estado/requiere-caso";
import { Encabezado } from "../_ui/experto";

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
  const { preparado, plano, agregarEventos } = useFlujo();

  useEffect(() => {
    if (caso && (!preparado || !plano)) router.replace("/preparando");
  }, [caso, preparado, plano, router]);

  useEffect(() => callar, []);

  if (!caso || !preparado || !plano) return null;

  return (
    <main className="flex h-dvh w-full flex-col bg-black">
      <div className="mx-auto w-full max-w-xl shrink-0 px-5 pt-6 pb-3">
        <Encabezado paso={5} />
      </div>
      <GuiaExperto
        className="min-h-0 flex-1"
        casoId={caso.id}
        pack={preparado.pack}
        plano={plano.plano}
        origenPlano={plano.origen}
        manualFileId={preparado.manualFileId}
        // El experto arranca solo, con lo que la persona contó en la pantalla 1.
        preguntaInicial={caso.sintoma}
        decir={decir}
        onEvento={(e) => agregarEventos([e])}
      />
    </main>
  );
}
