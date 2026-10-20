"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile (docs/login.md §1): prueba que hay una persona antes de crear una sesión o
 * mandar un código. El token viaja a nuestra ruta y Supabase lo verifica; la clave secreta vive solo
 * en Supabase. Casi siempre no se ve: el recuadro aparece solo si Cloudflare pide tocarlo.
 * Sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no carga nada y `obtener()` devuelve undefined (sirve con el
 * CAPTCHA apagado en Supabase, para desarrollo).
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** Los tokens duran 5 minutos; si en 1 minuto no hay token, se sigue sin él y la ruta responde el error. */
const ESPERA_MS = 60_000;

type Turnstile = {
  render: (el: HTMLElement, opciones: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let cargando: Promise<Turnstile> | null = null;

function cargarTurnstile(): Promise<Turnstile> {
  cargando ??= new Promise<Turnstile>((resolver, rechazar) => {
    if (window.turnstile) return resolver(window.turnstile);
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? resolver(window.turnstile) : rechazar(new Error("Turnstile no cargó")));
    s.onerror = () => {
      cargando = null;
      rechazar(new Error("Turnstile no cargó"));
    };
    document.head.appendChild(s);
  });
  return cargando;
}

/** `elemento` va en la pantalla (ahí aparece el recuadro si hace falta); `obtener()` pide un token nuevo. */
export function useCaptcha() {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const pendiente = useRef<((token: string | undefined) => void) | null>(null);

  useEffect(
    () => () => {
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    },
    [],
  );

  const obtener = useCallback(async (): Promise<string | undefined> => {
    if (!SITE_KEY || !ref.current) return undefined;
    const t = await cargarTurnstile().catch(() => null);
    if (!t || !ref.current) return undefined;
    pendiente.current?.(undefined);
    const token = new Promise<string | undefined>((resolver) => {
      pendiente.current = resolver;
      setTimeout(() => resolver(undefined), ESPERA_MS);
    });
    const responder = (valor: string | undefined) => {
      pendiente.current?.(valor);
      pendiente.current = null;
    };
    if (!widget.current) {
      widget.current = t.render(ref.current, {
        sitekey: SITE_KEY,
        execution: "execute",
        appearance: "interaction-only",
        language: "es",
        callback: (v: string) => responder(v),
        "error-callback": () => responder(undefined),
        "expired-callback": () => responder(undefined),
      });
    } else {
      t.reset(widget.current);
    }
    t.execute(widget.current);
    return token;
  }, []);

  const elemento = <div ref={ref} className="flex justify-center empty:hidden" />;
  return { elemento, obtener };
}
