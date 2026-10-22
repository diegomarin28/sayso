"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PedidoDeFoto } from "@/shared";
import { ErrorApi, evaluarFoto, pedidosDeFoto } from "../_datos/api";
import { instruccionDeToma } from "../_datos/instruccion-foto";
import { dondeBuscarModelo } from "../_datos/donde-modelo";
import { ErrorImagen, prepararImagen, vistaPrevia } from "../_datos/imagen";
import { useFlujo, type Toma } from "../_estado/flujo";
import { LineaPensando, LINEAS } from "../_ui/linea-pensando";
import { useRequiereCaso } from "../_estado/requiere-caso";
import {
  BarraAccion,
  BotonPrincipal,
  Alerta,
  BotonSecundario,
  Camara,
  Check,
  DiceExperto,
  Encabezado,
  Flecha,
  Pantalla,
} from "../_ui/experto";

/** Pantalla 2 — Captura guiada: una foto por vez, con control de calidad. */

const NOMBRE_TIPO: Record<PedidoDeFoto["tipo"], string> = {
  frente: "Frente",
  etiqueta: "Etiqueta",
  interior: "Interior",
  puertos: "Puertos",
  otro: "Otra",
};

const DE_TIPO: Record<PedidoDeFoto["tipo"], string> = {
  frente: "del frente",
  etiqueta: "de la etiqueta",
  interior: "del interior",
  puertos: "de los puertos",
  otro: "que te pedí",
};

/**
 * Next guarda las pantallas ya visitadas con su estado (cacheComponents usa <Activity>). El estado de
 * esta pantalla es del caso: con otro caso arranca de cero (si no, la ficha de un caso nuevo traía las
 * correcciones del anterior). Con el mismo caso (atrás, el logo) se conserva.
 */
export default function CapturaGuiada() {
  const { caso } = useFlujo();
  return <CapturaGuiadaDelCaso key={caso?.id ?? "sin-caso"} />;
}

