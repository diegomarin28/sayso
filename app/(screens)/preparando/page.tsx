"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorApi, generarPlano, prepararExperto } from "../_datos/api";
import { useFlujo } from "../_estado/flujo";
import { useRequiereCaso } from "../_estado/requiere-caso";
import { BotonPrincipal, Check, DiceExperto, Encabezado, Flecha, Orbe, Pantalla } from "../_ui/experto";
import { FeedActividad } from "../_ui/feed";

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
  const { ficha, eventos, preparado, setPreparado, plano, setPlano, agregarEventos } = useFlujo();
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
  const verificados = pack?.pasos.filter((p) => p.cita?.estado === "VERIFICADO").length ?? 0;

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

      {!listo && !error && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Orbe estado="pensando" tam={120} />
          <p className="font-mono text-xs text-texto-suave tabular-nums" aria-label="Tiempo">
            {Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, "0")}
          </p>
        </div>
      )}

      {pack && (
        <div className="rounded-3xl border border-borde bg-superficie p-5">
          <p className="text-xs text-texto-suave">Fuente</p>
          <p className="mt-1 font-medium">{pack.fuentes[0]?.doc ?? "Guía pública"}</p>
          <span
            className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-xs ${
              pack.verificado
                ? "border-confirmado/40 bg-confirmado/10 text-confirmado"
                : "border-probable/40 bg-probable/10 text-probable"
            }`}
          >
            {pack.verificado ? "Manual verificado" : "NO VERIFICADO"}
          </span>
          <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
            <Dato valor={pack.piezas.length} etiqueta="piezas" />
            <Dato valor={pack.pasos.length} etiqueta="pasos" />
            <Dato valor={verificados} etiqueta="con página citada" />
          </dl>
          {plano && (
            <p className="mt-4 text-xs text-texto-suave">
              3D:{" "}
              {plano.origen === "ia"
                ? "piezas ubicadas según el manual."
                : "modelo genérico del equipo (no pude ubicar las piezas con el manual)."}
            </p>
          )}
          {pack.advertencias.length > 0 && (
            <p className="mt-5 rounded-2xl border border-probable/40 bg-probable/10 p-3 text-sm text-probable">
              ⚠ {pack.advertencias[0]}
            </p>
          )}
        </div>
      )}

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
          <BotonPrincipal onClick={() => router.push("/experto")}>
            Ver al experto <Flecha />
          </BotonPrincipal>
        )}
      </div>
    </Pantalla>
  );
}

function Dato({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <div>
      <dd className="font-mono text-3xl font-semibold">{valor}</dd>
      <dt className="mt-1 text-xs text-texto-suave">{etiqueta}</dt>
    </div>
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
