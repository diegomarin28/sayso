"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PedidoDeFoto } from "@/shared";
import { ErrorApi, evaluarFoto, pedidosDeFoto } from "../_datos/api";
import { ErrorImagen, prepararImagen, vistaPrevia } from "../_datos/imagen";
import { useFlujo, type Toma } from "../_estado/flujo";
import { useRequiereCaso } from "../_estado/requiere-caso";
import {
  BarraAccion,
  BotonPrincipal,
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

export default function CapturaGuiada() {
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

  async function alSacar(archivo: File | undefined) {
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
      const r = await evaluarFoto(caso.id, pedido.tipo, imagen, intento);
      agregarFoto(r.foto, imagen);
      agregarEventos(r.eventos);
      actualizar(i, { revisando: false, resultado: r.foto });
      if (r.foto.aceptada) setTimeout(() => setActual(i + 1), 900);
    } catch (e) {
      actualizar(i, { revisando: false, error: mensajeDeError(e) });
    }
  }

  /** Vuelve a la foto anterior (para sacarla de nuevo) o, desde la primera, a la pantalla 1. */
  function volver() {
    if (actual > 0) setActual(Math.min(actual, pedidos?.length ?? 0) - 1);
    else router.push("/");
  }

  function saltar() {
    actualizar(actual, { salteada: true });
    setActual(actual + 1);
  }

  const dice = errorPedidos
    ? errorPedidos
    : !pedidos
      ? "Preparo la lista de fotos…"
      : terminado
        ? "Listo, ya tengo lo que necesito. Vamos a leer la chapa."
        : toma.revisando
          ? "Dejame ver si se entiende…"
          : toma.error
            ? `${toma.error} Sacala otra vez.`
            : rechazada
              ? "Esa foto no me sirve. Te explico abajo qué sacar."
              : aceptada
                ? "Perfecta."
                : pedido!.instruccion;

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

      {pedidos && (
        <ol className="flex gap-2">
          {pedidos.map((p, i) => {
            const t = tomas[i];
            const ok = t?.resultado?.aceptada;
            return (
              <li
                key={`${p.tipo}-${i}`}
                className={`relative flex h-16 flex-1 items-end overflow-hidden rounded-xl border p-2 text-xs font-medium ${
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
                <span className="relative">{NOMBRE_TIPO[p.tipo]}</span>
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

      {pedido && !terminado && (
        <>
          {pedido.advertencia && !toma.url && (
            <p className="rounded-2xl border border-probable/40 bg-probable/10 p-4 text-sm text-probable">
              ⚠ {pedido.advertencia}
            </p>
          )}

          <label
            className={`relative block aspect-[4/3] max-h-[55dvh] w-full cursor-pointer overflow-hidden rounded-3xl bg-superficie ${
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
                <span className="rounded-full bg-acento p-5 text-black">
                  <Camara />
                </span>
                <span className="text-sm">Tocá para sacar la foto con la cámara</span>
              </div>
            )}
            <Esquinas
              color={aceptada ? "var(--confirmado)" : rechazada ? "var(--peligro)" : "var(--acento)"}
            />
            {toma.revisando && <div className="linea-escaneo" />}
            {aceptada && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="rounded-full bg-confirmado p-4 text-black">
                  <Check size={36} />
                </span>
              </div>
            )}
          </label>

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
                <span className="font-medium text-texto">Qué sacar:</span> {pedido.instruccion}
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

          {/* La foto grande abre la cámara; esto deja elegir una que ya esté en el celular. */}
          {!toma.revisando && !aceptada && !rechazada && !toma.error && (
            <InputFoto alElegir={alSacar} className="-mt-4 border border-borde">
              <Galeria /> Elegir de la galería
            </InputFoto>
          )}

          <div className="mt-auto flex items-center justify-between gap-4 text-sm text-texto-suave">
            <span>
              Foto {actual + 1} de {pedidos!.length}
            </span>
            {!toma.revisando && !aceptada && (
              <button onClick={saltar} className="underline underline-offset-4 hover:text-texto">
                {pedido.tipo === "etiqueta" ? "No encuentro la etiqueta" : "No puedo, saltar"}
              </button>
            )}
          </div>
        </>
      )}

      {terminado && (
        <BarraAccion>
          <BotonPrincipal onClick={() => router.push("/ficha")}>
            Leer la chapa <Flecha />
          </BotonPrincipal>
        </BarraAccion>
      )}
    </Pantalla>
  );
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

/** Botón que abre la cámara (`camara`) o la galería y manda la foto elegida. */
function InputFoto({
  camara = false,
  alElegir,
  className = "",
  children,
}: {
  camara?: boolean;
  alElegir: (archivo: File | undefined) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
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
