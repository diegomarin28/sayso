import { beforeEach, describe, expect, it, vi } from "vitest";
import { VERSION_LEGALES } from "../../../lib/supabase/credenciales";
import { contadorEnMemoria, usarContador } from "../../../lib/supabase/limite";

const ANON = "11111111-1111-4111-8111-111111111111";
const CUENTA = "22222222-2222-4222-8222-222222222222";

type S = { uid: string; anonima: boolean; email: string | null; nombre?: string | null } | null;

/** Sesión verificada del pedido (cookie httpOnly) y lo que responde Supabase Auth en cada prueba. */
let sesion: S;
let galletas: Map<string, string>;
let errores: Record<string, { code?: string; status?: number; message: string } | null>;
const llamadas: string[] = [];

const auth = {
  auth: {
    updateUser: vi.fn(async () => ({ error: errores.updateUser ?? null })),
    refreshSession: vi.fn(async () => ({ data: { session: {} }, error: null })),
    signInWithPassword: vi.fn(async () => ({
      data: { user: errores.signInWithPassword ? null : { id: CUENTA } },
      error: errores.signInWithPassword ?? null,
    })),
    resetPasswordForEmail: vi.fn(async () => ({ error: errores.resetPasswordForEmail ?? null })),
    signInAnonymously: vi.fn(async () => ({ error: errores.signInAnonymously ?? null })),
    verifyOtp: vi.fn(async () => ({
      data: { user: { id: sesion?.anonima ? sesion.uid : CUENTA } },
      error: errores.verifyOtp ?? null,
    })),
    signOut: vi.fn(async () => ({ error: null })),
  },
};
const almacen = {
  getAll: () => [...galletas].map(([name, value]) => ({ name, value })),
  delete: (n: string) => void galletas.delete(n),
};
vi.mock("../../../lib/supabase/sesion", () => ({
  authDelPedido: async () => ({ auth, almacen }),
  sesionVerificada: async () => sesion,
  tieneCookieDeSesion: (n: string[]) => n.some((x) => x.startsWith("sb-")),
  borrarCookiesDeSesion: (a: typeof almacen) => {
    for (const { name } of a.getAll()) if (name.startsWith("sb-")) a.delete(name);
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

const crear = await import("./crear/route");
const entrar = await import("./entrar/route");
const recuperar = await import("./recuperar/route");
const verificar = await import("./verificar/route");
const anonima = await import("./anonima/route");
const salir = await import("./salir/route");
const cuenta = await import("./route");

const post = (cuerpo: unknown) =>
  new Request("http://x/api/cuenta", { method: "POST", body: JSON.stringify(cuerpo), headers: { "x-real-ip": "1.2.3.4" } });
const BUENA = "clave1234";

beforeEach(() => {
  sesion = { uid: ANON, anonima: true, email: null };
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

describe("POST /api/cuenta/crear", () => {
  it("la sesión anónima pide el código para su email; la contraseña todavía no se guarda", async () => {
    const r = await crear.POST(post({ email: " Yo@Ejemplo.com ", contrasena: BUENA, acepta: true }));
    expect(await r.json()).toEqual({ enviado: true });
    expect(auth.auth.updateUser).toHaveBeenCalledWith({ email: "yo@ejemplo.com" });
  });

  it.each([
    ["sin números", "solamenteletras"],
    ["sin letras", "12345678"],
    ["corta", "abc12"],
  ])("contraseña %s → 400 sin llamar a Supabase", async (_n, contrasena) => {
    const r = await crear.POST(post({ email: "yo@ejemplo.com", contrasena, acepta: true }));
    expect(r.status).toBe(400);
    expect((await r.json()).codigo).toBe("contrasena");
    expect(auth.auth.updateUser).not.toHaveBeenCalled();
  });

  it.each(["no-es-email", "yo@", "@ejemplo.com", "yo@ejemplo"])("email inválido %s → 400", async (email) => {
    const r = await crear.POST(post({ email, contrasena: BUENA, acepta: true }));
    expect(r.status).toBe(400);
    expect((await r.json()).codigo).toBe("email");
  });

  it("email que ya tiene cuenta → 409 para iniciar sesión", async () => {
    errores.updateUser = { code: "email_exists", message: "ya existe" };
    const r = await crear.POST(post({ email: "yo@ejemplo.com", contrasena: BUENA, acepta: true }));
    expect(r.status).toBe(409);
    expect((await r.json()).codigo).toBe("existe");
  });

  it("sin aceptar los términos → 400 sin llamar a Supabase", async () => {
    const r = await crear.POST(post({ email: "yo@ejemplo.com", contrasena: BUENA }));
    expect(r.status).toBe(400);
    expect((await r.json()).codigo).toBe("acepta");
    expect(auth.auth.updateUser).not.toHaveBeenCalled();
  });

  it("sin sesión → 401; con la sesión ya con email → 409", async () => {
    sesion = null;
    expect((await crear.POST(post({ email: "yo@ejemplo.com", contrasena: BUENA, acepta: true }))).status).toBe(401);
    sesion = { uid: CUENTA, anonima: false, email: "yo@ejemplo.com" };
    expect((await crear.POST(post({ email: "otro@ejemplo.com", contrasena: BUENA, acepta: true }))).status).toBe(409);
  });
});

describe("POST /api/cuenta/verificar", () => {
  const CREAR = {
    motivo: "crear",
    email: "yo@ejemplo.com",
    codigo: "123456",
    contrasena: BUENA,
    nombre: " Ana ",
    apellido: "Pérez",
    acepta: true,
  };

  it("crear: verifica el email (email_change) y recién ahí guarda contraseña, nombre y apellido, sin reclamo", async () => {
    const r = await verificar.POST(post(CREAR));
    expect(await r.json()).toEqual({ verificado: true, reclamados: 0 });
    expect(auth.auth.verifyOtp).toHaveBeenCalledWith({ email: "yo@ejemplo.com", token: "123456", type: "email_change" });
    expect(auth.auth.updateUser).toHaveBeenCalledWith({
      password: BUENA,
      data: { nombre: "Ana", apellido: "Pérez", legales: { version: VERSION_LEGALES, aceptadoEn: expect.any(String) } },
    });
    expect(casos.find((c) => c.id === "c1")?.dueno).toBe(ANON);
  });

  it("código equivocado → 400 y no toca la contraseña", async () => {
    errores.verifyOtp = { status: 403, message: "Token has expired or is invalid" };
    const r = await verificar.POST(post({ ...CREAR, codigo: "000000" }));
    expect(r.status).toBe(400);
    expect((await r.json()).codigo).toBe("codigo");
    expect(auth.auth.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ["sin nombre", { nombre: undefined }],
    ["con números en el apellido", { apellido: "P3rez" }],
    ["sin aceptar los términos", { acepta: undefined }],
  ])("crear %s → 400 sin verificar el código", async (_n, cambio) => {
    const r = await verificar.POST(post({ ...CREAR, ...cambio }));
    expect(r.status).toBe(400);
    expect(auth.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("cambiar: con la sesión iniciada, solo para su propio email; no guarda nombre", async () => {
    sesion = { uid: CUENTA, anonima: false, email: "yo@ejemplo.com" };
    auth.auth.verifyOtp.mockResolvedValueOnce({ data: { user: { id: CUENTA } }, error: null });
    const ok = await verificar.POST(post({ motivo: "cambiar", email: "yo@ejemplo.com", codigo: "123456", contrasena: BUENA, acepta: true }));
    expect(await ok.json()).toEqual({ verificado: true, reclamados: 0 });
    expect(auth.auth.updateUser).toHaveBeenCalledWith({ password: BUENA });
    const ajeno = await verificar.POST(post({ motivo: "cambiar", email: "otro@ejemplo.com", codigo: "123456", contrasena: BUENA, acepta: true }));
    expect(ajeno.status).toBe(400);
  });

  it("recuperar: entra con la contraseña nueva y pasa los casos de la sesión anónima", async () => {
    // La sesión anónima de antes es ANON; verifyOtp de recuperar entra a CUENTA.
    auth.auth.verifyOtp.mockResolvedValueOnce({ data: { user: { id: CUENTA } }, error: null });
    const r = await verificar.POST(post({ motivo: "recuperar", email: "yo@ejemplo.com", codigo: "123456", contrasena: BUENA, acepta: true }));
    expect(await r.json()).toEqual({ verificado: true, reclamados: 1 });
    expect(auth.auth.verifyOtp).toHaveBeenCalledWith(expect.objectContaining({ type: "recovery" }));
    expect(llamadas).toEqual([`borrar:${ANON}`]);
  });
});

describe("POST /api/cuenta/entrar", () => {
  it("entra con CAPTCHA y pasa los casos de la sesión anónima, que se borra", async () => {
    const r = await entrar.POST(post({ email: "yo@ejemplo.com", contrasena: "vieja", captchaToken: "tok" }));
    expect(await r.json()).toEqual({ entrado: true, reclamados: 1 });
    expect(auth.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "yo@ejemplo.com",
      password: "vieja",
      options: { captchaToken: "tok" },
    });
    expect(casos.every((c) => c.dueno === CUENTA)).toBe(true);
    expect(llamadas).toEqual([`borrar:${ANON}`]);
  });

  it("contraseña incorrecta → 400 y no reclama nada", async () => {
    errores.signInWithPassword = { code: "invalid_credentials", message: "x" };
    const r = await entrar.POST(post({ email: "yo@ejemplo.com", contrasena: "mala" }));
    expect(r.status).toBe(400);
    expect((await r.json()).codigo).toBe("credenciales");
    expect(casos.find((c) => c.id === "c1")?.dueno).toBe(ANON);
  });

  it("si Auth dice que la sesión de antes ya no es anónima, no reclama", async () => {
    anonimoEnAuth = false;
    expect(await (await entrar.POST(post({ email: "yo@ejemplo.com", contrasena: "x" }))).json()).toEqual({
      entrado: true,
      reclamados: 0,
    });
    expect(llamadas).toEqual([]);
  });

  it("sin sesión anónima antes, entra sin reclamar", async () => {
    sesion = null;
    expect(await (await entrar.POST(post({ email: "yo@ejemplo.com", contrasena: "x" }))).json()).toEqual({
      entrado: true,
      reclamados: 0,
    });
  });

  it("frena después de muchos intentos al mismo email", async () => {
    errores.signInWithPassword = { code: "invalid_credentials", message: "x" };
    for (let i = 0; i < 10; i++) await entrar.POST(post({ email: "yo@ejemplo.com", contrasena: `x${i}` }));
    expect((await entrar.POST(post({ email: "yo@ejemplo.com", contrasena: "otra" }))).status).toBe(429);
  });
});

describe("POST /api/cuenta/recuperar", () => {
  it("manda el código con CAPTCHA y responde igual tenga o no cuenta", async () => {
    const r = await recuperar.POST(post({ email: "yo@ejemplo.com", captchaToken: "tok" }));
    expect(await r.json()).toEqual({ enviado: true });
    expect(auth.auth.resetPasswordForEmail).toHaveBeenCalledWith("yo@ejemplo.com", { captchaToken: "tok" });
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
    expect(r).toEqual({ configurado: true, sesion: true, anonima: true, email: null, nombre: null });
  });
});
