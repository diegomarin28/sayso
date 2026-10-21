"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ErrorCortado, cancelarPedidosEnCurso, generarPlano, hayPedidosEnCurso, prepararExperto } from "../_datos/api";
import { mensajeDeError } from "../_datos/errores";
import { Volviendo } from "../_ui/volviendo";
import { useFlujo } from "../_estado/flujo";
import { useRequiereCaso } from "../_estado/requiere-caso";
import {
  BarraAccion,
  BotonPrincipal,
  Check,
  DiceExperto,
  Encabezado,
  Flecha,
  Pantalla,
} from "../_ui/experto";
import { AnimacionPreparando } from "../_ui/animacion-preparando";
import { FeedActividad } from "../_ui/feed";
import { ResumenGuia } from "../_ui/resumen-guia";
import { usePrecargaPiezas } from "@/components/viewer";
import { desbloquearAudio } from "@/lib/voice/hablar";

/**
 * Pantalla 4 — Preparando: el bibliotecario busca y lee el manual del modelo (30 s – 2 min)
 * y después el cartógrafo ubica las piezas en el 3D.
 * No es una pantalla de manual: el manual es fuente interna y acá solo se resume qué se encontró.
 */

/** Qué está haciendo, en general, mientras espera. No dice nada que no haya pasado. */
const ETAPAS: { desde: number; texto: (equipo: string) => string }[] = [
  { desde: 0, texto: (e) => `Busco el manual oficial de tu ${e}…` },
  { desde: 20, texto: () => "Lo leo para encontrar las piezas y los pasos de tu problema…" },
  { desde: 50, texto: () => "Anoto la página del manual de cada paso, así lo podés verificar…" },
  { desde: 90, texto: () => "Ya casi. Los manuales de servicio son largos…" },
];

/**
 * Volver a la app después de esto (el iPhone corta la red en segundo plano) se toma como "volvió la red": un
 * pedido que siguiera en camino probablemente quedó colgado. Un vistazo corto a otra app no corta nada.
 */
const VOLVER_DESDE_MS = 10_000;
/** Antes del reintento automático se ve "Probar de nuevo" un momento: la persona entiende qué pasó. */
const PAUSA_REINTENTO_MS = 1500;

/**
 * Next guarda las pantallas ya visitadas con su estado (cacheComponents usa <Activity>). El estado de
 * esta pantalla es del caso: con otro caso arranca de cero (si no, la ficha de un caso nuevo traía las
 * correcciones del anterior). Con el mismo caso (atrás, el logo) se conserva.
 */
export default function Preparando() {
  const { caso } = useFlujo();
  return <PreparandoDelCaso key={caso?.id ?? "sin-caso"} />;
}

