import { beforeEach, describe, expect, it, vi } from "vitest";
import { contadorEnMemoria, usarContador } from "../../../lib/supabase/limite";
import { COOKIE_RECLAMO } from "../../../lib/supabase/cuenta";

const ANON = "11111111-1111-4111-8111-111111111111";
const CUENTA = "22222222-2222-4222-8222-222222222222";

type S = { uid: string; anonima: boolean; email: string | null } | null;

/** Sesión del pedido (cookie httpOnly) y sesiones que verifican por JWT (la de la cookie de reclamo). */
let sesion: S;
let porJwt: Record<string, S>;
let galletas: Map<string, string>;
const llamadas: string[] = [];
let errores: Record<string, { code?: string; status?: number; message: string } | null>;

const auth = {
  auth: {
    updateUser: vi.fn(async () => ({ error: errores.updateUser ?? null })),
    refreshSession: vi.fn(async () => ({ data: { session: { access_token: "jwt-anon" } }, error: null })),
    signInWithOtp: vi.fn(async () => ({ error: errores.signInWithOtp ?? null })),
    signInAnonymously: vi.fn(async () => ({ error: errores.signInAnonymously ?? null })),
    verifyOtp: vi.fn(async () => ({ error: errores.verifyOtp ?? null })),
    signOut: vi.fn(async () => ({ error: null })),
  },
};
const almacen = {
  getAll: () => [...galletas].map(([name, value]) => ({ name, value })),
  get: (n: string) => (galletas.has(n) ? { name: n, value: galletas.get(n)! } : undefined),
  has: (n: string) => galletas.has(n),
  set: (n: string, v: string) => void galletas.set(n, v),
  delete: (n: string) => void galletas.delete(n),
};
vi.mock("../../../lib/supabase/sesion", () => ({
  OPCIONES_COOKIE: {},
  authDelPedido: async () => ({ auth, almacen }),
  sesionVerificada: async (_a: unknown, jwt?: string) => (jwt === undefined ? sesion : (porJwt[jwt] ?? null)),
  tieneCookieDeSesion: (n: string[]) => n.some((x) => x.startsWith("sb-")),
  borrarCookiesDeSesion: (a: typeof almacen, otras: string[] = []) => {
    for (const { name } of a.getAll()) if (name.startsWith("sb-") || otras.includes(name)) a.delete(name);
  },
}));

let anonimoEnAuth = true;
const casos: { id: string; dueno: string }[] = [];
const db = {
  from: () => ({
    update: (cambio: { dueno: string }) => ({
      eq: (_c: string, de: string) => ({
        select: async () => {
          const tocados = casos.filter((c) => c.dueno === de);
          for (const c of tocados) c.dueno = cambio.dueno;
          return { data: tocados, error: null };
        },
      }),
    }),
  }),
  auth: {
    admin: {
      getUserById: async (uid: string) => ({ data: { user: { id: uid, is_anonymous: anonimoEnAuth } }, error: null }),
      deleteUser: async (uid: string) => {
        llamadas.push(`borrar:${uid}`);
        return { error: null };
      },
    },
  },
};
vi.mock("../../../lib/supabase/cliente", () => ({ supabaseServidor: () => db }));

const codigo = await import("./codigo/route");
const verificar = await import("./verificar/route");
const reclamar = await import("./reclamar/route");
const anonima = await import("./anonima/route");
const salir = await import("./salir/route");
const cuenta = await import("./route");

const post = (cuerpo: unknown) =>
  new Request("http://x/api/cuenta", { method: "POST", body: JSON.stringify(cuerpo), headers: { "x-real-ip": "1.2.3.4" } });

beforeEach(() => {
  sesion = { uid: ANON, anonima: true, email: null };
  porJwt = { "jwt-anon": { uid: ANON, anonima: true, email: null } };
  galletas = new Map([["sb-x-auth-token", "sesion"]]);
  errores = {};
  anonimoEnAuth = true;
  llamadas.length = 0;
  casos.length = 0;
  casos.push({ id: "c1", dueno: ANON }, { id: "c2", dueno: CUENTA });
  vi.clearAllMocks();
  usarContador(contadorEnMemoria());
});

