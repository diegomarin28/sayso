"use client";

import type { Evento } from "@/shared";

/** Feed de actividad: qué hizo cada agente, lo más nuevo abajo. Muestra lo que pasó, sin inventar. */

const NOMBRE_AGENTE: Record<Evento["agente"], string> = {
  recepcion: "Recepción",
  identificador: "Identificador",
  bibliotecario: "Bibliotecario",
  cartografo: "Cartógrafo",
  experto: "Experto",
  seguridad: "Seguridad",
  compras: "Compras",
};

/**
 * Lo que ve la persona. Los eventos de costo (tokens y USD de cada paso) quedan en el registro interno
 * (Supabase, consola) y solo se muestran en desarrollo.
 */
export function eventosVisibles(eventos: Evento[], entorno = process.env.NODE_ENV): Evento[] {
  return entorno === "production" ? eventos.filter((e) => e.tipo !== "costo") : eventos;
}

export function FeedActividad({ eventos, max = 6 }: { eventos: Evento[]; max?: number }) {
  const ultimos = eventosVisibles(eventos).slice(-max);
  if (ultimos.length === 0) return null;
  return (
    <ol aria-label="Actividad" className="flex flex-col gap-2.5">
      {ultimos.map((e) => (
        <li key={e.id} className="aparece flex gap-3 text-sm">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
              e.agente === "seguridad" ? "bg-peligro" : "bg-acento"
            }`}
            aria-hidden
          />
          <p className="text-texto-suave">
            <span className="font-medium text-texto">{NOMBRE_AGENTE[e.agente]}</span> · {e.mensaje}
          </p>
        </li>
      ))}
    </ol>
  );
}
