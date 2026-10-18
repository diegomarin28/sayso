"use client";

import { LineaPensando, LINEAS } from "./linea-pensando";

/**
 * Carga de "entender" (pantalla 1): una onda de voz y las palabras de la persona, que se van
 * iluminando una por una mientras el experto las lee. No muestra resultados: solo lo que dijo.
 */
export function CargaEntender({ texto }: { texto: string }) {
  const palabras = texto.trim().split(/\s+/).filter(Boolean).slice(0, 40);
  // Cada palabra se ilumina en su turno; el ciclo dura lo que tarda en recorrer todas.
  const ciclo = Math.max(1.8, palabras.length * 0.22) + 0.8;
  return (
    <div className="aparece flex flex-col items-center gap-6 py-2">
      <div className="flex h-16 items-center gap-1.5" aria-hidden>
        {Array.from({ length: 24 }, (_, i) => (
          <span
            key={i}
            className="onda-barra w-1.5 rounded-full bg-dato"
            style={{ animationDelay: `${(i % 12) * 90}ms`, height: `${30 + ((i * 37) % 60)}%` }}
          />
        ))}
      </div>
      <p className="flex flex-wrap justify-center gap-x-1.5 gap-y-2 text-lg" aria-label={texto}>
        {palabras.map((p, i) => (
          <span
            key={i}
            aria-hidden
            className="palabra-lee rounded-md px-1 text-texto-suave"
            style={{ animationDelay: `${i * 0.22}s`, animationDuration: `${ciclo}s` }}
          >
            {p}
          </span>
        ))}
      </p>
      <LineaPensando lineas={LINEAS.entender} className="w-full text-center" />
    </div>
  );
}