function CapturaGuiadaDelCaso() {
  const router = useRouter();
  const caso = useRequiereCaso();
  const { agregarFoto, agregarEventos, captura, setCaptura, tipoEquipo } = useFlujo();
  // Lo de la captura vive en el flujo: al volver a esta pantalla sigue donde estaba.
  const { pedidos, actual, tomas } = captura;
  const setPedidos = (p: PedidoDeFoto[]) => setCaptura((c) => ({ ...c, pedidos: p }));
  const setActual = (n: number) => setCaptura((c) => ({ ...c, actual: n }));
  const setTomas = (f: (t: Record<number, Toma>) => Record<number, Toma>) =>
    setCaptura((c) => ({ ...c, tomas: f(c.tomas) }));
  const [errorPedidos, setErrorPedidos] = useState<string | null>(null);

  const [vuelta, setVuelta] = useState(0); // se incrementa con "Probar de nuevo"
  /** "No encuentro la etiqueta": se muestra dónde más está el modelo, antes de saltearla. */
  const [buscarOtro, setBuscarOtro] = useState(false);
  const donde = dondeBuscarModelo(tipoEquipo, caso?.sintoma);

  useEffect(() => {
    if (!caso || pedidos) return;
    let vigente = true;
    pedidosDeFoto(caso, tipoEquipo)
      .then((r) => {
        if (!vigente) return;
        agregarEventos(r.eventos);
        setPedidos(r.pedidos);
      })
      .catch((e) => vigente && setErrorPedidos(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se pide una vez por caso (o al reintentar)
  }, [caso?.id, vuelta]);

  if (!caso) return null;

  const terminado = pedidos !== null && actual >= pedidos.length;
  const pedido = pedidos?.[actual];
  const toma: Toma = tomas[actual] ?? { revisando: false, intentos: 0 };
  const rechazada = toma.resultado && !toma.resultado.aceptada;
  const aceptada = toma.resultado?.aceptada;

  function actualizar(i: number, cambio: Partial<Toma>) {
    setTomas((prev) => ({
      ...prev,
      [i]: { ...(prev[i] ?? { revisando: false, intentos: 0 }), ...cambio },
    }));
  }

  /** `alternativa`: la que se acaba de elegir (el estado todavía no la tiene); si no, la de la toma. */
  async function alSacar(archivo: File | undefined, alternativa = toma.alternativa) {
    if (!archivo || !pedido || !caso) return;
    const i = actual;
    const intento = toma.intentos + 1;
    actualizar(i, {
      url: undefined,
      revisando: true,
      intentos: intento,
      resultado: undefined,
      error: undefined,
    });
    try {
      const imagen = await prepararImagen(archivo);
      actualizar(i, { url: vistaPrevia(imagen) });
      // La URL definitiva la pone /api/casos al subir la foto a Supabase.
      // Se juzga contra lo que se le pidió sacar: la alternativa elegida, si hay (#315).
      const r = await evaluarFoto(caso.id, pedido.tipo, imagen, intento, instruccionDeToma(pedido.instruccion, alternativa));
      agregarFoto(r.foto, imagen);
      agregarEventos(r.eventos);
      actualizar(i, { revisando: false, resultado: r.foto });
      // Sigue con la próxima foto pendiente (no vuelve a pedir las que ya se sacaron o se saltearon).
      if (r.foto.aceptada)
        setTimeout(
          () => setCaptura((c) => ({ ...c, actual: siguientePendiente(c.tomas, i, c.pedidos?.length ?? 0) })),
          900,
        );
    } catch (e) {
      actualizar(i, { revisando: false, error: mensajeDeError(e) });
    }
  }

  /** Vuelve a la foto anterior (para sacarla de nuevo) o, desde la primera, a la pantalla 1. */
  function volver() {
    if (actual > 0) setActual(Math.min(actual, pedidos?.length ?? 0) - 1);
    else router.push("/");
  }

  /** Vuelve a una foto salteada para sacarla. */
  function irA(i: number) {
    actualizar(i, { salteada: false });
    setActual(i);
  }

  function saltar() {
    setBuscarOtro(false);
    actualizar(actual, { salteada: true });
    setActual(actual + 1);
  }

  /** Foto de otro lugar con el modelo (control remoto, caja…): se lee como si fuera la etiqueta. */
  function sacarAlternativa(alternativa: string, archivo: File | undefined) {
    if (!archivo) return;
    setBuscarOtro(false);
    actualizar(actual, { alternativa });
    void alSacar(archivo, alternativa);
  }

  // Sin fotos no se puede reconocer el equipo: hace falta la etiqueta o, al menos, el frente.
  // (Si los pedidos no traen ninguna de las dos, alcanza con cualquier foto aceptada.)
  const claves = (pedidos ?? []).flatMap((p, i) => (p.tipo === "etiqueta" || p.tipo === "frente" ? [i] : []));
  const sirve = (i: number) => !!tomas[i]?.resultado?.aceptada;
  const conEtiqueta = (pedidos ?? []).some((p, i) => p.tipo === "etiqueta" && sirve(i));
  const alcanza = claves.length ? claves.some(sirve) : (pedidos ?? []).some((_, i) => sirve(i));
  const aSacar = claves.length ? claves : (pedidos ?? []).map((_, i) => i);

  // También después de un rechazo (#255): la foto rechazada sigue en `toma.url` y antes el panel no se abría.
  const mostrarOtros = buscarOtro && pedido?.tipo === "etiqueta" && !toma.revisando && !aceptada;
  /** Qué hay que sacar ahora (si es de otro lugar, eso). */
  const queSacar = pedido ? instruccionDeToma(pedido.instruccion, toma.alternativa) : undefined;

  const dice = errorPedidos
    ? errorPedidos
    : !pedidos
      ? "Preparo la lista de fotos…"
      : terminado
        ? !alcanza
          ? "Sin fotos no puedo reconocer tu equipo. Necesito al menos la de la etiqueta o la del frente."
          : conEtiqueta
            ? "Listo, ya tengo lo que necesito. Vamos a leer la etiqueta."
            : "No tengo la etiqueta, pero con lo que sacaste intento reconocer tu equipo."
        : toma.revisando
          ? "Dejame ver si se entiende…"
          : toma.error
            ? `${toma.error} Sacala otra vez.`
            : rechazada
              ? "Esa foto no me sirve. Te explico abajo qué sacar."
              : aceptada
                ? "Perfecta."
                : mostrarOtros
                  ? "No pasa nada. El modelo suele estar también en otro lado:"
                  : queSacar!;

  return (
    <Pantalla>
      <Encabezado
        paso={2}
        orbe={!pedidos || toma.revisando ? "pensando" : "quieto"}
        alVolver={volver}
        volverApagado={toma.revisando}
      />

      <DiceExperto texto={dice} />

      {errorPedidos && (
        <BarraAccion>
          <BotonPrincipal
            onClick={() => {
              setErrorPedidos(null);
              setVuelta((v) => v + 1);
            }}
          >
            Probar de nuevo
          </BotonPrincipal>
        </BarraAccion>
      )}

      {pedidos && !terminado && (
        <ol className="flex gap-2">
          {pedidos.map((p, i) => {
            const t = tomas[i];
            const ok = t?.resultado?.aceptada;
            return (
              <li
                key={`${p.tipo}-${i}`}
                className={`relative flex h-16 flex-1 items-center justify-center overflow-hidden rounded-xl border p-2 text-center text-xs font-medium ${
                  i === actual ? "border-acento" : "border-borde"
                } ${t?.salteada ? "border-dashed opacity-50" : ""}`}
              >
                {ok && t?.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-50"
                  />
                )}
                {/* Sobre la foto, el nombre va en una pastilla oscura: sin fondo no se leía con fotos claras. */}
                <span className={`relative ${ok && t?.url ? "rounded-md bg-fondo/80 px-1.5 py-0.5" : ""}`}>
                  {t?.alternativa ?? NOMBRE_TIPO[p.tipo]}
                </span>
                {ok && (
                  <span className="absolute top-1.5 right-1.5 rounded-full bg-confirmado p-0.5 text-black">
                    <Check size={12} />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* Al terminar: las fotos que sirven, grandes, para ver qué se va a leer. Las salteadas, en una línea. */}
      {pedidos && terminado && (
        <div className="aparece flex flex-col gap-3">
          <ul className="grid grid-cols-2 gap-3">
            {pedidos.flatMap((p, i) => {
              const t = tomas[i];
              if (!t?.resultado?.aceptada || !t.url) return [];
              return [
                <li key={`${p.tipo}-${i}`} className="relative overflow-hidden rounded-2xl border border-confirmado/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.url} alt={`Foto: ${NOMBRE_TIPO[p.tipo]}`} className="aspect-[4/3] w-full object-cover" />
                  <span className="absolute bottom-2 left-2 rounded-md bg-fondo/85 px-2 py-0.5 text-xs font-medium">
                    {t.alternativa ?? NOMBRE_TIPO[p.tipo]}
                  </span>
                  <span className="absolute top-2 right-2 rounded-full bg-confirmado p-1 text-black">
                    <Check size={14} />
                  </span>
                </li>,
              ];
            })}
          </ul>
          {pedidos.some((_, i) => tomas[i]?.salteada) && (
            <p className="text-sm text-texto-suave">
              Salteaste:{" "}
              {pedidos
                .flatMap((p, i) => (tomas[i]?.salteada ? [NOMBRE_TIPO[p.tipo].toLowerCase()] : []))
                .join(", ")}
              .
            </p>
          )}
        </div>
      )}

      {/* Sin etiqueta: dónde más buscar el modelo y sacarle foto a eso; o seguir sin ninguno. */}
      {pedido && !terminado && mostrarOtros && (
        <div className="aparece flex flex-1 flex-col gap-5">
          <ul className="flex flex-col gap-2 rounded-2xl border border-borde bg-superficie/80 p-4 text-sm">
            {donde.lugares.map((l) => (
              <li key={l} className="flex gap-2">
                <span className="text-dato" aria-hidden>
                  •
                </span>
                {l}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-texto-suave">¿Tenés alguno? Sacale una foto donde se lea el modelo:</p>
            {donde.alternativas.map((a) => (
              <InputFoto
                key={a}
                camara
                alElegir={(f) => sacarAlternativa(a, f)}
                className="border border-acento/60 bg-acento/10"
              >
                <Camara size={18} /> {a}
              </InputFoto>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between gap-4 text-sm text-texto-suave">
            <button onClick={() => setBuscarOtro(false)} className="underline underline-offset-4 hover:text-texto">
              Volver a la etiqueta
            </button>
            <button onClick={saltar} className="font-medium text-texto underline underline-offset-4">
              No tengo ninguno
            </button>
          </div>
        </div>
      )}

      {pedido && !terminado && !mostrarOtros && (
        <>
          {pedido.advertencia && !toma.url && (
            <p className="flex items-start gap-2 rounded-2xl border border-probable/40 bg-probable/10 p-4 text-sm text-probable">
              <Alerta /> {pedido.advertencia}
            </p>
          )}

          <label
            className={`relative block aspect-[4/3] max-h-[40dvh] w-full cursor-pointer overflow-hidden rounded-3xl bg-superficie ${
              toma.revisando ? "pointer-events-none" : ""
            }`}
          >
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                alSacar(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {toma.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={toma.url}
                alt={`Foto: ${NOMBRE_TIPO[pedido.tipo]}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-texto-suave">
                <Camara size={44} />
                <span className="text-sm">Tocá para sacar la foto con la cámara</span>
              </div>
            )}
            {/* Visor en cian (dato/escaneo); verde o rojo cuando ya se revisó. */}
            <Esquinas
              color={aceptada ? "var(--confirmado)" : rechazada ? "var(--peligro)" : "var(--dato)"}
            />
            {/* Carga de "revisar la foto": una rejilla y un cuadro de enfoque que salta por la foto. */}
            {toma.revisando && (
              <div className="pointer-events-none absolute inset-0 bg-black/25" aria-hidden>
                <div className="rejilla-foto" />
                <div className="foco-foto" />
              </div>
            )}
            {aceptada && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="rounded-full bg-confirmado p-4 text-black">
                  <Check size={36} />
                </span>
              </div>
            )}
          </label>

          {/* Carga de "revisar la foto": la línea que escanea y una línea de lo que mira. */}
          {toma.revisando && <LineaPensando lineas={LINEAS.foto} className="-mt-4" />}

          {/* Foto rechazada (o que no se pudo revisar): qué está mal, qué sacar y cómo reintentar. */}
          {(rechazada || toma.error) && !toma.revisando && (
            <div
              role="alert"
              className="-mt-4 flex flex-col gap-3 rounded-2xl border border-peligro/50 bg-peligro/10 p-4"
            >
              <div>
                <p className="font-semibold text-peligro">Esta foto no sirve</p>
                <p className="mt-1 text-sm">
                  {toma.error ?? toma.resultado?.motivoRechazo ?? "No se ve bien."}
                </p>
              </div>
              <p className="text-sm text-texto-suave">
                <span className="font-medium text-texto">Qué sacar:</span> {queSacar}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <InputFoto camara alElegir={alSacar} className="bg-acento font-semibold text-black sm:flex-1">
                  <Camara size={18} /> Reintentar esta foto
                </InputFoto>
                <InputFoto alElegir={alSacar} className="border border-borde">
                  <Galeria /> Elegir otra
                </InputFoto>
              </div>
            </div>
          )}

          {/* Como en la cámara del celular: galería a la izquierda, el disparador en el medio y saltar
              a la derecha. (La foto grande también abre la cámara.) */}
          {!toma.revisando && !aceptada && !rechazada && !toma.error && (
            <div className="mt-auto grid grid-cols-3 items-center">
              <InputFoto
                alElegir={alSacar}
                etiqueta="Elegir de la galería"
                className="h-13 w-13 justify-self-start border border-borde bg-superficie px-0"
              >
                <Galeria />
              </InputFoto>
              <InputFoto
                camara
                alElegir={alSacar}
                etiqueta="Sacar la foto"
                className="h-19 w-19 justify-self-center rounded-full bg-acento px-0 text-black shadow-[0_0_0_6px_var(--fondo),0_0_0_8px_rgb(255_176_32/0.5)]"
              >
                <Camara size={30} />
              </InputFoto>
              <BotonSaltar pedido={pedido.tipo} alSaltar={() => (pedido.tipo === "etiqueta" ? setBuscarOtro(true) : saltar())} />
            </div>
          )}

          {/* Con la foto rechazada, saltar sigue a mano (debajo de "Reintentar"). */}
          {(rechazada || toma.error) && !toma.revisando && (
            <div className="mt-auto flex justify-end">
              <BotonSaltar pedido={pedido.tipo} alSaltar={() => (pedido.tipo === "etiqueta" ? setBuscarOtro(true) : saltar())} />
            </div>
          )}
        </>
      )}

      {terminado && alcanza && (
        <BarraAccion>
          <BotonPrincipal onClick={() => router.push("/ficha")}>
            {conEtiqueta ? "Leer la etiqueta" : "Reconocer el equipo"} <Flecha />
          </BotonPrincipal>
        </BarraAccion>
      )}
      {terminado && !alcanza && (
        <BarraAccion>
          {aSacar.map((i, n) =>
            n === 0 ? (
              <BotonPrincipal key={i} onClick={() => irA(i)}>
                <Camara size={20} /> Sacar la foto {DE_TIPO[pedidos![i].tipo]}
              </BotonPrincipal>
            ) : (
              <BotonSecundario key={i} onClick={() => irA(i)}>
                Sacar la foto {DE_TIPO[pedidos![i].tipo]}
              </BotonSecundario>
            ),
          )}
        </BarraAccion>
      )}
    </Pantalla>
  );
}

/** La próxima foto después de `i` que no está sacada ni salteada (o el final). */
function siguientePendiente(tomas: Record<number, Toma>, i: number, total: number): number {
  for (let j = i + 1; j < total; j++) if (!tomas[j]?.resultado?.aceptada && !tomas[j]?.salteada) return j;
  return total;
}

/** Esquinas de visor de cámara. */
function Esquinas({ color }: { color: string }) {
  const base = "absolute h-8 w-8 border-[3px] transition-colors duration-300";
  return (
    <div className="pointer-events-none absolute inset-4">
      <span
        className={`${base} top-0 left-0 rounded-tl-xl border-r-0 border-b-0`}
        style={{ borderColor: color }}
      />
      <span
        className={`${base} top-0 right-0 rounded-tr-xl border-b-0 border-l-0`}
        style={{ borderColor: color }}
      />
      <span
        className={`${base} bottom-0 left-0 rounded-bl-xl border-t-0 border-r-0`}
        style={{ borderColor: color }}
      />
      <span
        className={`${base} right-0 bottom-0 rounded-br-xl border-t-0 border-l-0`}
        style={{ borderColor: color }}
      />
    </div>
  );
}

function mensajeDeError(e: unknown) {
  if (e instanceof ErrorApi || e instanceof ErrorImagen) return e.message;
  console.error("[fotos]", e);
  return "Algo salió mal. Probá de nuevo.";
}

function Galeria() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M21 16l-5-5-8 9" />
    </svg>
  );
}

/** "Saltar" (o, en la etiqueta, buscar el modelo en otro lado). */
function BotonSaltar({ pedido, alSaltar }: { pedido: string; alSaltar: () => void }) {
  return (
    <button
      type="button"
      onClick={alSaltar}
      className="min-h-11 justify-self-end text-right text-sm text-texto-suave underline underline-offset-4 hover:text-texto"
    >
      {pedido === "etiqueta" ? "No la encuentro" : "Saltar"}
    </button>
  );
}

/** Botón que abre la cámara (`camara`) o la galería y manda la foto elegida. */
function InputFoto({
  camara = false,
  alElegir,
  etiqueta,
  className = "",
  children,
}: {
  camara?: boolean;
  alElegir: (archivo: File | undefined) => void;
  /** Para los botones que son solo un ícono. */
  etiqueta?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      aria-label={etiqueta}
      className={`flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 text-sm font-medium transition hover:opacity-90 active:scale-[0.98] ${className}`}
    >
      <input
        type="file"
        accept="image/*"
        {...(camara ? { capture: "environment" as const } : {})}
        className="sr-only"
        onChange={(e) => {
          alElegir(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {children}
    </label>
  );
}
