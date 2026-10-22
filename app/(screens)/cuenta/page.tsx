"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { contrasenaValida, emailValido, nombreValido, REGLA_CONTRASENA } from "../../../lib/supabase/credenciales";
import { fraseCaptcha } from "../_ui/captcha-codigos";
import {
  asegurarSesion,
  borrarCuenta,
  crearCuenta,
  entrar,
  ErrorCuenta,
  leerCuenta,
  olvidarSesion,
  recuperar,
  salir,
  verificarCodigo,
  type EstadoCuenta,
} from "../_datos/cuenta";
import { borrarLocal } from "../_datos/mis-casos";
import { useCaptcha } from "../_ui/captcha";
import { AjustesCuenta } from "./ajustes";
import { BotonPrincipal, DiceExperto, Flecha, FlechaAtras, Pantalla } from "../_ui/experto";

/**
 * Cuenta (docs/login.md §2, §4 y §5): iniciar sesión con email y contraseña, crear la cuenta
 * (confirmando el email con un código) y "Olvidé mi contraseña". Con la cuenta ya iniciada: salir,
 * exportar y borrar. Todo por `/api/cuenta/*`: la sesión es una cookie httpOnly. La app se usa
 * igual sin cuenta (sesión anónima); la cuenta sirve para no perder los casos.
 */

type Modo = "entrar" | "crear" | "recuperar";
type Paso = "datos" | "codigo";

const ENTRADA =
  "h-14 w-full rounded-2xl border border-borde bg-superficie px-4 text-lg focus:border-acento/60 focus:outline-none";

const TEXTO: Record<Modo, Record<Paso, string>> = {
  entrar: {
    datos: "Iniciá sesión para retomar tus casos desde cualquier celular. También podés seguir sin cuenta.",
    codigo: "",
  },
  crear: {
    datos: "Creá tu cuenta para no perder tus casos. Los de este dispositivo quedan guardados en ella.",
    codigo: "Te mandamos un código al email. Escribilo para confirmar que es tuyo.",
  },
  recuperar: {
    datos: "Te mandamos un código al email para que elijas una contraseña nueva.",
    codigo: "Si ese email tiene cuenta, te mandamos un código. Escribilo y elegí la contraseña nueva.",
  },
};

