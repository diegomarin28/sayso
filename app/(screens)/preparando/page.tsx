"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorApi, generarPlano, prepararExperto } from "../_datos/api";
import { useFlujo } from "../_estado/flujo";
import { useRequiereCaso } from "../_estado/requiere-caso";
import { BotonPrincipal, Check, DiceExperto, Encabezado, Flecha, Pantalla } from "../_ui/experto";
import { AnimacionPreparando } from "../_ui/animacion-preparando";
import { FeedActividad } from "../_ui/feed";
import { ResumenGuia } from "../_ui/resumen-guia";
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

export default function Preparando() {
  const router = useRouter();
  const caso = useRequiereCaso();
  const { ficha, eventos, preparado, setPreparado, plano, setPlano, agregarEventos, tipoEquipo } = useFlujo();
  const [segundos, setSegundos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0); // se incrementa con "Probar de nuevo"

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
        const { eventos: nuevos, ...listo } = await prepararExperto(ficha, caso.sintoma);
        if (!vigente) return;
        agregarEventos(nuevos);
        setPreparado(listo);
        guia = listo;
      }
      const { eventos: nuevos, ...p } = await generarPlano(ficha, guia);
      if (!vigente) return;
      agregarEventos(nuevos);
      setPlano(p);
    })()
      .catch(
        (e) => vigente && setError(e instanceof ErrorApi ? e.message : "Algo salió mal. Probá de nuevo."),
      )
      .finally(() => clearInterval(reloj));
    return () => {
      vigente = false;
      clearInterval(reloj);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se prepara una vez por caso (o al reintentar)
  }, [caso?.id, listaParaPreparar, vuelta]);

  if (!caso || !ficha || !listaParaPreparar) return null;

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
          ? `Listo. Tengo el manual de tu ${equipo} y las piezas ubicadas.`
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

      {pack && <ResumenGuia pack={pack} plano={plano} equipo={tipoEquipo ?? caso.clase} />}

      <div className="mt-auto flex flex-col gap-6">
        <FeedActividad eventos={eventos} />
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
      </div>
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
