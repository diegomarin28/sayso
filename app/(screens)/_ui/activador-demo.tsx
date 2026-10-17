"use client";

import { useEffect, useRef, useState } from "react";
import { activarDemo, leerDemoDeUrl, modoDemo, sinInternet } from "@/lib/demo/modo";
import { useModoDemo } from "@/lib/demo/useModoDemo";

/**
 * Modo demo (lib/demo/modo.ts) desde el celular: `?demo=1` / `?demo=0` en la URL, o cinco toques
 * seguidos en la barra de pasos (`data-activador-demo` en el encabezado). Al cambiar, vuelve a la
 * pantalla 1 con un caso nuevo. Con el modo prendido queda un punto chiquito arriba a la derecha:
 * la pantalla se ve igual que la real, pero quien presenta sabe que no usa IA.
 */
const TOQUES = 5;
const VENTANA_MS = 3000;

export function ActivadorDemo() {
  const demo = useModoDemo();
  const [aviso, setAviso] = useState<string | null>(null);
  const toques = useRef<number[]>([]);

  useEffect(() => {
    const cambiar = (si: boolean) => {
      setAviso(si ? "Modo demo: sin IA ni internet" : "Modo demo apagado");
      // Caso nuevo: lo que estaba a medias se hizo con el otro modo. Se recarga para soltar el estado
      // (después de leer el aviso y de que se registre la copia sin internet).
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa a propósito
      setTimeout(() => window.location.assign("/"), 1500);
    };
    if (leerDemoDeUrl(window.location.href)) cambiar(modoDemo());
    else if (modoDemo()) void sinInternet(true); // que la copia sin internet esté al día

    const alTocar = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-activador-demo]")) return;
      const ahora = e.timeStamp;
      toques.current = [...toques.current.filter((t) => ahora - t < VENTANA_MS), ahora];
      if (toques.current.length < TOQUES) return;
      toques.current = [];
      const si = !modoDemo();
      activarDemo(si);
      cambiar(si);
    };
    document.addEventListener("pointerdown", alTocar);
    return () => document.removeEventListener("pointerdown", alTocar);
  }, []);

  return (
    <>
      {demo && <span aria-label="Modo demo" className="pointer-events-none fixed top-2 right-2 z-50 h-1.5 w-1.5 rounded-full bg-texto-suave/60" />}
      {aviso && (
        <p role="status" className="fixed inset-x-0 top-4 z-50 mx-auto w-fit rounded-full border border-borde bg-superficie px-4 py-2 text-sm text-texto shadow-lg">
          {aviso}
        </p>
      )}
    </>
  );
}
