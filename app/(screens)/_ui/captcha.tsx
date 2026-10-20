"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile (docs/login.md §1): prueba que hay una persona antes de crear una sesión o
 * de iniciar sesión. El token viaja a nuestra ruta y Supabase lo verifica; la clave secreta vive solo
 * en Supabase. La verificación arranca al montar la pantalla, así el botón puede esperar a que esté
 * lista (`listo`). Casi siempre no se ve: el recuadro aparece solo si Cloudflare pide tocarlo.
 * Cada token sirve una vez: `obtener()` lo usa y pide otro. Sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no
 * carga nada, `listo` es true y `obtener()` devuelve undefined (CAPTCHA apagado en Supabase, desarrollo).
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** Si en 1 minuto no hay token, se sigue sin él y la ruta responde el error. */
const ESPERA_MS = 60_000;

export type EstadoCaptcha = "verificando" | "listo" | "fallo";

type Turnstile = {
  render: (el: HTMLElement, opciones: Record<string, unknown>) => string;
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

/** `elemento` va en la pantalla (ahí aparece el recuadro si hace falta); `obtener()` da un token y pide otro. */
export function useCaptcha() {
  // El recuadro puede aparecer después (cuando carga la pantalla) o irse y volver: el widget lo sigue.
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const widget = useRef<string | null>(null);
  const token = useRef<string | null>(null);
  const esperando = useRef<((t: string | undefined) => void)[]>([]);
  const [estado, setEstado] = useState<EstadoCaptcha>(SITE_KEY ? "verificando" : "listo");
  /** Cloudflare pide tocar el recuadro: quien lo muestra puede darle lugar y una explicación. */
  const [interactivo, setInteractivo] = useState(false);

  useEffect(() => {
    if (!SITE_KEY || !el) return;
    let vivo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstado("verificando");
    const avisar = (t: string | undefined) => {
      for (const r of esperando.current.splice(0)) r(t);
    };
    cargarTurnstile()
      .then((t) => {
        if (!vivo) return;
        widget.current = t.render(el, {
          sitekey: SITE_KEY,
          appearance: "interaction-only",
          language: "es",
          "refresh-expired": "auto",
          "before-interactive-callback": () => setInteractivo(true),
          "after-interactive-callback": () => setInteractivo(false),
          callback: (v: string) => {
            token.current = v;
            setEstado("listo");
            avisar(v);
          },
          "error-callback": () => {
            token.current = null;
            setEstado("fallo");
            avisar(undefined);
          },
          "expired-callback": () => {
            token.current = null;
            setEstado("verificando");
          },
        });
      })
      .catch(() => vivo && setEstado("fallo"));
    return () => {
      vivo = false;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
      token.current = null;
    };
  }, [el]);

  const obtener = useCallback(async (): Promise<string | undefined> => {
    if (!SITE_KEY) return undefined;
    const t =
      token.current ??
      (await new Promise<string | undefined>((resolver) => {
        esperando.current.push(resolver);
        setTimeout(() => resolver(undefined), ESPERA_MS);
      }));
    // Usado: se pide uno nuevo para el próximo intento.
    token.current = null;
    if (t && widget.current) {
      setEstado("verificando");
      window.turnstile?.reset(widget.current);
    }
    return t;
  }, []);

  /** Vuelve a intentar después de un fallo. */
  const reintentar = useCallback(() => {
    if (!widget.current) return;
    setEstado("verificando");
    window.turnstile?.reset(widget.current);
  }, []);

  const elemento = <div ref={setEl} className="flex justify-center empty:hidden" />;
  return { elemento, obtener, estado, listo: estado === "listo", reintentar, interactivo };
}
