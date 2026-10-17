"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Foto, PedidoDeFoto } from "@/shared";
import { evaluarFoto, pedidosDeFoto } from "../_datos/api";
import { useFlujo } from "../_estado/flujo";
import { useRequiereCaso } from "../_estado/requiere-caso";
import {
  BotonPrincipal,
  Camara,
  Check,
  DiceExperto,
  Encabezado,
  Flecha,
  Pantalla,
} from "../_ui/experto";

/** Pantalla 2 — Captura guiada: una foto por vez, con control de calidad. */

type Toma = {
  url?: string;
  revisando: boolean;
  intentos: number;
  resultado?: Foto;
  salteada?: boolean;
};

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
  const { agregarFoto } = useFlujo();
  const [pedidos, setPedidos] = useState<PedidoDeFoto[] | null>(null);
  const [actual, setActual] = useState(0);
  const [tomas, setTomas] = useState<Record<number, Toma>>({});

  useEffect(() => {
    pedidosDeFoto().then(setPedidos);
  }, []);

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
    const url = URL.createObjectURL(archivo);
    actualizar(i, { url, revisando: true, intentos: intento, resultado: undefined });
    const foto = await evaluarFoto(caso.id, pedido.tipo, url, intento);
    agregarFoto(foto);
    actualizar(i, { revisando: false, resultado: foto });
    if (foto.aceptada) setTimeout(() => setActual(i + 1), 900);
  }

  function saltar() {
    actualizar(actual, { salteada: true });
    setActual(actual + 1);
  }

  const dice = !pedidos
    ? "Preparo la lista de fotos…"
    : terminado
      ? "Listo, ya tengo lo que necesito. Vamos a leer la chapa."
      : toma.revisando
        ? "Dejame ver si se entiende…"
        : rechazada
          ? (toma.resultado?.motivoRechazo ?? "No se ve bien.") + " Sacala de nuevo."
          : aceptada
            ? "Perfecta."
            : pedido!.instruccion;

  return (
    <Pantalla>
      <Encabezado paso={2} orbe={!pedidos || toma.revisando ? "pensando" : "quieto"} />

      <DiceExperto texto={dice} />

      {pedidos && (
        <ol className="flex gap-2">
          {pedidos.map((p, i) => {
            const t = tomas[i];
            const ok = t?.resultado?.aceptada;
            return (
              <li
                key={p.tipo}
                className={`relative flex h-16 flex-1 items-end overflow-hidden rounded-xl border p-2 text-xs font-medium ${
                  i === actual ? "border-acento" : "border-borde"
                } ${t?.salteada ? "border-dashed opacity-50" : ""}`}
              >
                {ok && t?.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
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
            className={`relative block aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-3xl bg-superficie ${
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
              <img src={toma.url} alt={`Foto: ${NOMBRE_TIPO[pedido.tipo]}`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-texto-suave">
                <span className="rounded-full bg-acento p-5 text-black">
                  <Camara />
                </span>
                <span className="text-sm">Tocá para sacar la foto</span>
              </div>
            )}
            <Esquinas color={aceptada ? "var(--confirmado)" : rechazada ? "var(--peligro)" : "var(--acento)"} />
            {toma.revisando && <div className="linea-escaneo" />}
            {aceptada && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="rounded-full bg-confirmado p-4 text-black">
                  <Check size={36} />
                </span>
              </div>
            )}
          </label>

          <div className="mt-auto flex items-center justify-between gap-4 text-sm text-texto-suave">
            <span>
              Foto {actual + 1} de {pedidos!.length}
            </span>
            {pedido.tipo !== "etiqueta" && !toma.revisando && !aceptada && (
              <button onClick={saltar} className="underline underline-offset-4 hover:text-texto">
                No puedo, saltar
              </button>
            )}
          </div>
        </>
      )}

      {terminado && (
        <div className="mt-auto">
          <BotonPrincipal onClick={() => router.push("/ficha")}>
            Leer la chapa <Flecha />
          </BotonPrincipal>
        </div>
      )}
    </Pantalla>
  );
}

/** Esquinas de visor de cámara. */
function Esquinas({ color }: { color: string }) {
  const base = "absolute h-8 w-8 border-[3px] transition-colors duration-300";
  return (
    <div className="pointer-events-none absolute inset-4">
      <span className={`${base} top-0 left-0 rounded-tl-xl border-r-0 border-b-0`} style={{ borderColor: color }} />
      <span className={`${base} top-0 right-0 rounded-tr-xl border-b-0 border-l-0`} style={{ borderColor: color }} />
      <span className={`${base} bottom-0 left-0 rounded-bl-xl border-t-0 border-r-0`} style={{ borderColor: color }} />
      <span className={`${base} right-0 bottom-0 rounded-br-xl border-t-0 border-l-0`} style={{ borderColor: color }} />
    </div>
  );
}
