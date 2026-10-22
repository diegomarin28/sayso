"use client";

import { useSyncExternalStore } from "react";
import { estaSilenciado, silenciar, suscribirSilencio } from "../../../lib/voice/hablar";

/**
 * Silencia o activa la voz de la IA (la que dicta las respuestas). No afecta el dictado de la
 * persona. Va en el lugar fijo del Encabezado; el estado es global y se recuerda en el navegador.
 */
export function BotonSilencio() {
  // En el servidor no hay navegador: se muestra con voz hasta que el cliente lee lo guardado.
  const callado = useSyncExternalStore(suscribirSilencio, estaSilenciado, () => false);
  return (
    <button
      type="button"
      onClick={() => silenciar(!callado)}
      aria-pressed={callado}
      aria-label={callado ? "Activar la voz del experto" : "Silenciar la voz del experto"}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
        callado ? "text-acento" : "text-texto-suave hover:text-texto"
      }`}
    >
      <svg
        width={22}
        height={22}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M11 5 6 9H3v6h3l5 4z" />
        {callado ? <path d="m22 9-6 6m0-6 6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
      </svg>
    </button>
  );
}
