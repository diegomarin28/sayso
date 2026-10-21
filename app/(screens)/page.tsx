"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { firmaCasos, listarCasos } from "./_datos/mis-casos";
import { BotonSesion, useCuenta } from "./_ui/boton-sesion";
import { Hilo, MensajeIA, MensajeYo, Pensando } from "./_ui/chat";
import { LINEAS } from "./_ui/linea-pensando";
import { IconoDeEquipo, type IconoEquipo } from "./_ui/iconos-equipo";
import { LEMA } from "./_ui/marca";
import { ProblemasFrecuentes } from "./_ui/problemas-frecuentes";
import type { Caso, Evento } from "@/shared";
import { ErrorApi, entenderSintoma, type Bloqueo } from "./_datos/api";
import { sinEntender, sintomaParaCitar } from "./_datos/entender-simulado";
import { useFlujo } from "./_estado/flujo";
import { useDictado } from "@/lib/voice/useDictado";
import { callar, desbloquearAudio, hablar } from "@/lib/voice/hablar";
import {
  Alerta,
  BotonPrincipal,
  BarraAccion,
  BotonSecundario,
  DiceExperto,
  Encabezado,
  Flecha,
  Detener,
  Microfono,
  Papelera,
  Pantalla,
} from "./_ui/experto";

/** Pantalla 1 — Qué se rompió. */

/** Las opciones de "¿Qué equipo es?". `tipo` es lo que se pasa a fotos, etiqueta y 3D. */
type Opcion = { clave: string; clase: Caso["clase"]; tipo: string; etiqueta: string; icono: IconoEquipo };

const OPCIONES: Opcion[] = [
  { clave: "notebook", clase: "notebook", tipo: "notebook", etiqueta: "Notebook", icono: "notebook" },
  { clave: "celular", clase: "otro", tipo: "celular", etiqueta: "Celular", icono: "celular" },
  { clave: "split", clase: "split", tipo: "aire acondicionado split", etiqueta: "Aire split", icono: "split" },
  { clave: "lavarropas", clase: "lavarropas", tipo: "lavarropas", etiqueta: "Lavarropas", icono: "lavarropas" },
];

const NOMBRE_CLASE: Record<Exclude<Caso["clase"], "otro">, string> = {
  notebook: "notebook",
  split: "aire acondicionado split",
  lavarropas: "lavarropas",
};

const NO_TE_ENTENDI =
  "No te entendí bien. ¿Me contás de nuevo qué equipo es y qué le pasa? Por ejemplo: “mi celular no carga”.";

/**
 * Next guarda las pantallas ya visitadas con su estado (cacheComponents usa <Activity>). El estado de
 * esta pantalla es del caso: con otro caso arranca de cero (si no, la ficha de un caso nuevo traía las
 * correcciones del anterior). Con el mismo caso (atrás, el logo) se conserva.
 */
export default function QueSeRompio() {
  const { caso, cierre } = useFlujo();
  // Un caso cerrado no se retoma desde acá (ver abajo): arranca limpia, como sin caso.
  return <QueSeRompioDelCaso key={(!cierre && caso?.id) || "sin-caso"} />;
}

