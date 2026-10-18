"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { firmaCasos, listarCasos } from "./_datos/mis-casos";
import { LineaPensando, LINEAS } from "./_ui/linea-pensando";
import { LEMA, Marca } from "./_ui/marca";
import type { Caso, Evento } from "@/shared";
import { ErrorApi, entenderSintoma, type Bloqueo } from "./_datos/api";
import { useFlujo } from "./_estado/flujo";
import { useDictado } from "@/lib/voice/useDictado";
import { callar, desbloquearAudio, hablar } from "@/lib/voice/hablar";
import {
  BotonPrincipal,
  BarraAccion,
  BotonSecundario,
  DiceExperto,
  Encabezado,
  Flecha,
  Detener,
  Microfono,
  Orbe,
  Papelera,
  Pantalla,
} from "./_ui/experto";

/** Pantalla 1 — Qué se rompió. */

const SUGERENCIAS = [
  "Se apaga sola",
  "No carga la batería",
  "El ventilador hace mucho ruido",
  "No prende la pantalla",
];

const ETIQUETA_CLASE: Record<Caso["clase"], string> = {
  notebook: "Notebook",
  split: "Aire split",
  lavarropas: "Lavarropas",
  otro: "Otro",
};

const NOMBRE_CLASE: Record<Caso["clase"], string> = {
  notebook: "una notebook",
  split: "un aire acondicionado split",
  lavarropas: "un lavarropas",
  otro: "un equipo",
};