describe("POST /api/cuenta/anonima", () => {
  it("crea la sesión con el token de Turnstile", async () => {
    sesion = null;
    expect((await anonima.POST(post({ captchaToken: "tok" }))).status).toBe(200);
    expect(auth.auth.signInAnonymously).toHaveBeenCalledWith({ options: { captchaToken: "tok" } });
  });

  it("con una sesión válida no crea otra", async () => {
    await anonima.POST(post({}));
    expect(auth.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("captcha rechazado → 400 con código captcha", async () => {
    sesion = null;
    errores.signInAnonymously = { code: "captcha_failed", message: "x" };
    const r = await anonima.POST(post({ captchaToken: "malo" }));
    expect(r.status).toBe(400);
    expect((await r.json()).codigo).toBe("captcha");
  });
});

describe("POST /api/cuenta/codigo", () => {
  it("sesión anónima y email nuevo: convierte la misma sesión (updateUser), sin reclamo", async () => {
    const r = await codigo.POST(post({ email: " Yo@Ejemplo.com " }));
    expect(await r.json()).toEqual({ enviado: true });
    expect(auth.auth.updateUser).toHaveBeenCalledWith({ email: "yo@ejemplo.com" });
    expect(auth.auth.signInWithOtp).not.toHaveBeenCalled();
    expect(galletas.has(COOKIE_RECLAMO)).toBe(false);
  });

  it("email que ya tiene cuenta: guarda el JWT anónimo para el reclamo y manda el código de inicio", async () => {
    errores.updateUser = { code: "email_exists", message: "ya existe" };
    const r = await codigo.POST(post({ email: "yo@ejemplo.com", captchaToken: "tok" }));
    // La misma respuesta: no cuenta si el email tiene cuenta.
    expect(await r.json()).toEqual({ enviado: true });
    expect(galletas.get(COOKIE_RECLAMO)).toBe("jwt-anon");
    expect(auth.auth.signInWithOtp).toHaveBeenCalledWith({
      email: "yo@ejemplo.com",
      options: { shouldCreateUser: false, captchaToken: "tok" },
    });
  });

  it("con la sesión ya con email → 409", async () => {
    sesion = { uid: CUENTA, anonima: false, email: "yo@ejemplo.com" };
    expect((await codigo.POST(post({ email: "otro@ejemplo.com" }))).status).toBe(409);
  });

  it("email inválido → 400 sin llamar a Supabase", async () => {
    expect((await codigo.POST(post({ email: "no-es-email" }))).status).toBe(400);
    expect(auth.auth.updateUser).not.toHaveBeenCalled();
  });
});

describe("POST /api/cuenta/verificar", () => {
  it("sesión anónima sin reclamo: email_change", async () => {
    const r = await verificar.POST(post({ email: "yo@ejemplo.com", codigo: "123456" }));
    expect(await r.json()).toMatchObject({ verificado: true, reclamoPendiente: false });
    expect(auth.auth.verifyOtp).toHaveBeenCalledWith({ email: "yo@ejemplo.com", token: "123456", type: "email_change" });
  });

  it("con reclamo pendiente: inicio de sesión (email) y avisa el reclamo", async () => {
    galletas.set(COOKIE_RECLAMO, "jwt-anon");
    const r = await verificar.POST(post({ email: "yo@ejemplo.com", codigo: "123456" }));
    expect(await r.json()).toMatchObject({ reclamoPendiente: true });
    expect(auth.auth.verifyOtp).toHaveBeenCalledWith(expect.objectContaining({ type: "email" }));
  });

  it("código equivocado → 400 con mensaje de código vencido", async () => {
    errores.verifyOtp = { status: 403, message: "Token has expired or is invalid" };
    const r = await verificar.POST(post({ email: "yo@ejemplo.com", codigo: "000000" }));
    expect(r.status).toBe(400);
    expect((await r.json()).codigo).toBe("codigo");
  });
});

describe("POST /api/cuenta/reclamar", () => {
  beforeEach(() => {
    sesion = { uid: CUENTA, anonima: false, email: "yo@ejemplo.com" };
    galletas.set(COOKIE_RECLAMO, "jwt-anon");
  });

  it("pasa los casos de la sesión anónima, borra ese usuario y la cookie", async () => {
    expect(await (await reclamar.POST()).json()).toEqual({ reclamados: 1 });
    expect(casos.every((c) => c.dueno === CUENTA)).toBe(true);
    expect(llamadas).toEqual([`borrar:${ANON}`]);
    expect(galletas.has(COOKIE_RECLAMO)).toBe(false);
  });

  it("nunca reclama de una sesión con email (aunque el JWT verifique)", async () => {
    porJwt["jwt-anon"] = { uid: ANON, anonima: false, email: "otra@ejemplo.com" };
    expect(await (await reclamar.POST()).json()).toEqual({ reclamados: 0 });
    expect(casos.find((c) => c.id === "c1")?.dueno).toBe(ANON);
    expect(llamadas).toEqual([]);
  });

  it("si Auth dice que ya no es anónima (JWT viejo), no reclama", async () => {
    anonimoEnAuth = false;
    expect(await (await reclamar.POST()).json()).toEqual({ reclamados: 0 });
    expect(llamadas).toEqual([]);
  });

  it("un JWT que no verifica no reclama nada", async () => {
    galletas.set(COOKIE_RECLAMO, "falso");
    expect(await (await reclamar.POST()).json()).toEqual({ reclamados: 0 });
  });

  it("la sesión nueva tiene que tener email", async () => {
    sesion = { uid: ANON, anonima: true, email: null };
    expect((await reclamar.POST()).status).toBe(409);
  });
});

describe("salir y borrar", () => {
  it("una sesión anónima no sale (perdería sus casos)", async () => {
    expect((await salir.POST()).status).toBe(409);
    expect(galletas.has("sb-x-auth-token")).toBe(true);
  });

  it("con email: cierra la sesión y borra las cookies", async () => {
    sesion = { uid: CUENTA, anonima: false, email: "yo@ejemplo.com" };
    expect((await salir.POST()).status).toBe(200);
    expect(auth.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(galletas.size).toBe(0);
  });

  it("borrar pide confirmación explícita", async () => {
    const r = await cuenta.DELETE(new Request("http://x/api/cuenta", { method: "DELETE", body: "{}" }));
    expect(r.status).toBe(400);
  });

  it("borrar sin sesión → 401", async () => {
    sesion = null;
    const r = await cuenta.DELETE(
      new Request("http://x/api/cuenta", { method: "DELETE", body: JSON.stringify({ confirmar: "borrar" }) }),
    );
    expect(r.status).toBe(401);
  });

  it("GET dice si la sesión es anónima, sin el token", async () => {
    const r = await (await cuenta.GET()).json();
    expect(r).toEqual({ configurado: true, sesion: true, anonima: true, email: null });
  });
});