function PreparandoDelCaso() {
  const router = useRouter();
  const caso = useRequiereCaso();
  const { ficha, eventos, preparado, setPreparado, plano, setPlano, agregarEventos, tipoEquipo } = useFlujo();
  const [segundos, setSegundos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0); // se incrementa con "Probar de nuevo"
  // Un solo reintento automático (por tiempo agotado o al volver la red); después, el botón.
  const reintentado = useRef(false);
  const hayError = useRef(false);
  useEffect(() => {
    hayError.current = error !== null;
  }, [error]);
  const reintentar = () => {
    setError(null);
    setSegundos(0);
    setVuelta((v) => v + 1);
  };
  // Las formas del 3D se bajan mientras espera a la IA (#133): el visor abre sin esperar la red.
  usePrecargaPiezas(tipoEquipo, preparado?.pack);

  const listaParaPreparar = ficha?.modelo.estado === "confirmado";

  useEffect(() => {
    if (caso && !listaParaPreparar) router.replace("/ficha");
  }, [caso, listaParaPreparar, router]);

  useEffect(() => {
    if (!caso || !ficha || !listaParaPreparar || (preparado && plano)) return;
    let vigente = true;
    const inicio = Date.now();
    const reloj = setInterval(() => setSegundos(Math.floor((Date.now() - inicio) / 1000)), 1000);
    (async () => {
      let guia = preparado;
      if (!guia) {
        const { eventos: nuevos, ...listo } = await prepararExperto(ficha, caso.sintoma, tipoEquipo);
        if (!vigente) return;
        agregarEventos(nuevos);
        setPreparado(listo);
        guia = listo;
      }
      const { eventos: nuevos, ...p } = await generarPlano(ficha, guia, tipoEquipo);
      if (!vigente) return;
      agregarEventos(nuevos);
      setPlano(p);
    })()
      .catch((e) => {
        if (!vigente) return;
        setError(mensajeDeError(e));
        if (e instanceof ErrorCortado && !reintentado.current) {
          reintentado.current = true;
          setTimeout(() => vigente && reintentar(), PAUSA_REINTENTO_MS);
        }
      })
      .finally(() => clearInterval(reloj));
    return () => {
      vigente = false;
      clearInterval(reloj);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se prepara una vez por caso (o al reintentar)
  }, [caso?.id, listaParaPreparar, vuelta]);

  // Volvió la red (o la persona volvió a la app): lo que siga en camino se corta (falla con ErrorCortado y se
  // reintenta una vez); si ya estaba el error, se reintenta una vez.
  useEffect(() => {
    let ocultaDesde: number | null = null;
    const volvio = () => {
      if (hayPedidosEnCurso()) cancelarPedidosEnCurso();
      else if (hayError.current && !reintentado.current) {
        reintentado.current = true;
        reintentar();
      }
    };
    const alCambiar = () => {
      if (document.visibilityState === "hidden") {
        ocultaDesde = Date.now();
        return;
      }
      const afuera = ocultaDesde === null ? 0 : Date.now() - ocultaDesde;
      ocultaDesde = null;
      if (afuera >= VOLVER_DESDE_MS) volvio();
    };
    window.addEventListener("online", volvio);
    document.addEventListener("visibilitychange", alCambiar);
    return () => {
      window.removeEventListener("online", volvio);
      document.removeEventListener("visibilitychange", alCambiar);
    };
  }, []);

  if (!caso) return <Volviendo />;
  if (!ficha || !listaParaPreparar) return <Volviendo texto="Falta confirmar tu equipo. Te llevo a la ficha…" destino="/ficha" boton="Ir a la ficha" />;

  const equipo = [ficha.marca.valor, ficha.modelo.valor].filter(Boolean).join(" ");
  const etapa = ETAPAS.findLast((e) => segundos >= e.desde) ?? ETAPAS[0];
  const pack = preparado?.pack;

  const listo = pack && plano;

  const dice = error
    ? error
    : !pack
      ? etapa.texto(equipo)
      : !plano
        ? preparado?.manualFileId
          ? "Ahora miro la vista explosionada del manual para ubicar cada pieza en el 3D…"
          : "Ahora ubico cada pieza en el 3D…"
        : pack.verificado
          ? "Listo, ya tengo tu guía."
          : `No encontré el manual oficial de tu ${equipo}. Te guío con una guía pública, sin verificar.`;

  return (
    <Pantalla>
      {/* Volver no corta ni repite la búsqueda: el resultado queda guardado en el caso. */}
      <Encabezado
        paso={4}
        orbe={listo || error ? "quieto" : "pensando"}
        alVolver={() => router.push("/ficha")}
      />

      <DiceExperto texto={dice} />

      <ol className="flex flex-col gap-2 text-sm" aria-label="Progreso">
        <Etapa estado={pack ? "hecha" : error ? "error" : "en-curso"}>Guía del equipo con el manual</Etapa>
        <Etapa estado={plano ? "hecha" : !pack ? "pendiente" : error ? "error" : "en-curso"}>
          Piezas ubicadas en el 3D
        </Etapa>
      </ol>

      {!pack && !error && (
        <div className="flex flex-col items-center gap-3 py-6">
          <AnimacionPreparando acto={!pack ? "manual" : "plano"} equipo={tipoEquipo ?? caso.clase} />
          <p className="font-mono text-xs text-texto-suave tabular-nums" aria-label="Tiempo">
            {Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, "0")}
          </p>
        </div>
      )}

      {pack && <ResumenGuia pack={pack} plano={plano} equipo={tipoEquipo ?? caso.clase} modelo={equipo} />}

      <div className="mt-auto">
        <FeedActividad eventos={eventos} />
      </div>
      {(error || listo) && (
        <BarraAccion>
          {error && (
            <BotonPrincipal
              onClick={() => {
                setError(null);
                setSegundos(0);
                setVuelta((v) => v + 1);
              }}
            >
              Probar de nuevo
            </BotonPrincipal>
          )}
          {listo && (
            <BotonPrincipal
              onClick={() => {
                desbloquearAudio(); // el experto habla solo al entrar: en iPhone hace falta este toque
                router.push("/experto");
              }}
            >
              Ver al experto <Flecha />
            </BotonPrincipal>
          )}
        </BarraAccion>
      )}
    </Pantalla>
  );
}

type EstadoEtapa = "pendiente" | "en-curso" | "hecha" | "error";

function Etapa({ estado, children }: { estado: EstadoEtapa; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-3 ${estado === "pendiente" ? "text-texto-suave/50" : ""}`}>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          estado === "hecha"
            ? "bg-confirmado text-black"
            : estado === "error"
              ? "bg-peligro"
              : estado === "en-curso"
                ? "border-2 border-acento border-t-transparent motion-safe:animate-spin"
                : "border border-borde"
        }`}
        aria-hidden
      >
        {estado === "hecha" && <Check size={12} />}
      </span>
      <span>{children}</span>
    </li>
  );
}
