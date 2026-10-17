"use client";

import { useSyncExternalStore } from "react";
import { EVENTO, modoDemo } from "./modo";

const suscribir = (avisar: () => void) => {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
};

/** Para lo que se dibuja distinto en el modo demo. En el servidor solo cuenta el NEXT_PUBLIC_DATOS del build. */
export function useModoDemo(): boolean {
  return useSyncExternalStore(suscribir, modoDemo, () => process.env.NEXT_PUBLIC_DATOS === "demo");
}
