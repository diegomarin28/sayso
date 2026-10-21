"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fuenteApi, GuiaExperto } from "@/components/viewer";
import { fuenteSimulada } from "@/components/viewer/guia/simulada";
import { callar, desbloquearAudio, hablar } from "@/lib/voice/hablar";
import { avisoRiesgoAlto } from "./aviso-riesgo";
import { useDictado } from "@/lib/voice/useDictado";
import { USAR_FIXTURE } from "../_datos/api";
import { useFlujo } from "../_estado/flujo";
import { useRequiereCaso } from "../_estado/requiere-caso";
import { Detener, Encabezado, Microfono, Papelera } from "../_ui/experto";
import { Volviendo } from "../_ui/volviendo";
import {
  fuenteConCierre,
  fuenteConRetomar,
  PanelCierre,
  pasosAlRetomar,
  preguntaAlRetomar,
} from "./cierre";
import { Repuestos } from "./repuestos";
import { AyudaExperto, useAyudaExperto } from "./ayuda";

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

/**
 * Next guarda las pantallas ya visitadas con su estado (cacheComponents usa <Activity>). El experto
 * arranca de nuevo con cada navegación (`bfcacheId`): si no, al retomar un caso desde "Mis casos"
 * volvía con el panel de cierre abierto y sin seguir desde el repuesto. Con "atrás" del navegador sí
 * se conserva.
 */
export default function Experto() {
  const { bfcacheId } = useRouter();
  return <ExpertoDelCaso key={bfcacheId} />;
}

