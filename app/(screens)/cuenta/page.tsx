"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  borrarCuenta,
  ErrorCuenta,
  leerCuenta,
  olvidarSesion,
  pedirCodigo,
  reclamarCasos,
  RUTA_EXPORTAR,
  salir,
  verificarCodigo,
  type EstadoCuenta,
} from "../_datos/cuenta";
import { borrarLocal } from "../_datos/mis-casos";
import { useCaptcha } from "../_ui/captcha";
import { BotonPrincipal, BotonSecundario, DiceExperto, Flecha, FlechaAtras, Pantalla } from "../_ui/experto";

/**
 * Cuenta (docs/login.md §2, §4 y §5): "Guardar mis casos" con un código por email, y con la cuenta
 * ya guardada, salir, exportar y borrar. Todo por `/api/cuenta/*`: la sesión es una cookie httpOnly.
 */

type Paso = "email" | "codigo";

const ENTRADA =
  "h-14 w-full rounded-2xl border border-borde bg-superficie px-4 text-lg focus:border-acento/60 focus:outline-none";

export default function Cuenta() {
  const router = useRouter();
  const captcha = useCaptcha();
  const [cuenta, setCuenta] = useState<EstadoCuenta | null>(null);
  const [paso, setPaso] = useState<Paso>("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  const recargar = useCallback(async () => {
    try {
      setCuenta(await leerCuenta());
    } catch {
      setCuenta({ configurado: false, sesion: false, anonima: false, email: null });
    }
  }, []);
  useEffect(() => {
    // Leer la sesión al entrar: el estado sale del servidor, no hay otra forma de saberlo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recargar();
  }, [recargar]);

  async function hacer(accion: () => Promise<void>) {
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      await accion();
    } catch (e) {
      setError(e instanceof ErrorCuenta ? e.message : "No se pudo. Probá de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  const mandarCodigo = () =>
    hacer(async () => {
      await pedirCodigo(email, await captcha.obtener());
      setPaso("codigo");
      setCodigo("");
    });

  const confirmarCodigo = () =>
    hacer(async () => {
      const r = await verificarCodigo(email, codigo);
      let mensaje = "Listo: tus casos quedan guardados con tu email.";
      if (r.reclamoPendiente) {
        const { reclamados } = await reclamarCasos();
        if (reclamados > 0) mensaje = `Listo: pasamos ${reclamados === 1 ? "1 caso" : `${reclamados} casos`} a tu cuenta.`;
      }
      olvidarSesion();
      setPaso("email");
      await recargar();
      setAviso(mensaje);
    });

  const cerrarSesion = () =>
    hacer(async () => {
      await salir();
      olvidarSesion();
      await recargar();
      setAviso("Saliste de tu cuenta en este celular.");
    });

  const borrar = () =>
    hacer(async () => {
      await borrarCuenta();
      borrarLocal();
      olvidarSesion();
      setConfirmarBorrado(false);
      await recargar();
      setAviso("Borramos tu cuenta, tus casos y sus fotos.");
    });

  const conEmail = cuenta?.sesion && !cuenta.anonima;
  const texto = !cuenta
    ? "Un segundo…"
    : !cuenta.configurado
      ? "Guardar tus casos con tu email todavía no está disponible. Mientras, quedan en este celular."
      : conEmail
        ? `Tus casos están guardados con ${cuenta.email ?? "tu email"}. Podés retomarlos desde cualquier celular.`
        : paso === "codigo"
          ? `Te mandamos un código a ${email}. Escribilo acá.`
          : "Guardá tus casos con tu email para no perderlos si cambiás de celular o se borran los datos.";

  return (
    <Pantalla>
      <header className="flex items-center gap-3">
        <button
          onClick={() => router.push("/casos")}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-borde bg-superficie pr-4 pl-3 text-sm font-medium"
        >
          <FlechaAtras /> Mis casos
        </button>
        <p className="text-xs font-medium tracking-widest text-texto-suave uppercase">Cuenta</p>
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

      {cuenta?.configurado && !conEmail && paso === "email" && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void mandarCodigo();
          }}
        >
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-texto-suave">Tu email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@ejemplo.com"
              className={ENTRADA}
            />
          </label>
          <BotonPrincipal type="submit" disabled={ocupado || !email.includes("@")}>
            {ocupado ? "Mandando…" : "Mandarme el código"} <Flecha />
          </BotonPrincipal>
          <p className="text-xs text-texto-suave">
            Si ya tenés cuenta, usá el mismo email: los casos de este celular pasan a tu cuenta. No usamos tu
            email para nada más.
          </p>
        </form>
      )}

      {cuenta?.configurado && !conEmail && paso === "codigo" && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void confirmarCodigo();
          }}
        >
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-texto-suave">Código</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className={`${ENTRADA} tracking-[0.4em]`}
            />
          </label>
          <BotonPrincipal type="submit" disabled={ocupado || codigo.length < 6}>
            {ocupado ? "Revisando…" : "Confirmar"} <Flecha />
          </BotonPrincipal>
          <div className="flex justify-between gap-3 text-sm">
            <button type="button" className="underline" disabled={ocupado} onClick={() => setPaso("email")}>
              Cambiar el email
            </button>
            <button type="button" className="underline" disabled={ocupado} onClick={() => void mandarCodigo()}>
              Mandar otro código
            </button>
          </div>
        </form>
      )}

      {/* Un solo widget para los dos pasos: "Mandar otro código" reusa el mismo. */}
      {cuenta?.configurado && !conEmail && captcha.elemento}

      {cuenta?.sesion && (
        <section className="mt-auto flex flex-col gap-3">
          <a
            href={RUTA_EXPORTAR}
            download
            className="flex h-14 w-full items-center justify-center rounded-2xl border border-borde text-lg font-medium"
          >
            Exportar mis casos
          </a>
          {conEmail && (
            <BotonSecundario disabled={ocupado} onClick={() => void cerrarSesion()}>
              Salir en este celular
            </BotonSecundario>
          )}
          {confirmarBorrado ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-peligro/40 p-4">
              <p className="text-sm">
                Se borran para siempre tus casos, sus fotos y {conEmail ? "tu cuenta" : "lo guardado en nuestro servidor"},
                también la copia de este celular. No se puede deshacer.
              </p>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void borrar()}
                className="h-12 rounded-xl bg-peligro font-semibold text-black active:scale-[0.98] disabled:opacity-30"
              >
                {ocupado ? "Borrando…" : "Sí, borrar todo"}
              </button>
              <button type="button" className="text-sm underline" onClick={() => setConfirmarBorrado(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="h-11 text-sm text-peligro underline"
              onClick={() => setConfirmarBorrado(true)}
            >
              {conEmail ? "Borrar mi cuenta" : "Borrar mis datos"}
            </button>
          )}
        </section>
      )}
    </Pantalla>
  );
}
