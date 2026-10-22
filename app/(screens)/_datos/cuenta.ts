import { mensajeDeCuenta } from "./errores";

/**
 * Cuenta y sesión desde las pantallas (docs/login.md). Todo pasa por `/api/cuenta/*`: la sesión
 * vive en cookies httpOnly y el navegador nunca ve el token ni habla con Supabase.
 */

export type EstadoCuenta = {
  configurado: boolean;
  sesion: boolean;
  anonima: boolean;
  email: string | null;
  /** Para el saludo ("Hola, Ana"); solo con cuenta. */
  nombre: string | null;
};

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
  if (!res.ok) throw new ErrorCuenta(mensajeDeCuenta(res.status, datos.error), datos.codigo ?? String(res.status));
  return datos;
}

export const leerCuenta = () => pedir<EstadoCuenta>("/api/cuenta");
export const crearCuenta = (email: string, contrasena: string) =>
  pedir<{ enviado: true }>("/api/cuenta/crear", { cuerpo: { email, contrasena, acepta: true } });
export const entrar = (email: string, contrasena: string, captchaToken?: string) =>
  pedir<{ entrado: true; reclamados: number }>("/api/cuenta/entrar", { cuerpo: { email, contrasena, captchaToken } });
export const recuperar = (email: string, captchaToken?: string) =>
  pedir<{ enviado: true }>("/api/cuenta/recuperar", { cuerpo: { email, captchaToken } });
export const verificarCodigo = (
  motivo: "crear" | "recuperar" | "cambiar",
  email: string,
  codigo: string,
  contrasena: string,
  perfil?: { nombre: string; apellido: string; acepta: true },
) =>
  pedir<{ verificado: true; reclamados: number }>("/api/cuenta/verificar", {
    cuerpo: { motivo, email, codigo, contrasena, ...perfil },
  });
export const salir = () => pedir<{ salido: true }>("/api/cuenta/salir", { cuerpo: {} });
export const borrarCuenta = () =>
  pedir<{ borrado: true; casos: number }>("/api/cuenta", { metodo: "DELETE", cuerpo: { confirmar: "borrar" } });
const RUTA_EXPORTAR = "/api/cuenta/exportar";

/**
 * Baja la copia de los casos como archivo. Se pide con `fetch` y no con un link: si el servidor falla,
 * la persona ve el error en la pantalla en vez de un JSON de error descargado o una pestaña rota.
 */
export async function descargarCopia(): Promise<void> {
  const res = await fetch(RUTA_EXPORTAR, { cache: "no-store" }).catch(() => null);
  if (!res) throw new ErrorCuenta("Sin conexión. Probá de nuevo.", "red");
  if (!res.ok) {
    const datos = (await res.json().catch(() => ({}))) as { error?: string; codigo?: string };
    throw new ErrorCuenta(mensajeDeCuenta(res.status, datos.error), datos.codigo ?? String(res.status));
  }
  const nombre = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "sayso-mis-casos.json";
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

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

