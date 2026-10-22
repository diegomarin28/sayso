"use client";

import type { ReactNode } from "react";
import { LineaPensando } from "./linea-pensando";
import { Simbolo } from "./marca";

/**
 * El recorrido como una conversación con el experto: Sayso habla a la izquierda (con su símbolo) y
 * la persona a la derecha. Lo usan la pantalla 1 (qué pasó y qué equipo es) y la charla de un caso en
 * "Mis casos".
 */

export function Hilo({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

/** Un mensaje de Sayso. `alerta`: algo salió mal o hay riesgo (borde rojo). */
export function MensajeIA({
  children,
  alerta = false,
  pensando = false,
}: {
  children: ReactNode;
  alerta?: boolean;
  pensando?: boolean;
}) {
  return (
    <div className="aparece flex max-w-[92%] items-end gap-2">
      <span className="mb-0.5 shrink-0" aria-hidden>
        <Simbolo tam={28} estado={pensando ? "pensando" : "quieto"} />
      </span>
      <div
        role={alerta ? "alert" : undefined}
        className={`min-w-0 rounded-[1.25rem] rounded-bl-md border px-4 py-3 text-[15px] leading-relaxed ${
          alerta ? "border-peligro/50 bg-peligro/10" : "border-borde bg-superficie"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/** Un mensaje de la persona (texto o foto). */
export function MensajeYo({ children, sinMarco = false }: { children: ReactNode; sinMarco?: boolean }) {
  return (
    <div
      className={`aparece max-w-[85%] self-end ${
        sinMarco
          ? ""
          : "rounded-[1.25rem] rounded-br-md border border-acento/30 bg-acento/10 px-4 py-3 text-[15px] leading-snug"
      }`}
    >
      {children}
    </div>
  );
}

/** Sayso pensando: una onda chica y una línea de lo que está haciendo (no inventa resultados). */
export function Pensando({ lineas }: { lineas: readonly string[] }) {
  return (
    <MensajeIA pensando>
      <div className="flex items-center gap-3">
        <span className="flex h-5 items-center gap-1" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="onda-barra h-full w-1 rounded-full bg-dato"
              style={{ animationDelay: `${i * 110}ms` }}
            />
          ))}
        </span>
        <LineaPensando lineas={lineas} className="min-w-44" />
      </div>
    </MensajeIA>
  );
}
