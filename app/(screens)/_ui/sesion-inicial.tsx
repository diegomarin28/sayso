"use client";

import { useEffect } from "react";
import { asegurarSesion, registrarCaptcha } from "../_datos/cuenta";
import { useCaptcha } from "./captcha";

/**
 * Sesión anónima desde el primer uso (docs/login.md §1): al abrir la app, si no hay sesión, pide una
 * con el token de Turnstile. Casi siempre la persona no ve nada. Si Cloudflare pide tocar el
 * recuadro, aparece como una franja abajo, con fondo y una explicación, y la página deja ese lugar
 * libre para que no tape ningún botón.
 * En modo de prueba (NEXT_PUBLIC_DATOS=fixture) no se guarda nada, así que tampoco pide sesión.
 */

const SIN_SESION = process.env.NEXT_PUBLIC_DATOS === "fixture";

export function SesionInicial() {
  const { elemento, obtener, interactivo } = useCaptcha();
  useEffect(() => {
    if (SIN_SESION) return;
    registrarCaptcha(obtener);
    void asegurarSesion();
    return () => registrarCaptcha(null);
  }, [obtener]);
  // Mientras la franja está abierta, el final de la página queda libre (no tapa "Seguir" ni "Crear cuenta").
  useEffect(() => {
    document.body.style.paddingBottom = interactivo ? "9rem" : "";
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [interactivo]);
  if (SIN_SESION) return null;
  return (
    <div
      className={
        interactivo
          ? "fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-3 border-t border-borde bg-fondo/95 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur"
          : "pointer-events-none fixed inset-x-0 bottom-0 z-50 h-0 overflow-hidden"
      }
      role={interactivo ? "dialog" : undefined}
      aria-label={interactivo ? "Confirmá que sos una persona" : undefined}
    >
      {interactivo && (
        <p className="max-w-sm text-center text-sm text-texto-suave">
          Confirmá que sos una persona para seguir. Es un paso de Cloudflare para frenar a los robots.
        </p>
      )}
      {elemento}
    </div>
  );
}
