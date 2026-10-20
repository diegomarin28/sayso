/**
 * Cuenta y sesión desde las pantallas (docs/login.md). Todo pasa por `/api/cuenta/*`: la sesión
 * vive en cookies httpOnly y el navegador nunca ve el token ni habla con Supabase.
 */

export type EstadoCuenta = { configurado: boolean; sesion: boolean; anonima: boolean; email: string | null };

/** Respuesta de error de las rutas: `codigo` dice qué pasó (captcha, codigo, limite, no_disponible…). */
export class ErrorCuenta extends Error {
  constructor(
    mensaje: string,
    readonly codigo: string,
  ) {
    super(mensaje);
  }
}

async function pedir<T>(ruta: string, init?: { metodo?: string; cuerpo?: unknown }): Promise<T> {
  const res = await fetch(ruta, {
    method: init?.metodo ?? (init?.cuerpo === undefined ? "GET" : "POST"),
    headers: init?.cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: init?.cuerpo === undefined ? undefined : JSON.stringify(init.cuerpo),
    cache: "no-store",
  }).catch(() => null);
  if (!res) throw new ErrorCuenta("Sin conexión. Probá de nuevo.", "red");
  const datos = (await res.json().catch(() => ({}))) as T & { error?: string; codigo?: string };
  if (!res.ok) throw new ErrorCuenta(datos.error ?? "No se pudo. Probá de nuevo.", datos.codigo ?? String(res.status));
  return datos;
}

export const leerCuenta = () => pedir<EstadoCuenta>("/api/cuenta");
export const pedirCodigo = (email: string, captchaToken?: string) =>
  pedir<{ enviado: true }>("/api/cuenta/codigo", { cuerpo: { email, captchaToken } });
export const verificarCodigo = (email: string, codigo: string) =>
  pedir<{ verificado: true; email: string; reclamoPendiente: boolean }>("/api/cuenta/verificar", {
    cuerpo: { email, codigo },
  });
export const reclamarCasos = () => pedir<{ reclamados: number }>("/api/cuenta/reclamar", { cuerpo: {} });
export const salir = () => pedir<{ salido: true }>("/api/cuenta/salir", { cuerpo: {} });
export const borrarCuenta = () =>
  pedir<{ borrado: true; casos: number }>("/api/cuenta", { metodo: "DELETE", cuerpo: { confirmar: "borrar" } });
export const RUTA_EXPORTAR = "/api/cuenta/exportar";

// ---------- Sesión anónima desde el primer uso (§1) ----------

/** Lo registra el widget de Turnstile del layout: devuelve un token, o undefined sin site key. */
let pedirToken: (() => Promise<string | undefined>) | null = null;
let lista: Promise<boolean> | null = null;

export function registrarCaptcha(fn: (() => Promise<string | undefined>) | null) {
  pedirToken = fn;
}

/**
 * Que haya una sesión (anónima si no hay otra). Se pide una vez; `guardar()` espera esto antes de
 * mandar el caso. Devuelve false si no se pudo (sin Supabase, captcha fallido): la app sigue igual.
 */
export function asegurarSesion(): Promise<boolean> {
  lista ??= (async () => {
    try {
      const c = await leerCuenta();
      if (!c.configurado) return false;
      if (c.sesion) return true;
      const captchaToken = (await pedirToken?.()) ?? undefined;
      await pedir("/api/cuenta/anonima", { cuerpo: { captchaToken } });
      return true;
    } catch (e) {
      console.warn("[sesion]", e instanceof Error ? e.message : e);
      lista = null; // el próximo guardado lo vuelve a intentar
      return false;
    }
  })();
  return lista;
}

/** La sesión cambió o se perdió (401, salir, borrar): la próxima vez se vuelve a consultar. */
export function olvidarSesion() {
  lista = null;
}

