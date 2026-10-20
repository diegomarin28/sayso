"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  leerCuenta,
  olvidarSesion,
  salir,
  type EstadoCuenta,
} from "../_datos/cuenta";
import { Persona } from "./experto";

/**
 * Arriba a la derecha del inicio. Sin cuenta: "Iniciar sesión" y, en pantallas anchas, también
 * "Registrarte" (en el celular no entra: se llega desde "Iniciar sesión"). Con cuenta: la inicial
 * (y el nombre, si entra), que abre un menú como el de cualquier app: mis casos, configuración,
 * saber más y cerrar sesión. En el celular el menú sube desde abajo con el fondo oscurecido (no tapa
 * media pantalla); en pantallas anchas es un desplegable. Sin login configurado no se muestra.
 */

// Las mismas píldoras que "Mis casos" (acento) e "Inicio" (superficie).
const PILDORA =
  "h-11 shrink-0 items-center gap-1.5 rounded-full border text-sm font-medium transition active:scale-[0.98]";

/** La sesión de este navegador (null mientras carga o si falla) y cómo volver a leerla. */
export function useCuenta(): [EstadoCuenta | null, () => void] {
  const [cuenta, setCuenta] = useState<EstadoCuenta | null>(null);
  const recargar = useCallback(() => {
    leerCuenta()
      .then(setCuenta)
      .catch(() => setCuenta(null));
  }, []);
  useEffect(recargar, [recargar]);
  return [cuenta, recargar];
}

export function BotonSesion({
  cuenta,
  alCambiar,
}: {
  cuenta: EstadoCuenta | null;
  alCambiar: () => void;
}) {
  if (!cuenta?.configurado) return null;
  if (cuenta.sesion && !cuenta.anonima)
    return <MenuCuenta cuenta={cuenta} alCambiar={alCambiar} />;
  return (
    <div className="flex shrink-0 gap-2">
      <Link
        href="/cuenta"
        className={`flex ${PILDORA} border-acento/60 bg-acento/10 pr-4 pl-3`}
      >
        <Persona /> Iniciar sesión
      </Link>
      <Link
        href="/cuenta?modo=crear"
        className={`hidden md:flex ${PILDORA} border-borde bg-superficie px-4`}
      >
        Registrarte
      </Link>
    </div>
  );
}

function MenuCuenta({
  cuenta,
  alCambiar,
}: {
  cuenta: EstadoCuenta;
  alCambiar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const inicial = (cuenta.nombre ?? cuenta.email ?? "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  // Se cierra tocando afuera o con Escape.
  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) =>
      e.key === "Escape" && setAbierto(false);
    document.addEventListener("pointerdown", afuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", afuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  async function cerrarSesion() {
    setSaliendo(true);
    try {
      await salir();
    } catch {
      // si falla, la sesión sigue: se vuelve a leer igual
    }
    olvidarSesion();
    setSaliendo(false);
    setAbierto(false);
    alCambiar();
  }

  return (
    <div ref={caja} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className={`flex ${PILDORA} border-borde bg-superficie p-1 md:pr-4`}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-acento font-semibold text-black">
          {inicial}
        </span>
        {cuenta.nombre && (
          <span className="hidden max-w-32 truncate md:inline">
            {cuenta.nombre}
          </span>
        )}
      </button>

      {abierto && (
        <>
          {/* Celular: oscurece lo de atrás y se cierra tocándolo. En pantallas anchas no se ve. */}
          <div
            aria-hidden
            onClick={() => setAbierto(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] md:hidden"
          />
          <div
            role="menu"
            className="aparece fixed inset-x-0 bottom-0 z-50 overflow-hidden rounded-t-3xl border-t border-borde bg-superficie pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black/60 md:absolute md:inset-x-auto md:top-full md:right-0 md:bottom-auto md:mt-2 md:w-72 md:rounded-2xl md:border md:pb-2"
          >
            {/* La barrita de las hojas que suben desde abajo (solo en el celular). */}
            <div
              aria-hidden
              className="mx-auto mb-2 h-1 w-10 rounded-full bg-borde md:hidden"
            />
            <div className="px-4 pt-1 pb-3">
              {cuenta.nombre && (
                <p className="truncate font-semibold">{cuenta.nombre}</p>
              )}
              <p className="truncate text-sm text-texto-suave">
                {cuenta.email}
              </p>
            </div>
            <Separador />
            <Opcion href="/casos" icono={<IconoCasos />}>
              Mis casos
            </Opcion>
            <Opcion href="/cuenta" icono={<IconoConfiguracion />}>
              Configuración
            </Opcion>
            <Separador />
            <p className="px-4 pt-2 pb-1 font-mono text-[11px] tracking-widest text-texto-suave uppercase">
              Saber más
            </p>
            <Opcion href="/como-funciona" icono={<IconoAyuda />}>
              Cómo funciona
            </Opcion>
            <Opcion href="/terminos" icono={<IconoDocumento />}>
              Términos y condiciones
            </Opcion>
            <Opcion href="/privacidad" icono={<IconoCandado />}>
              Privacidad
            </Opcion>
            <Separador />
            <button
              type="button"
              role="menuitem"
              disabled={saliendo}
              onClick={() => void cerrarSesion()}
              className="flex h-12 w-full items-center gap-3 px-4 text-left text-sm transition hover:bg-fondo/60 disabled:opacity-40"
            >
              <IconoSalir />
              {saliendo ? "Cerrando sesión…" : "Cerrar sesión"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Opcion({
  href,
  icono,
  children,
}: {
  href: string;
  icono: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex h-12 items-center gap-3 px-4 text-sm transition hover:bg-fondo/60"
    >
      {icono}
      {children}
    </Link>
  );
}

const Separador = () => <div className="my-1 h-px bg-borde" />;

/** Íconos de línea, con el mismo trazo que los de la app (experto.tsx). */
function Icono({ children }: { children: ReactNode }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-texto-suave"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const IconoCasos = () => (
  <Icono>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M7 9h10M7 13h10M7 17h6" />
  </Icono>
);
const IconoConfiguracion = () => (
  <Icono>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Icono>
);
const IconoAyuda = () => (
  <Icono>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.3-2.4 3.8M12 17.5v.01" />
  </Icono>
);
const IconoDocumento = () => (
  <Icono>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </Icono>
);
const IconoCandado = () => (
  <Icono>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Icono>
);
const IconoSalir = () => (
  <Icono>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Icono>
);