function ExpertoDelCaso() {
  const router = useRouter();
  const caso = useRequiereCaso();
  const {
    ficha,
    preparado,
    plano,
    agregarEventos,
    guiaIniciada,
    marcarGuiaIniciada,
    tipoEquipo,
    cierre,
    cerrarCaso,
    ultimaCompra,
    setUltimaCompra,
  } = useFlujo();
  const [cerrando, setCerrando] = useState(false);
  const [ayuda, cerrarAyuda] = useAyudaExperto();
  // Al retomar desde "Mis casos" un caso que esperaba el repuesto, el experto sigue desde el paso
  // de cambiar esa pieza con la guía guardada (sin IA). Si no, la pregunta inicial es el síntoma,
  // una sola vez por caso: al volver a esta pantalla no se repite (ni /api/chat ni la voz).
  const [arranque] = useState(() => {
    const base = USAR_FIXTURE ? fuenteSimulada : fuenteApi;
    if (cierre?.estado === "esperando_repuesto" && cierre.pieza && preparado && plano) {
      const pregunta = preguntaAlRetomar(preparado.pack, cierre.pieza);
      const pasos = pasosAlRetomar(preparado.pack, plano.plano, cierre.pieza);
      return { pregunta, fuente: fuenteConRetomar(base, pregunta, pasos) };
    }
    const pregunta = guiaIniciada ? undefined : caso?.sintoma;
    // La guía del síntoma termina con probar el equipo y, si sigue igual, la pieza a cambiar:
    // "Siguiente" llega hasta que se resuelve o no quedan pasos.
    if (caso && preparado && plano)
      return { pregunta, fuente: fuenteConCierre(base, caso.sintoma, preparado.pack, plano.plano) };
    return { pregunta, fuente: base };
  });
  const preguntaInicial = arranque.pregunta;
  useEffect(() => {
    if (preparado && plano) marcarGuiaIniciada();
  }, [preparado, plano, marcarGuiaIniciada]);

  useEffect(() => {
    if (caso && (!preparado || !plano)) router.replace("/preparando");
  }, [caso, preparado, plano, router]);

  useEffect(() => callar, []);

  // Preguntar con la voz: cada frase dictada se manda como si la hubiera escrito.
  const [dictada, setDictada] = useState<{ texto: string; id: number }>();
  // Pantalla 6: la pieza que el experto dijo que hay que cambiar (abre las compras).
  const [piezaACambiar, setPiezaACambiar] = useState<string | null>(null);
  /** El lugar de la derecha (pantalla ancha) donde la guía pone el chat, de arriba a abajo. */
  const [destinoChat, setDestinoChat] = useState<HTMLDivElement | null>(null);
  const dictado = useDictado((texto) => setDictada({ texto, id: Date.now() }));

  if (!caso) return <Volviendo />;
  if (!preparado || !plano)
    return <Volviendo texto="Todavía falta preparar tu guía. Te llevo ahí…" destino="/preparando" boton="Ir a la guía" />;
  // Antes del primer paso: hasta dónde llega la guía si el pack tiene un paso de riesgo alto (sin IA).
  const aviso = avisoRiesgoAlto(preparado.pack);

  return (
    // En pantallas anchas, a la derecha de todo (al lado del encabezado) va el chat con el experto.
    <main className="flex h-dvh w-full bg-fondo">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto w-full max-w-5xl shrink-0 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sm:px-6 md:pt-6">
          <div className="flex items-center gap-3">
            {/* "Atrás", repuestos y "Terminar" van en esta fila: debajo le sacarían lugar al 3D (#199).
                Atrás y repuestos van en los lugares fijos del encabezado, como en las otras pantallas. */}
            <div className="min-w-0 flex-1">
              <Encabezado
                paso={5}
                alVolver={() => router.push("/preparando")}
                accion={
                  ficha && (
                    <Repuestos
                      pack={preparado.pack}
                      ficha={ficha}
                      casoId={caso.id}
                      onEvento={(e) => agregarEventos([e])}
                      piezaACambiar={piezaACambiar}
                      onCompra={setUltimaCompra}
                    />
                  )
                }
              />
            </div>
            <button
              type="button"
              onClick={() => setCerrando(true)}
              className="flex h-11 shrink-0 items-center rounded-full bg-acento px-4 text-sm font-semibold text-black active:scale-95"
            >
              Terminar
            </button>
          </div>
        </div>
        {aviso && (
          <div className="mx-auto w-full max-w-5xl shrink-0 px-4 pb-2 sm:px-6">
            <p role="note" className="rounded-xl border border-borde bg-superficie px-3 py-2 text-sm text-texto">
              {aviso}
            </p>
          </div>
        )}
        <GuiaExperto
          className="min-h-0 flex-1"
          casoId={caso.id}
          pack={preparado.pack}
          plano={plano.plano}
          origenPlano={plano.origen}
          // El 3D elige la versión de cada pieza según el equipo (notebook, celular, heladera…).
          tipoEquipo={tipoEquipo ?? undefined}
          destinoChat={destinoChat}
          manualFileId={preparado.manualFileId}
          // "Ver en el manual": la página citada en grande (las claves llegan como texto en el JSON).
          imagenPagina={(p) => preparado.imagenesPaginas?.[p] ?? null}
          // "Ver la foto del paso": la foto de la guía (iFixit) que cita el paso, por su URL (#176).
          fotoDePaso={(url) => preparado.fotosPasos?.[url] ?? null}
          // El experto arranca solo, con lo que la persona contó en la pantalla 1.
          preguntaInicial={preguntaInicial}
          decir={decir}
          preguntaDictada={dictada}
          onCambiarPieza={setPiezaACambiar}
          // Con NEXT_PUBLIC_DATOS=fixture el experto responde con el chat simulado de Diego: no gasta IA.
          fuente={arranque.fuente}
          accesorioEntrada={
            dictado.escuchando ? (
              <>
                <button
                  type="button"
                  onClick={dictado.descartar}
                  aria-label="Descartar lo grabado"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-borde text-texto-suave transition active:scale-95"
                >
                  <Papelera />
                </button>
                <button
                  type="button"
                  onClick={dictado.terminar}
                  aria-label="Terminar de grabar y preguntar"
                  className="flex h-12 w-12 shrink-0 animate-pulse items-center justify-center rounded-2xl bg-peligro text-white transition active:scale-95"
                >
                  <Detener />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  callar(); // si el experto está hablando, se calla para escuchar
                  desbloquearAudio();
                  void dictado.empezar();
                }}
                disabled={dictado.conectando}
                aria-label="Preguntar con la voz"
                title={dictado.error ?? undefined}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-borde text-texto transition active:scale-95 disabled:opacity-40"
              >
                <Microfono />
              </button>
            )
          }
          onEvento={(e) => {
            agregarEventos([e]);
            // Después de un paso bloqueado no se ofrece comprar: «llevalo a un técnico» y «comprá esta pieza» se contradicen (#207).
            if (e.tipo === "paso_bloqueado") setPiezaACambiar(null);
          }}
        />
      </div>
      <div ref={setDestinoChat} className="contents" />
      {/* Lo que se va diciendo, en vivo: se pregunta recién al tocar ■ (o se descarta). */}
      {dictado.escuchando && (
        <div className="aparece pointer-events-none fixed inset-x-0 bottom-28 z-[60] mx-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-peligro/50 bg-fondo/95 px-4 py-3 text-sm shadow-2xl">
          <p className="text-xs font-semibold tracking-widest text-peligro uppercase">Te escucho</p>
          <p className="mt-1">{dictado.texto || "Hablá tranquilo. Tocá ■ cuando termines."}</p>
        </div>
      )}
      {dictado.error && !dictado.escuchando && (
        <p className="fixed inset-x-0 bottom-28 z-[60] mx-auto w-fit rounded-full bg-fondo/95 px-4 py-2 text-sm text-probable">
          {dictado.error}
        </p>
      )}
      {ayuda && !cerrando && <AyudaExperto onCerrar={cerrarAyuda} />}
      {cerrando && (
        <PanelCierre
          pack={preparado.pack}
          piezaSugerida={piezaACambiar ?? cierre?.pieza ?? null}
          compra={ultimaCompra}
          onCancelar={() => setCerrando(false)}
          onCerrar={(c) => {
            callar();
            cerrarCaso(c);
            router.push("/casos");
          }}
        />
      )}
    </main>
  );
}
