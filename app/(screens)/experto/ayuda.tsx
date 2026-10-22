"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDialogo } from "../../../lib/a11y/useDialogo";
import { Cubo, Globo, Libro } from "@/components/viewer/guia/iconos";
import { Microfono } from "../_ui/experto";
import { Carrito } from "./repuestos";

/**
 * "Así se usa esta pantalla": la primera vez que se entra al experto, qué es cada ícono (casi todos
 * son solo un dibujo y el número del carrito se leía como "6 cosas para comprar"). Una sola vez por
 * celular; si el navegador no deja guardar, aparece cada vez que se entra (no rompe nada).
 */

const CLAVE = "sayso:ayuda-experto-vista";

function yaVista(): boolean {
  try {
    return localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

function marcarVista() {
  try {
    localStorage.setItem(CLAVE, "1");
  } catch {
    // Modo privado o almacenamiento bloqueado: se vuelve a mostrar la próxima vez.
  }
}

/** true la primera vez (se decide en el navegador, después de montar: en el servidor no hay localStorage). */
export function useAyudaExperto(): [boolean, () => void] {
  const [abierta, setAbierta] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el navegador
    if (!yaVista()) setAbierta(true);
  }, []);
  return [
    abierta,
    () => {
      marcarVista();
      setAbierta(false);
    },
  ];
}

const ITEMS: { icono: ReactNode; titulo: string; detalle: string }[] = [
  {
    icono: <Carrito />,
    titulo: "Repuestos",
    detalle: "Dónde comprar las piezas. El número es cuántas podés buscar; «!» marca la que hay que cambiar.",
  },
  { icono: <Cubo size={20} />, titulo: "El 3D", detalle: "Cambiar la vista y ver de dónde salen las ubicaciones de las piezas." },
  {
    icono: <Globo size={20} />,
    titulo: "Chat con el experto",
    detalle: "Tocá el ícono de mensajes para ver lo que hablamos y preguntar. El número es cuántas preguntas hiciste.",
  },
  { icono: <Libro size={20} />, titulo: "¿De dónde sale esto?", detalle: "El manual o la guía de donde salen los pasos, y el origen del 3D." },
  { icono: <Microfono size={20} />, titulo: "Preguntar con la voz", detalle: "Está en el chat, al lado del campo. También podés escribir ahí." },
];

export function AyudaExperto({ onCerrar }: { onCerrar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // El foco va al cartel (se lee el título) y no al botón de abajo, que en un celular chico haría saltar el scroll.
  useDialogo(ref, onCerrar, { foco: "contenedor" });
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Así se usa esta pantalla"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center md:p-6"
      onClick={onCerrar}
    >
      <div
        className="aparece flex max-h-[90dvh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-3xl border border-borde bg-fondo px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:rounded-3xl md:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-semibold">Así se usa esta pantalla</p>
        <p className="-mt-2 text-sm text-texto-suave">
          Seguí los pasos con «Siguiente» y mirá cada pieza en el 3D. Si tenés una duda, preguntame.
        </p>
        <ul className="flex flex-col gap-3">
          {ITEMS.map((i) => (
            <li key={i.titulo} className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-borde bg-superficie text-texto"
              >
                {i.icono}
              </span>
              <span className="min-w-0 text-sm">
                <span className="block font-semibold">{i.titulo}</span>
                <span className="block text-texto-suave">{i.detalle}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-texto-suave">
          Cuando termines, tocá <span className="font-semibold text-texto">Terminar</span> y contame cómo quedó: el
          caso queda en «Mis casos».
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="h-12 shrink-0 rounded-xl bg-acento font-semibold text-black active:scale-[0.98]"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
