"use client";

import { useEnLinea } from "./en-linea";

/**
 * Una franja arriba cuando el navegador dice que no hay internet: explica por qué los botones que
 * necesitan la red fallan. Se va sola al volver.
 */

export function AvisoSinConexion() {
  const conRed = useEnLinea();
  if (conRed) return null;
  return (
    <p
      role="status"
      className="fixed inset-x-0 top-0 z-[70] bg-probable px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-center text-sm font-medium text-black"
    >
      Sin conexión. Cuando vuelva internet, seguimos.
    </p>
  );
}
