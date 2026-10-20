"use client";

import { useRouter } from "next/navigation";
import { FlechaAtras } from "./experto";

/**
 * "← Volver" a donde estaba la persona. Si llegó directo (link nuevo, otra pestaña) no hay a dónde
 * volver: va al inicio.
 */
export function Volver() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-borde bg-superficie pr-4 pl-3 text-sm font-medium"
    >
      <FlechaAtras /> Volver
    </button>
  );
}
