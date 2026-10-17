"use client";

import { useRouter } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import { firmaCasos, listarCasos, TEXTO_ESTADO, type CasoGuardado } from "../_datos/mis-casos";
import { useFlujo } from "../_estado/flujo";
import { BotonPrincipal, DiceExperto, Flecha, FlechaAtras, Pantalla } from "../_ui/experto";

/**
 * "Mis casos": los casos de este dispositivo (sin login). Tocar uno lo retoma en la pantalla del
 * experto con su guía y su 3D, usando lo guardado: no vuelve a llamar a la IA.
 */

const ESTILO_ESTADO: Record<keyof typeof TEXTO_ESTADO, string> = {
  resuelto: "border-confirmado/40 bg-confirmado/10 text-confirmado",
  esperando_repuesto: "border-probable/40 bg-probable/10 text-probable",
  derivado: "border-peligro/40 bg-peligro/10 text-peligro",
  en_curso: "border-borde text-texto-suave",
};

export default function MisCasos() {
  const router = useRouter();
  const { retomar } = useFlujo();
  // localStorage solo existe en el navegador: en el servidor la lista sale vacía y no hay desajuste.
  const firma = useSyncExternalStore(sinSuscripcion, firmaCasos, () => "[]");
  const casos = useMemo(() => (firma === "[]" ? [] : listarCasos()), [firma]);

  function abrir(c: CasoGuardado) {
    retomar(c);
    // Con guía y plano guardados va directo al experto; si no, sigue desde donde quedó.
    router.push(c.guia ? "/experto" : c.ficha ? "/ficha" : "/fotos");
  }

  return (
    <Pantalla>
      <header className="flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-borde bg-superficie pr-4 pl-3 text-sm font-medium"
        >
          <FlechaAtras /> Inicio
        </button>
        <p className="text-xs font-medium tracking-widest text-texto-suave uppercase">Mis casos</p>
      </header>

      <DiceExperto
        texto={
          casos.length
            ? "Estos son tus casos. Tocá uno para seguir donde quedaste."
            : "Todavía no tenés casos guardados."
        }
      />

      {casos.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {casos.map((c) => {
            const estado = c.cierre?.estado ?? "en_curso";
            const equipo =
              [c.ficha?.marca.valor, c.ficha?.modelo.valor].filter(Boolean).join(" ") ||
              c.tipoEquipo ||
              c.caso.clase;
            const pieza =
              c.cierre?.pieza && c.guia?.preparado.pack.piezas.find((p) => p.id === c.cierre?.pieza)?.nombre;
            return (
              <li key={c.caso.id}>
                <button
                  onClick={() => abrir(c)}
                  className="flex w-full flex-col gap-2 rounded-2xl border border-borde bg-superficie p-4 text-left transition hover:border-texto-suave active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-semibold break-words">{equipo}</p>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${ESTILO_ESTADO[estado]}`}
                    >
                      {TEXTO_ESTADO[estado]}
                    </span>
                  </div>
                  <p className="text-sm text-texto-suave">“{c.caso.sintoma}”</p>
                  <div className="flex items-center justify-between gap-3 text-xs text-texto-suave">
                    <span>{fecha(c.actualizadoEn)}</span>
                    {estado === "esperando_repuesto" && pieza && (
                      <span className="text-probable">Falta: {pieza.toLowerCase()}</span>
                    )}
                    {!c.guia && <span>Sin guía todavía</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-auto">
          <BotonPrincipal onClick={() => router.push("/")}>
            Empezar un caso <Flecha />
          </BotonPrincipal>
        </div>
      )}

      <p className="mt-auto text-center text-xs text-texto-suave">
        Se guardan solo en este dispositivo, sin cuenta ni datos personales.
      </p>
    </Pantalla>
  );
}

const sinSuscripcion = () => () => {};

function fecha(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 10);
  }
}
