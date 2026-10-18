"use client";

import { useEffect, useState } from "react";

/**
 * Carga de "leer la etiqueta" (pantalla 3): la ficha con sus campos "descifrándose" (caracteres
 * al azar que cambian). Son ruido, no datos: lo leído aparece recién cuando llega la ficha.
 */

const CARACTERES = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789-";
const CAMPOS = [
  { etiqueta: "Marca", largo: 7 },
  { etiqueta: "Modelo", largo: 12 },
  { etiqueta: "N.º de serie", largo: 14 },
  { etiqueta: "Año", largo: 4 },
];

const ruido = (largo: number) =>
  Array.from({ length: largo }, () => CARACTERES[Math.floor(Math.random() * CARACTERES.length)]).join("");

export function FichaDescifrando() {
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setVuelta((v) => v + 1), 90);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="aparece grid grid-cols-2 gap-2" aria-hidden>
      {CAMPOS.map((c, i) => (
        <div key={c.etiqueta} className="rounded-xl border border-borde bg-superficie/70 px-3 py-2">
          <p className="text-[11px] tracking-wider text-texto-suave uppercase">{c.etiqueta}</p>
          {/* Cada campo cambia a su ritmo; vuelta en 0 (primer render) = guiones, igual en el servidor. */}
          <p className="truncate font-mono text-sm text-dato">
            {vuelta === 0 ? "–".repeat(c.largo) : ruido(c.largo - ((vuelta + i) % 3))}
          </p>
        </div>
      ))}
    </div>
  );
}
