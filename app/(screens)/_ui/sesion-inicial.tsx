"use client";

import { useEffect } from "react";
import { asegurarSesion, registrarCaptcha } from "../_datos/cuenta";
import { useCaptcha } from "./captcha";

/**
 * Sesión anónima desde el primer uso (docs/login.md §1): al abrir la app, si no hay sesión, pide una
 * con el token de Turnstile. La persona no ve nada salvo que Cloudflare pida tocar el recuadro.
 * En modo de prueba (NEXT_PUBLIC_DATOS=fixture) no se guarda nada, así que tampoco pide sesión.
 */

const SIN_SESION = process.env.NEXT_PUBLIC_DATOS === "fixture";

export function SesionInicial() {
  const { elemento, obtener } = useCaptcha();
  useEffect(() => {
    if (SIN_SESION) return;
    registrarCaptcha(obtener);
    void asegurarSesion();
    return () => registrarCaptcha(null);
  }, [obtener]);
  if (SIN_SESION) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50">
      <div className="pointer-events-auto">{elemento}</div>
    </div>
  );
}
