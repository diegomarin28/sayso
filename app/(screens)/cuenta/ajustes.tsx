"use client";

import { useState, type ReactNode } from "react";
import { contrasenaValida, REGLA_CONTRASENA } from "../../../lib/supabase/credenciales";
import { ErrorCuenta, recuperar, RUTA_EXPORTAR, verificarCodigo } from "../_datos/cuenta";
import { useCaptcha } from "../_ui/captcha";
import { BotonSecundario } from "../_ui/experto";

/**
 * La cuenta con la sesión iniciada, por secciones como la configuración de cualquier página
 * (docs/login.md §2 y §5): tu cuenta y salir; seguridad (cambiar la contraseña con un código por
 * email); tus datos (descargar una copia); y borrar la cuenta, aparte y con confirmación.
 */

const ENTRADA =
  "h-12 w-full rounded-xl border border-borde bg-fondo px-4 text-base focus:border-acento/60 focus:outline-none";

function Seccion({ titulo, children, peligro = false }: { titulo: string; children: ReactNode; peligro?: boolean }) {
  return (
    <section className={`flex flex-col gap-3 rounded-2xl border bg-superficie p-4 ${peligro ? "border-peligro/40" : "border-borde"}`}>
      <h2 className={`font-mono text-xs font-medium tracking-widest uppercase ${peligro ? "text-peligro" : "text-texto-suave"}`}>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export function AjustesCuenta({
  email,
  nombre,
  ocupado,
  alSalir,
  alBorrar,
}: {
  email: string;
  nombre: string | null;
  ocupado: boolean;
  alSalir: () => void;
  alBorrar: () => void;
}) {
  const captcha = useCaptcha();
  const [cambio, setCambio] = useState<"cerrado" | "codigo">("cerrado");
  const [codigo, setCodigo] = useState("");
  const [nueva, setNueva] = useState("");
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  async function hacer(accion: () => Promise<void>) {
    setEnviando(true);
    setMensaje(null);
    try {
      await accion();
    } catch (e) {
      if (e instanceof ErrorCuenta && e.codigo === "captcha") captcha.reintentar();
      setMensaje({ tipo: "error", texto: e instanceof ErrorCuenta ? e.message : "No se pudo. Probá de nuevo." });
    } finally {
      setEnviando(false);
    }
  }

  const mandarCodigo = () =>
    hacer(async () => {
      await recuperar(email, await captcha.obtener());
      setCambio("codigo");
      setCodigo("");
      setNueva("");
    });

  const guardarContrasena = () =>
    hacer(async () => {
      await verificarCodigo("cambiar", email, codigo, nueva);
      setCambio("cerrado");
      setCodigo("");
      setNueva("");
      setMensaje({ tipo: "ok", texto: "Listo, cambiaste la contraseña." });
    });

  const nuevaMal = nueva.length > 0 && !contrasenaValida(nueva);

  return (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Tu cuenta">
        {nombre && <p className="font-semibold">{nombre}</p>}
        <p className="text-sm text-texto-suave">
          Email: <span className="break-all text-texto">{email}</span>
        </p>
        <BotonSecundario disabled={ocupado} onClick={alSalir}>
          Salir en este celular
        </BotonSecundario>
      </Seccion>

      <Seccion titulo="Seguridad">
        <p className="text-sm text-texto-suave">
          Para cambiar la contraseña te mandamos un código a tu email.
        </p>
        {mensaje && (
          <p
            role={mensaje.tipo === "error" ? "alert" : "status"}
            className={`rounded-xl border p-3 text-sm ${
              mensaje.tipo === "error"
                ? "border-peligro/40 bg-peligro/10 text-peligro"
                : "border-confirmado/40 bg-confirmado/10 text-confirmado"
            }`}
          >
            {mensaje.texto}
          </p>
        )}
        {cambio === "cerrado" ? (
          <>
            {captcha.elemento}
            <button
              type="button"
              disabled={enviando || !captcha.listo}
              onClick={() => void mandarCodigo()}
              className="flex h-12 items-center justify-center rounded-xl border border-acento/60 bg-acento/10 text-sm font-medium transition active:scale-[0.98] disabled:opacity-40"
            >
              {enviando ? "Mandando…" : captcha.listo ? "Cambiar contraseña" : "Comprobando que sos una persona…"}
            </button>
          </>
        ) : (
          <form
            className="flex flex-col gap-3"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (codigo.length >= 6 && contrasenaValida(nueva)) void guardarContrasena();
            }}
          >
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-texto-suave">Código que llegó a tu email</span>
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
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-texto-suave">Contraseña nueva</span>
              <div className="relative">
                <input
                  type={ver ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={nueva}
                  onChange={(e) => setNueva(e.target.value)}
                  aria-invalid={nuevaMal}
                  className={`${ENTRADA} pr-20 ${nuevaMal ? "border-peligro/60" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setVer((v) => !v)}
                  className="absolute inset-y-0 right-0 px-4 text-sm text-texto-suave"
                >
                  {ver ? "Ocultar" : "Ver"}
                </button>
              </div>
              <span className={nuevaMal ? "text-peligro" : "text-texto-suave"}>{REGLA_CONTRASENA}</span>
            </label>
            <button
              type="submit"
              disabled={enviando || codigo.length < 6 || !contrasenaValida(nueva)}
              className="h-12 rounded-xl bg-acento font-semibold text-black transition active:scale-[0.98] disabled:opacity-30"
            >
              {enviando ? "Guardando…" : "Guardar contraseña"}
            </button>
            <button type="button" className="text-sm underline" onClick={() => setCambio("cerrado")}>
              Cancelar
            </button>
          </form>
        )}
      </Seccion>

      <Seccion titulo="Tus datos">
        <p className="text-sm text-texto-suave">Un archivo con tus casos, fichas y fotos.</p>
        <a
          href={RUTA_EXPORTAR}
          download
          className="flex h-12 items-center justify-center rounded-xl border border-borde text-sm font-medium"
        >
          Descargar una copia de mis casos
        </a>
      </Seccion>

      <Seccion titulo="Borrar cuenta" peligro>
        {confirmarBorrado ? (
          <>
            <p className="text-sm">
              Se borran para siempre tu cuenta, tus casos y sus fotos, también la copia de este celular. No se puede
              deshacer.
            </p>
            <button
              type="button"
              disabled={ocupado}
              onClick={alBorrar}
              className="h-12 rounded-xl bg-peligro font-semibold text-black active:scale-[0.98] disabled:opacity-30"
            >
              {ocupado ? "Borrando…" : "Sí, borrar mi cuenta"}
            </button>
            <button type="button" className="text-sm underline" onClick={() => setConfirmarBorrado(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-texto-suave">Borra tu cuenta, tus casos y sus fotos para siempre.</p>
            <button
              type="button"
              onClick={() => setConfirmarBorrado(true)}
              className="h-12 rounded-xl border border-peligro/60 text-sm font-medium text-peligro"
            >
              Borrar mi cuenta
            </button>
          </>
        )}
      </Seccion>
    </div>
  );
}