export default function QueSeRompio() {
  const router = useRouter();
  const { caso: casoEnCurso, cierre, setCaso, agregarEventos, tipoEquipo } = useFlujo();
  // Un caso ya cerrado no se retoma desde acá: la pantalla 1 arranca limpia (está en "Mis casos").
  const caso = cierre ? null : casoEnCurso;
  // Si la persona vuelve con la flecha, se sigue con el mismo caso (no se vuelve a llamar a la IA
  // ni se pierde lo ya preparado). Solo "No, lo corrijo" arma un caso nuevo.
  const [texto, setTexto] = useState(caso?.sintoma ?? "");
  /** "Prefiero escribirlo": el cuadro de texto, como alternativa al audio. */
  const [escribir, setEscribir] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [entendido, setEntendido] = useState<Caso | null>(caso);
  /** Qué equipo es en texto libre (lo dice la IA; si la persona elige otra clase, gana su elección). */
  const [tipo, setTipo] = useState<string | null>(tipoEquipo);
  const [tipoDeLaIA, setTipoDeLaIA] = useState<string | null>(tipoEquipo);
  /** Solo habla después de que la persona mandó algo en esta visita (y el navegador deja sonar). */
  const [respondio, setRespondio] = useState(false);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [bloqueo, setBloqueo] = useState<Bloqueo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // "Mis casos" (solo en el navegador: en el servidor no hay casos y no hay desajuste).
  const firma = useSyncExternalStore(sinSuscripcion, firmaCasos, () => "[]");
  const cantidadCasos = useMemo(() => (firma === "[]" ? 0 : listarCasos().length), [firma]);

  const sumar = (t: string, frase: string) => (t.trim() ? `${t.trim()} ${frase}` : frase);
  const dictado = useDictado((dicho) => setTexto((t) => sumar(t, dicho)));

  async function enviar() {
    desbloquearAudio(); // la respuesta se dice en voz alta cuando llega (iPhone pide un toque)
    // Si estaba grabando, "Seguir" usa también lo que dijo (incluida la frase a medias).
    const aEnviar = dictado.escuchando && dictado.texto ? sumar(texto, dictado.texto) : texto;
    if (dictado.escuchando) {
      dictado.descartar(); // ya se sumó acá; no entregarlo dos veces
      setTexto(aEnviar);
    }
    if (!aEnviar.trim()) return;
    setRespondio(true);
    setPensando(true);
    setError(null);
    try {
      const r = await entenderSintoma(aEnviar);
      setEntendido(r.caso);
      setTipo(r.tipoEquipo ?? null);
      setTipoDeLaIA(r.tipoEquipo ?? null);
      setEventos(r.eventos);
      setBloqueo(r.bloqueo ?? null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "Algo salió mal. Probá de nuevo.");
    } finally {
      setPensando(false);
    }
  }

  function confirmar() {
    if (!entendido) return;
    setCaso(entendido, tipo); // primero el caso: los eventos lo referencian al guardarse
    agregarEventos(eventos);
    router.push("/fotos");
  }

  function corregir() {
    setEntendido(null);
    setBloqueo(null);
  }

  // "equipo" es lo que devuelve la IA cuando no sabe qué es.
  const tipoConocido = !!tipo && tipo !== "equipo";
  const dice = pensando
    ? "Dejame entender…"
    : error
      ? error
      : bloqueo
        ? "Pará un momento. Esto puede ser peligroso."
        : entendido?.clase === "otro" && !tipoConocido
          ? "No me quedó claro qué equipo es. Elegilo abajo."
          : entendido?.clase === "otro"
            ? `Entendí: es “${tipo}” y “${entendido.sintoma.toLowerCase()}”. ¿Es así?`
            : entendido
              ? `Entendí: es ${NOMBRE_CLASE[entendido.clase]} y “${entendido.sintoma.toLowerCase()}”. ¿Es así?`
              : "Hola. Contame qué se rompió.";

  // El experto dice en voz alta lo que entendió (siempre después de que la persona tocó algo,
  // así el navegador deja reproducir audio).
  const hablarAhora = respondio && (entendido !== null || error !== null);
  useEffect(() => {
    if (hablarAhora && !pensando) hablar(dice);
  }, [dice, hablarAhora, pensando]);
  useEffect(() => callar, []);

  return (
    <Pantalla>
      <Encabezado paso={1} orbe={pensando ? "pensando" : "quieto"} />

      {/* La marca, solo al empezar (en el resto del recorrido queda el símbolo del encabezado). */}
      {!entendido && !pensando && !error && (
        <div className="aparece flex flex-col gap-2">
          <Marca tam={44} conSimbolo={false} />
          <p className="text-sm text-texto-suave">{LEMA}</p>
        </div>
      )}

      <DiceExperto texto={dice} />

      {/* Carga de "entender": el símbolo grande (sus barras de voz se mueven) y una línea de lo que hace. */}
      {pensando && (
        <div className="aparece flex flex-col items-center gap-4 py-2">
          <Orbe estado="pensando" tam={96} />
          <LineaPensando lineas={LINEAS.entender} className="w-full text-center" />
        </div>
      )}

      {!entendido ? (
        <>
          <div className="flex flex-1 flex-col gap-5">
            {/* Lo que dijo (o escribió): se ve en vivo mientras habla y se puede corregir después. */}
            {(dictado.escuchando || escribir || texto) && (
              <div className="aparece relative">
                <textarea
                  autoFocus={escribir && !dictado.escuchando}
                  value={dictado.escuchando && dictado.texto ? sumar(texto, dictado.texto) : texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviar();
                    }
                  }}
                  readOnly={dictado.escuchando}
                  disabled={pensando}
                  rows={3}
                  aria-label="Lo que se rompió"
                  placeholder={
                    dictado.escuchando ? "Te escucho…" : "Ej.: mi notebook se apaga sola a los diez minutos…"
                  }
                  className={`w-full resize-none rounded-2xl border bg-superficie/90 p-4 text-lg backdrop-blur placeholder:text-texto-suave/60 focus:border-acento focus:outline-none ${
                    dictado.escuchando ? "border-peligro/60" : "border-borde"
                  }`}
                />
              </div>
            )}

            {/* El audio primero: el micrófono grande es la forma principal de contarlo. */}
            <div className="flex flex-col items-center gap-3 py-2">
              {dictado.escuchando ? (
                <div className="flex items-center gap-5">
                  <button
                    type="button"
                    onClick={dictado.descartar}
                    aria-label="Descartar lo grabado"
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-borde bg-superficie text-texto-suave transition active:scale-95"
                  >
                    <Papelera size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={dictado.terminar}
                    aria-label="Terminar de grabar"
                    className="mic-grabando flex h-32 w-32 items-center justify-center rounded-full bg-peligro text-white shadow-2xl transition active:scale-95"
                  >
                    <Detener size={40} />
                  </button>
                  <span className="h-14 w-14" aria-hidden />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEscribir(false);
                    void dictado.empezar();
                  }}
                  disabled={pensando || dictado.conectando}
                  aria-label="Contalo con tu voz"
                  className="mic-invita flex h-32 w-32 items-center justify-center rounded-full bg-acento text-black shadow-2xl transition active:scale-95 disabled:opacity-40"
                >
                  <Microfono size={48} />
                </button>
              )}
              <p className={`text-center text-base ${dictado.error ? "text-probable" : "text-texto"}`}>
                {dictado.error ??
                  (dictado.escuchando
                    ? "Te escucho… Tocá ■ cuando termines."
                    : dictado.conectando
                      ? "Abriendo el micrófono…"
                      : texto
                        ? "Tocá para agregar algo más con tu voz"
                        : "Tocá y contame qué se rompió")}
              </p>
              {!dictado.escuchando && !escribir && !texto && (
                <button
                  type="button"
                  onClick={() => setEscribir(true)}
                  className="text-sm text-texto-suave underline underline-offset-4 hover:text-texto"
                >
                  Prefiero escribirlo
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs text-texto-suave">O tocá uno de estos:</p>
              <div className="flex flex-wrap gap-2">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={pensando || dictado.escuchando}
                    onClick={() => setTexto(s)}
                    className="rounded-full border border-borde bg-superficie/60 px-4 py-2 text-sm text-texto-suave transition hover:border-texto-suave hover:text-texto"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {cantidadCasos > 0 && (
              <button
                type="button"
                onClick={() => router.push("/casos")}
                className="flex h-11 items-center justify-center gap-2 self-start rounded-full border border-acento/60 bg-acento/10 px-4 text-sm font-medium"
              >
                Mis casos ({cantidadCasos})
              </button>
            )}
          </div>
          <BarraAccion>
            <BotonPrincipal onClick={enviar} disabled={!texto.trim() || pensando}>
              {pensando ? "Pensando…" : "Seguir"} <Flecha />
            </BotonPrincipal>
          </BarraAccion>
        </>
      ) : (
        <BarraAccion>
          {bloqueo && (
            <div
              role="alert"
              className="mb-3 rounded-2xl border border-peligro/50 bg-peligro/10 p-4 text-peligro"
            >
              <p className="font-semibold">⚠ Riesgo alto</p>
              <p className="mt-1 text-sm">
                {bloqueo.derivacion ?? "Esto lo tiene que ver un técnico. No lo abras ni lo manipules."}
              </p>
            </div>
          )}
          <p className="text-sm text-texto-suave">
            {entendido.clase === "otro" && !tipoConocido
              ? "¿Qué equipo es?"
              : "¿No es eso? Tocá el equipo correcto:"}
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {(Object.keys(NOMBRE_CLASE) as Caso["clase"][]).map((clase) => (
              <button
                key={clase}
                type="button"
                aria-pressed={entendido.clase === clase}
                onClick={() => {
                  setEntendido({ ...entendido, clase });
                  // Si la persona corrige la clase, el tipo pasa a ser el que eligió (salvo "Otro").
                  setTipo(clase === "otro" ? tipoDeLaIA : ETIQUETA_CLASE[clase].toLowerCase());
                }}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  entendido.clase === clase
                    ? "border-acento bg-acento/15 text-texto"
                    : "border-borde text-texto-suave hover:border-texto-suave hover:text-texto"
                }`}
              >
                {ETIQUETA_CLASE[clase]}
              </button>
            ))}
          </div>
          <BotonPrincipal onClick={confirmar}>
            {bloqueo ? "Entendí, sigamos con cuidado" : "Sí, sigamos"} <Flecha />
          </BotonPrincipal>
          <BotonSecundario onClick={corregir}>No, lo corrijo</BotonSecundario>
        </BarraAccion>
      )}
    </Pantalla>
  );
}

const sinSuscripcion = () => () => {};
