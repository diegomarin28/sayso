"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Caso, Evento } from "@/shared";
import { ErrorApi, entenderSintoma, type Bloqueo } from "./_datos/api";
import { useFlujo } from "./_estado/flujo";
import { useDictado } from "@/lib/voice/useDictado";
import { callar, hablar } from "@/lib/voice/hablar";
import {
  BotonPrincipal,
  BotonSecundario,
  DiceExperto,
  Encabezado,
  Flecha,
  Microfono,
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
  const { caso, setCaso, agregarEventos } = useFlujo();
  // Si la persona vuelve con la flecha, se sigue con el mismo caso (no se vuelve a llamar a la IA
  // ni se pierde lo ya preparado). Solo "No, lo corrijo" arma un caso nuevo.
  const [texto, setTexto] = useState(caso?.sintoma ?? "");
  const [pensando, setPensando] = useState(false);
  const [entendido, setEntendido] = useState<Caso | null>(caso);
  /** Solo habla después de que la persona mandó algo en esta visita (y el navegador deja sonar). */
  const [respondio, setRespondio] = useState(false);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [bloqueo, setBloqueo] = useState<Bloqueo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dictado = useDictado((frase) => setTexto((t) => (t.trim() ? `${t.trim()} ${frase}` : frase)));

  async function enviar() {
    dictado.detener();
    if (!texto.trim()) return;
    setRespondio(true);
    setPensando(true);
    setError(null);
    try {
      const r = await entenderSintoma(texto);
      setEntendido(r.caso);
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
    setCaso(entendido); // primero el caso: los eventos lo referencian al guardarse
    agregarEventos(eventos);
    router.push("/fotos");
  }

  function corregir() {
    setEntendido(null);
    setBloqueo(null);
  }

  const dice = pensando
    ? "Dejame entender…"
    : error
      ? error
      : bloqueo
        ? "Pará un momento. Esto puede ser peligroso."
        : entendido?.clase === "otro"
          ? "No me quedó claro qué equipo es. Elegilo abajo."
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

      <DiceExperto texto={dice} />

      {!entendido ? (
        <>
          <div className="flex flex-1 flex-col gap-4">
            <div className="relative">
              <textarea
                autoFocus
                value={dictado.parcial ? `${texto} ${dictado.parcial}`.trim() : texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar();
                  }
                }}
                disabled={pensando}
                rows={3}
                placeholder="Ej.: mi notebook se apaga sola a los diez minutos…"
                className="w-full resize-none rounded-2xl border border-borde bg-superficie p-4 pr-16 text-lg placeholder:text-texto-suave/60 focus:border-acento focus:outline-none"
              />
              <button
                type="button"
                onClick={dictado.alternar}
                disabled={pensando || dictado.conectando}
                aria-pressed={dictado.escuchando}
                aria-label={dictado.escuchando ? "Dejar de escuchar" : "Decirlo con la voz"}
                className={`absolute right-3 bottom-3 flex h-11 w-11 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-40 ${
                  dictado.escuchando ? "animate-pulse bg-peligro text-white" : "bg-acento text-black"
                }`}
              >
                <Microfono />
              </button>
            </div>
            {(dictado.escuchando || dictado.error) && (
              <p className={`text-sm ${dictado.error ? "text-probable" : "text-texto-suave"}`}>
                {dictado.error ?? "Te escucho… Cuando termines, tocá el micrófono o “Seguir”."}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pensando}
                  onClick={() => setTexto(s)}
                  className="rounded-full border border-borde px-4 py-2 text-sm text-texto-suave transition hover:border-texto-suave hover:text-texto"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <BotonPrincipal onClick={enviar} disabled={!texto.trim() || pensando}>
            {pensando ? "Pensando…" : "Seguir"} <Flecha />
          </BotonPrincipal>
        </>
      ) : (
        <div className="mt-auto flex flex-col gap-3">
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
            {entendido.clase === "otro" ? "¿Qué equipo es?" : "¿No es eso? Tocá el equipo correcto:"}
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {(Object.keys(NOMBRE_CLASE) as Caso["clase"][]).map((clase) => (
              <button
                key={clase}
                type="button"
                aria-pressed={entendido.clase === clase}
                onClick={() => setEntendido({ ...entendido, clase })}
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
        </div>
      )}
    </Pantalla>
  );
}
