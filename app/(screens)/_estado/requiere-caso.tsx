"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFlujo } from "./flujo";

/** Si se entra a una pantalla intermedia sin caso (ej. recargando), vuelve a la pantalla 1. */
export function useRequiereCaso() {
  const router = useRouter();
  const { caso } = useFlujo();
  useEffect(() => {
    if (!caso) router.replace("/");
  }, [caso, router]);
  return caso;
}