export default function Cuenta() {
  const router = useRouter();
  const captcha = useCaptcha();
  const [cuenta, setCuenta] = useState<EstadoCuenta | null>(null);
  const [modo, setModo] = useState<Modo>("entrar");
  const [paso, setPaso] = useState<Paso>("datos");
  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [repetida, setRepetida] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [ver, setVer] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [tocado, setTocado] = useState({ email: false, contrasena: false, repetida: false, nombre: false });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** La verificación de Cloudflare falló (en el navegador o al revisarla Supabase): aviso aparte, no error. */
  const [falloCaptcha, setFalloCaptcha] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  /** No se pudo leer la cuenta (sin red o el servidor falló): no es lo mismo que "sin cuentas". */
  const [sinConexion, setSinConexion] = useState(false);
  const recargar = useCallback(async () => {
    try {
      setCuenta(await leerCuenta());
      setSinConexion(false);
    } catch {
      setCuenta(null);
      setSinConexion(true);
    }
  }, []);
  useEffect(() => {
    // "Registrarte" y "Guardar mis casos" llegan con ?modo=crear; la sesión sale del servidor.
    const pedido = new URLSearchParams(window.location.search).get("modo");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pedido === "crear" || pedido === "recuperar") setModo(pedido);
    void recargar();
  }, [recargar]);

  /** Cambia entre entrar, crear y recuperar. El email escrito se mantiene. */
  function cambiarModo(m: Modo, { limpiarError = true } = {}) {
    setModo(m);
    setPaso("datos");
    setCodigo("");
    setTocado({ email: false, contrasena: false, repetida: false, nombre: false });
    setRepetida("");
    if (limpiarError) setError(null);
    setAviso(null);
  }

  async function hacer(accion: () => Promise<void>) {
    setOcupado(true);
    setError(null);
    setAviso(null);
    setFalloCaptcha(false);
    try {
      await accion();
    } catch (e) {
      if (e instanceof ErrorCuenta && e.codigo === "captcha") {
        setFalloCaptcha(true);
        captcha.reintentar();
        return;
      }
      setError(e instanceof ErrorCuenta ? e.message : "No se pudo. Probá de nuevo.");
      // "Ese email ya tiene cuenta": pasa a entrar con el email ya escrito.
      if (e instanceof ErrorCuenta && e.codigo === "existe") cambiarModo("entrar", { limpiarError: false });
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Después de entrar o de crear la cuenta se vuelve al inicio, que ya saluda por el nombre; o a la
   * pantalla que pidió la sesión (`?vuelta=`, por ejemplo Mis casos al reintentar). Solo rutas de la app.
   */
  const alInicio = () => {
    olvidarSesion();
    // Se resuelve contra el origen actual: "/\evil.com" o "//evil.com" salen de la app y se descartan.
    const vuelta = new URLSearchParams(window.location.search).get("vuelta");
    const destino = new URL(vuelta ?? "/", window.location.origin);
    router.push(destino.origin === window.location.origin ? destino.pathname + destino.search : "/");
  };



  const enviarDatos = () =>
    hacer(async () => {
      if (modo === "entrar") {
        await entrar(email, contrasena, await captcha.obtener());
        alInicio();
      } else if (modo === "crear") {
        // La cuenta nace de la sesión anónima de este celular: si todavía no hay, se pide.
        await asegurarSesion();
        await crearCuenta(email, contrasena);
        setPaso("codigo");
      } else {
        await recuperar(email, await captcha.obtener());
        setPaso("codigo");
      }
    });

  const confirmarCodigo = () =>
    hacer(async () => {
      const motivo = modo === "crear" ? "crear" : "recuperar";
      const perfil =
        motivo === "crear" ? { nombre: nombre.trim(), apellido: apellido.trim(), acepta: true as const } : undefined;
      await verificarCodigo(motivo, email, codigo, contrasena, perfil);
      alInicio();
    });

  const cerrarSesion = () =>
    hacer(async () => {
      await salir();
      // Los casos siguen en el servidor y vuelven al entrar; en un celular compartido no quedan a la vista.
      borrarLocal();
      olvidarSesion();
      await recargar();
      setAviso("Saliste de tu cuenta en este dispositivo. Podés seguir usando la app sin cuenta.");
    });

  const borrar = () =>
    hacer(async () => {
      await borrarCuenta();
      borrarLocal();
      olvidarSesion();
      await recargar();
      setAviso("Borramos tu cuenta, tus casos y sus fotos.");
    });

  const conEmail = cuenta?.sesion && !cuenta.anonima;
  // Crear pide la contraseña con el email; recuperar, con el código (es la nueva).
  const pideContrasena = paso === "datos" ? modo !== "recuperar" : modo === "recuperar";
  const contrasenaNueva = modo !== "entrar";
  const emailMal = tocado.email && !emailValido(email);
  const contrasenaMal = contrasenaNueva && tocado.contrasena && !contrasenaValida(contrasena);
  // Entrar y pedir el código de "Olvidé mi contraseña" llevan la verificación de Cloudflare.
  // ("Mandar otro código" también la usa: el widget queda montado en los dos pasos.)
  const conCaptcha = modo !== "crear";
  const esperandoCaptcha = conCaptcha && paso === "datos" && !captcha.listo;
  // Crear pide además nombre, apellido y repetir la contraseña.
  const pidePerfil = modo === "crear" && paso === "datos";
  const nombreMal = pidePerfil && tocado.nombre && (!nombreValido(nombre) || !nombreValido(apellido));
  const repetidaMal = pidePerfil && tocado.repetida && repetida !== contrasena;
  const puedeEnviar =
    (!pidePerfil || (nombreValido(nombre) && nombreValido(apellido) && repetida === contrasena && acepta)) &&
    emailValido(email) &&
    (!pideContrasena || (contrasenaNueva ? contrasenaValida(contrasena) : contrasena.length > 0)) &&
    (paso === "datos" || codigo.length >= 6);

  const texto = !cuenta
    ? sinConexion
      ? "No pude conectar para ver tu cuenta. Revisá internet y probá de nuevo."
      : "Un segundo…"
    : !cuenta.configurado
      ? "Las cuentas todavía no están disponibles. Podés usar la app igual: tus casos quedan en este dispositivo."
      : conEmail
        ? `${cuenta.nombre ? `Hola, ${cuenta.nombre}. ` : ""}Tus casos quedan guardados en tu cuenta.`
        : TEXTO[modo][paso];

  const titulo = conEmail ? "Cuenta" : { entrar: "Iniciar sesión", crear: "Crear cuenta", recuperar: "Contraseña" }[modo];
  const boton =
    paso === "codigo"
      ? modo === "crear"
        ? "Confirmar"
        : "Guardar contraseña"
      : { entrar: "Entrar", crear: "Crear cuenta", recuperar: "Mandarme el código" }[modo];

  return (
    <Pantalla>
      <header className="flex items-center gap-3">
        <button
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-borde bg-superficie pr-4 pl-3 text-sm font-medium"
        >
          <FlechaAtras /> Volver
        </button>
        <p className="text-xs font-medium tracking-widest text-texto-suave uppercase">{titulo}</p>
      </header>

      <DiceExperto texto={texto} />

      {aviso && (
        <p role="status" className="rounded-2xl border border-confirmado/40 bg-confirmado/10 p-4 text-sm text-confirmado">
          {aviso}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-2xl border border-peligro/40 bg-peligro/10 p-4 text-sm text-peligro">
          {error}
        </p>
      )}

      {sinConexion && !cuenta && (
        <BotonPrincipal onClick={() => void recargar()}>Probar de nuevo</BotonPrincipal>
      )}

      {cuenta?.configurado && !conEmail && (
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTocado({ email: true, contrasena: true, repetida: true, nombre: true });
            if (puedeEnviar) void (paso === "datos" ? enviarDatos() : confirmarCodigo());
          }}
        >
          {pidePerfil && (
            <div className="flex flex-col gap-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-2">
                  <span className="text-texto-suave">Nombre</span>
                  <input
                    autoComplete="given-name"
                    placeholder="Ana"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    onBlur={() => setTocado((t) => ({ ...t, nombre: true }))}
                    className={`${ENTRADA} ${nombreMal && !nombreValido(nombre) ? "border-peligro/60" : ""}`}
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-texto-suave">Apellido</span>
                  <input
                    autoComplete="family-name"
                    placeholder="Pérez"
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    onBlur={() => setTocado((t) => ({ ...t, nombre: true }))}
                    className={`${ENTRADA} ${nombreMal && !nombreValido(apellido) ? "border-peligro/60" : ""}`}
                  />
                </label>
              </div>
              {nombreMal && <span className="text-peligro">Escribí tu nombre y tu apellido, solo con letras.</span>}
            </div>
          )}

          {paso === "datos" && (
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-texto-suave">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTocado((t) => ({ ...t, email: true }))}
                placeholder="nombre@ejemplo.com"
                aria-invalid={emailMal}
                className={`${ENTRADA} ${emailMal ? "border-peligro/60" : ""}`}
              />
              {emailMal && <span className="text-peligro">Revisá el email: tiene que ser como nombre@ejemplo.com.</span>}
            </label>
          )}

          {paso === "codigo" && (
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-texto-suave">Código que llegó a {email}</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={10}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className={`${ENTRADA} tracking-[0.4em]`}
              />
            </label>
          )}

          {pideContrasena && (
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-texto-suave">{modo === "recuperar" ? "Contraseña nueva" : "Contraseña"}</span>
              <div className="relative">
                <input
                  type={ver ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete={contrasenaNueva ? "new-password" : "current-password"}
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  onBlur={() => setTocado((t) => ({ ...t, contrasena: true }))}
                  aria-invalid={contrasenaMal}
                  className={`${ENTRADA} pr-20 ${contrasenaMal ? "border-peligro/60" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setVer((v) => !v)}
                  className="absolute inset-y-0 right-0 px-4 text-sm text-texto-suave"
                >
                  {ver ? "Ocultar" : "Ver"}
                </button>
              </div>
              {contrasenaNueva && (
                <span className={contrasenaMal ? "text-peligro" : "text-texto-suave"}>{REGLA_CONTRASENA}</span>
              )}
            </label>
          )}

          {pidePerfil && (
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-texto-suave">Repetí la contraseña</span>
              <div className="relative">
                <input
                  type={ver ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={repetida}
                  onChange={(e) => setRepetida(e.target.value)}
                  onBlur={() => setTocado((t) => ({ ...t, repetida: true }))}
                  aria-invalid={repetidaMal}
                  className={`${ENTRADA} pr-20 ${repetidaMal ? "border-peligro/60" : ""}`}
                />
                {/* El mismo "Ver" que la contraseña: muestra u oculta las dos. */}
                <button
                  type="button"
                  onClick={() => setVer((v) => !v)}
                  className="absolute inset-y-0 right-0 px-4 text-sm text-texto-suave"
                >
                  {ver ? "Ocultar" : "Ver"}
                </button>
              </div>
              {repetidaMal && <span className="text-peligro">Las contraseñas no coinciden.</span>}
            </label>
          )}

          {pidePerfil && (
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={acepta}
                onChange={(e) => setAcepta(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--acento)]"
              />
              <span className={tocado.nombre && !acepta ? "text-peligro" : "text-texto-suave"}>
                Acepto los{" "}
                <a href="/terminos" target="_blank" rel="noopener" className="font-medium text-texto underline">
                  Términos y condiciones
                </a>{" "}
                y la{" "}
                <a href="/privacidad" target="_blank" rel="noopener" className="font-medium text-texto underline">
                  Política de privacidad
                </a>
                .
              </span>
            </label>
          )}

          {/* El recuadro de Cloudflare, si pide tocarlo, queda justo antes del botón que espera. */}
          {conCaptcha && captcha.elemento}
          {conCaptcha && (falloCaptcha || captcha.estado === "fallo") && (
            <div role="status" className="flex flex-col gap-2 rounded-2xl border border-probable/40 bg-probable/10 p-4 text-sm">
              <p className="font-medium text-probable">No pudimos confirmar que sos una persona</p>
              <p className="text-texto-suave">
                Puede pasar por un bloqueador de anuncios, el modo privado u otra causa. Probá con otro navegador o
                más tarde.
              </p>
              {captcha.codigoError && (
                <p className="text-xs text-texto-suave">
                  Código: {captcha.codigoError}. {fraseCaptcha(captcha.codigoError)}
                </p>
              )}
              <button
                type="button"
                className="self-start font-medium text-texto underline"
                onClick={() => {
                  setFalloCaptcha(false);
                  captcha.reintentar();
                }}
              >
                Volver a intentar
              </button>
            </div>
          )}

          <BotonPrincipal type="submit" disabled={ocupado || esperandoCaptcha}>
            {ocupado ? "Un segundo…" : boton} <Flecha />
          </BotonPrincipal>
          {esperandoCaptcha && captcha.estado === "verificando" && (
            <p className="-mt-2 text-center text-xs text-texto-suave">Comprobando que sos una persona…</p>
          )}

          <div className="flex flex-col items-center gap-3 text-sm">
            {paso === "codigo" && (
              <button type="button" className="underline" disabled={ocupado} onClick={() => void enviarDatos()}>
                Mandar otro código
              </button>
            )}
            {modo === "entrar" && (
              <>
                <button type="button" className="underline" onClick={() => cambiarModo("recuperar")}>
                  Olvidé mi contraseña
                </button>
                <p className="text-texto-suave">
                  ¿No tenés cuenta?{" "}
                  <button type="button" className="font-medium text-texto underline" onClick={() => cambiarModo("crear")}>
                    Registrate
                  </button>
                </p>
              </>
            )}
            {modo !== "entrar" && (
              <p className="text-texto-suave">
                ¿Ya tenés cuenta?{" "}
                <button type="button" className="font-medium text-texto underline" onClick={() => cambiarModo("entrar")}>
                  Iniciar sesión
                </button>
              </p>
            )}
          </div>
          <p className="text-center text-xs text-texto-suave">
            Tu email es solo para entrar y recuperar tus casos. La sesión queda abierta en este dispositivo hasta que
            toques «Salir de este dispositivo» en Cuenta.
          </p>
        </form>
      )}

      {/* Con cuenta: secciones de cuenta, seguridad, datos y borrar (como en la configuración de cualquier página). */}
      {conEmail && (
        <AjustesCuenta
          email={cuenta.email ?? ""}
          nombre={cuenta.nombre}
          ocupado={ocupado}
          alSalir={() => void cerrarSesion()}
          alBorrar={() => void borrar()}
        />
      )}
    </Pantalla>
  );
}