function QueSeRompioDelCaso() {
  const router = useRouter();
  const { caso: casoEnCurso, cierre, setCaso, agregarEventos, tipoEquipo } = useFlujo();
  // Un caso ya cerrado no se retoma desde acá: la pantalla 1 arranca limpia (está en "Mis casos").
  const caso = cierre ? null : casoEnCurso;
  // Si la persona vuelve con la flecha, se sigue con el mismo caso (no se vuelve a llamar a la IA
  // ni se pierde lo ya preparado). Solo "No, te lo cuento de nuevo" arma un caso nuevo.
  const [texto, setTexto] = useState(caso?.sintoma ?? "");
  const [pensando, setPensando] = useState(false);
  /** Lo que se mandó a entender (se muestra en la carga). */
  const [enviado, setEnviado] = useState("");
  const [entendido, setEntendido] = useState<Caso | null>(caso);
  /** La IA no supo qué equipo es: se vuelve a preguntar en vez de adivinar. */
  const [noEntendi, setNoEntendi] = useState(false);
  /** La pregunta para pedir lo que faltó (de la recepción, #260); si no viene, la general. */
  const [repregunta, setRepregunta] = useState<string | null>(null);
  /** Qué equipo es en texto libre (lo dice la IA; si la persona elige otro, gana su elección). */
  const [tipo, setTipo] = useState<string | null>(tipoEquipo);
  const [tipoDeLaIA, setTipoDeLaIA] = useState<string | null>(tipoEquipo);
  /** "Otro equipo": la persona escribe cuál es. */
  const [otro, setOtro] = useState<string | null>(null);
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
  /** Lo que se ve en el cuadro: lo escrito más lo que se va diciendo. */
  const enVivo = dictado.escuchando && dictado.texto ? sumar(texto, dictado.texto) : texto;
  const hayAlgo = !!enVivo.trim();

  /** `directo`: un problema frecuente tocado, que se manda tal cual. */
  async function enviar(directo?: string) {
    desbloquearAudio(); // la respuesta se dice en voz alta cuando llega (iPhone pide un toque)
    // Si estaba grabando, "Seguir" usa también lo que dijo (incluida la frase a medias).
    const aEnviar = directo ?? enVivo;
    if (dictado.escuchando) {
      dictado.descartar(); // ya se sumó acá; no entregarlo dos veces
      setTexto(aEnviar);
    }
    if (!aEnviar.trim()) return;
    setRespondio(true);
    setEnviado(aEnviar);
    setPensando(true);
    setError(null);
    setNoEntendi(false);
    try {
      const r = await entenderSintoma(aEnviar);
      // `claro` lo dice la recepción (también "notebook dddd"); sin el campo, se deduce del equipo.
      if ((r.claro === false || sinEntender(r.caso.clase, r.tipoEquipo)) && !r.bloqueo) {
        setRepregunta(r.repregunta?.trim() || null);
        setNoEntendi(true);
        return;
      }
      setEntendido(r.caso);
      setTipo(r.tipoEquipo ?? null);
      setTipoDeLaIA(r.tipoEquipo ?? null);
      setOtro(null);
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
    const elegido = otro !== null ? otro.trim() || null : tipo;
    setCaso(entendido, elegido); // primero el caso: los eventos lo referencian al guardarse
    agregarEventos(eventos);
    router.push("/fotos");
  }

  function contarDeNuevo() {
    setEntendido(null);
    setBloqueo(null);
    setOtro(null);
  }

  // Las opciones: la que entendió la IA (si no es una de las conocidas, va primera) y las de siempre.
  const opciones = useMemo(() => {
    const t = tipoDeLaIA?.trim().toLowerCase();
    const conocida = OPCIONES.some((o) => o.tipo === t || (o.clase !== "otro" && o.clase === entendido?.clase));
    const deLaIA: Opcion[] =
      entendido && t && !sinEntender(entendido.clase, t) && !conocida
        ? [{ clave: "ia", clase: entendido.clase, tipo: t, etiqueta: mayuscula(t), icono: "generico" }]
        : [];
    return [...deLaIA, ...OPCIONES];
  }, [entendido, tipoDeLaIA]);
  const elegida = (o: Opcion) =>
    otro === null &&
    !!entendido &&
    (o.clase !== "otro" ? entendido.clase === o.clase : tipo?.trim().toLowerCase() === o.tipo);
  const sinElegir = !!entendido && otro === null && !opciones.some(elegida);
  const listo = !!entendido && (otro !== null ? !!otro.trim() : !sinElegir);

  // Con la sesión iniciada saluda por el nombre que la persona puso al crear la cuenta.
  const [cuenta, recargarCuenta] = useCuenta();
  const conCuenta = !!cuenta?.sesion && !cuenta.anonima;
  const saludo = conCuenta && cuenta.nombre ? `Hola, ${cuenta.nombre}.` : "Hola.";
  const nombreEquipo = entendido ? (entendido.clase !== "otro" ? NOMBRE_CLASE[entendido.clase] : tipo) : "";
  const dice = pensando
    ? "Dejame entender…"
    : error
      ? error
      : noEntendi
        ? repregunta
          ? `No te entendí bien. ${repregunta}`
          : NO_TE_ENTENDI
        : bloqueo
          ? "Pará un momento. Esto puede ser peligroso."
          : entendido && sinElegir
            ? "No me quedó claro qué equipo es. Elegilo acá abajo."
            : entendido
              ? `Entendí que es tu ${nombreEquipo}. ¿Es así? Si es otro equipo, elegilo acá abajo.`
              : `${saludo} ¿Qué se rompió?`;
  /** Desde que la persona manda algo, la pantalla es una charla: su mensaje y la respuesta de Sayso. */
  const enCharla = pensando || !!entendido || !!error || noEntendi;
  const loQueDijo = entendido && !pensando ? sintomaParaCitar(entendido.sintoma) : enviado;

  // El experto dice en voz alta lo que entendió (siempre después de que la persona tocó algo,
  // así el navegador deja reproducir audio).
  const hablarAhora = respondio && (entendido !== null || error !== null || noEntendi);
  useEffect(() => {
    if (hablarAhora && !pensando) hablar(dice);
  }, [dice, hablarAhora, pensando]);
  useEffect(() => callar, []);

  return (
    <Pantalla>
      <Encabezado paso={1} conSilencio orbe={pensando ? "pensando" : "quieto"} accion={<BotonSesion cuenta={cuenta} alCambiar={recargarCuenta} />} />

      {enCharla ? (
        // La charla: lo que contó la persona y la respuesta de Sayso (o Sayso pensando).
        <Hilo>
          {loQueDijo && <MensajeYo>{loQueDijo}</MensajeYo>}
          {pensando ? (
            <Pensando lineas={LINEAS.entender} />
          ) : (
            <MensajeIA alerta={!!bloqueo || !!error}>
              {bloqueo && (
                <span className="mb-1 flex items-center gap-2 font-semibold text-peligro">
                  <Alerta /> Riesgo alto
                </span>
              )}
              {dice}
              {bloqueo && (
                <span className="mt-1 block text-sm">
                  {bloqueo.derivacion ?? "Esto lo tiene que ver un técnico. No lo abras ni lo manipules."}
                </span>
              )}
            </MensajeIA>
          )}
        </Hilo>
      ) : (
        <div className="flex flex-col gap-3">
          <DiceExperto texto={dice} />
          {/* Al empezar, qué hace Sayso (en el resto del recorrido queda el símbolo del encabezado). */}
          <p className="aparece text-base leading-relaxed text-texto-suave">{LEMA}</p>
        </div>
      )}

      {!entendido && !pensando && (
        <>
          <div className="flex flex-1 flex-col gap-6">
            {/* El audio primero: el micrófono grande es la forma principal de contarlo. */}
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
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
                    className="mic-grabando flex h-28 w-28 items-center justify-center rounded-full bg-peligro text-white shadow-2xl transition active:scale-95"
                  >
                    <Detener size={36} />
                  </button>
                  <span className="h-14 w-14" aria-hidden />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void dictado.empezar()}
                  disabled={dictado.conectando}
                  aria-label="Contalo con tu voz"
                  className="mic-invita flex h-28 w-28 items-center justify-center rounded-full bg-acento text-black shadow-2xl transition active:scale-95 disabled:opacity-40"
                >
                  <Microfono size={44} />
                </button>
              )}
              <p className={`text-center text-base ${dictado.error ? "text-probable" : "text-texto"}`}>
                {dictado.error ??
                  (dictado.escuchando
                    ? "Te escucho… Tocá ■ cuando termines."
                    : dictado.conectando
                      ? "Abriendo el micrófono…"
                      : hayAlgo
                        ? "Tocá para agregar algo más con tu voz"
                        : "Tocá y contame qué pasó")}
              </p>
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

            {/* Un toque y arranca, como si lo hubiera escrito. Mientras escribe o habla se van. */}
            {!hayAlgo && !dictado.escuchando && (
              <ProblemasFrecuentes
                alElegir={(p) => {
                  setTexto(p);
                  void enviar(p);
                }}
              />
            )}
          </div>

          {/* Abajo, a mano: se escribe acá o se ve en vivo lo que se va diciendo. La flecha manda. */}
          <BarraAccion>
            <div
              className={`flex items-end gap-2 rounded-2xl border bg-superficie/95 p-1.5 pl-4 ${
                dictado.escuchando ? "border-peligro/60" : "border-borde focus-within:border-acento"
              }`}
            >
              <textarea
                value={enVivo}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar();
                  }
                }}
                readOnly={dictado.escuchando}
                rows={hayAlgo ? 3 : 1}
                aria-label="Lo que pasó"
                placeholder={dictado.escuchando ? "Te escucho…" : "O escribilo acá"}
                className="min-h-11 flex-1 resize-none bg-transparent py-2.5 text-base placeholder:text-texto-suave/80 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void enviar()}
                disabled={!hayAlgo}
                aria-label="Seguir"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-acento text-black transition active:scale-95 disabled:bg-borde disabled:text-texto-suave"
              >
                <Flecha />
              </button>
            </div>
          </BarraAccion>
        </>
      )}

      {entendido && !pensando && (
        <>
          {/* ¿Qué equipo es? En el medio, con el que entendió la IA ya elegido. */}
          <div className="flex flex-1 flex-col gap-3">
            {sinElegir && <p className="text-sm text-texto-suave">¿Qué equipo es?</p>}
            <div className="grid grid-cols-3 gap-2.5">
              {opciones.map((o) => (
                <button
                  key={o.clave}
                  type="button"
                  aria-pressed={elegida(o)}
                  onClick={() => {
                    setEntendido({ ...entendido, clase: o.clase });
                    setTipo(o.tipo);
                    setOtro(null);
                  }}
                  className={`flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl px-1 text-center text-sm font-medium transition active:scale-[0.98] ${
                    elegida(o)
                      ? "border-2 border-acento bg-acento/10 text-texto [&_svg]:text-acento"
                      : "border border-borde bg-superficie/80 text-texto-suave hover:border-texto-suave hover:text-texto"
                  }`}
                >
                  <IconoDeEquipo icono={o.icono} />
                  {o.etiqueta}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={otro !== null}
                onClick={() => {
                  setEntendido({ ...entendido, clase: "otro" });
                  setOtro("");
                }}
                className={`flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl text-sm font-medium transition active:scale-[0.98] ${
                  otro !== null
                    ? "border-2 border-acento bg-acento/10 text-texto [&_svg]:text-acento"
                    : "border border-dashed border-borde bg-superficie/40 text-texto-suave hover:text-texto"
                }`}
              >
                <IconoDeEquipo icono="otro" />
                Otro
              </button>
            </div>
            {otro !== null && (
              <input
                autoFocus
                value={otro}
                onChange={(e) => setOtro(e.target.value)}
                aria-label="¿Qué equipo es?"
                placeholder="¿Qué equipo es? Ej.: heladera, microondas…"
                className="aparece h-12 rounded-2xl border border-acento/60 bg-superficie px-4 focus:outline-none"
              />
            )}
          </div>
          <BarraAccion>
            <BotonPrincipal onClick={confirmar} disabled={!listo}>
              {bloqueo
                ? "Entendí, sigamos con cuidado"
                : otro === null && nombreEquipo
                  ? `Sí, es mi ${nombreEquipo}`
                  : "Sí, sigamos"}{" "}
              <Flecha />
            </BotonPrincipal>
            <BotonSecundario onClick={contarDeNuevo}>Te lo cuento de nuevo</BotonSecundario>
          </BarraAccion>
        </>
      )}
    </Pantalla>
  );
}

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const sinSuscripcion = () => () => {};
