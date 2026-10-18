"use client";

import { useEffect, useState } from "react";

/**
 * Una sola línea de "pensando" a la vez: aparece, queda un momento y se desvanece cuando llega
 * la siguiente. Cada paso tiene sus propias líneas (entender, revisar foto, leer etiqueta…).
 * Describe lo que el experto está haciendo en general; no inventa resultados.
 */

export const LINEAS = {
  entender: ["Leo lo que me contaste…", "Me fijo qué equipo es…", "Reviso si hay algo peligroso…"],
  foto: [
    "Miro si la foto está nítida…",
    "Me fijo que se vea lo que te pedí…",
    "Busco letras y números legibles…",
  ],
  etiqueta: [
    "Busco la etiqueta en la foto…",
    "Leo la marca y el modelo…",
    "Separo lo que se lee seguro de lo dudoso…",
  ],
  frente: [
    "No hay etiqueta: miro el frente del equipo…",
    "Busco el logo y la forma…",
    "Lo que salga de acá lo vas a confirmar vos…",
  ],
} as const;

const CADA_MS = 2200;

export function LineaPensando({ lineas, className = "" }: { lineas: readonly string[]; className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % lineas.length), CADA_MS);
    return () => clearInterval(t);
  }, [lineas]);
  return (
    <p aria-live="polite" className={`relative h-6 overflow-hidden text-sm text-texto-suave ${className}`}>
      {/* La key reinicia la animación: entra, queda y se va antes de que llegue la siguiente. */}
      <span
        key={i}
        className="linea-pensando absolute inset-x-0"
        style={{ animationDuration: `${CADA_MS}ms` }}
      >
        {lineas[i % lineas.length]}
      </span>
    </p>
  );
}
