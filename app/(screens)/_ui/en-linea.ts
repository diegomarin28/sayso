"use client";

import { useSyncExternalStore } from "react";

const suscribir = (aviso: () => void) => {
  window.addEventListener("online", aviso);
  window.addEventListener("offline", aviso);
  return () => {
    window.removeEventListener("online", aviso);
    window.removeEventListener("offline", aviso);
  };
};

/** ¿El navegador dice que hay internet? El servidor y la primera pintura asumen que sí. */
export function useEnLinea(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => navigator.onLine,
    () => true,
  );
}
