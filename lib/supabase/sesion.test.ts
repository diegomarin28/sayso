import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Cookies del pedido y respuesta de getClaims de cada prueba. */
let galletas: { name: string; value: string }[] = [];
let claims: { data: { claims: { sub?: string; is_anonymous?: boolean; email?: string } } | null; error: { message: string } | null };
const getClaims = vi.fn<(jwt?: string) => Promise<typeof claims>>(async () => claims);
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => galletas, set: () => {} }) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims } }) }));

const { sesionVerificada, supabaseAuth, uidDeSesion } = await import("./sesion");

beforeEach(() => {
  galletas = [{ name: "sb-x-auth-token", value: "jwt" }];
  claims = { data: { claims: { sub: "uid-1" } }, error: null };
  getClaims.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proyecto.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "clave-publica-de-prueba");
});
afterEach(() => vi.unstubAllEnvs());

describe("uidDeSesion (#345)", () => {
  it("devuelve el uid del JWT verificado", async () => {
    expect(await uidDeSesion()).toBe("uid-1");
  });

  it("sin cookie de sesión no consulta Supabase", async () => {
    galletas = [{ name: "otra", value: "x" }];
    expect(await uidDeSesion()).toBeNull();
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("si el JWT no verifica (vencido, firma mala), no hay sesión", async () => {
    claims = { data: null, error: { message: "invalid JWT" } };
    expect(await uidDeSesion()).toBeNull();
  });

  it("sin las variables de Supabase no hay sesión", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(await uidDeSesion()).toBeNull();
  });
});

describe("sesionVerificada (Login 2/3)", () => {
  const cliente = () => supabaseAuth({ getAll: () => [], setAll: () => {} })!;

  it("dice si es anónima y su email, del JWT verificado", async () => {
    claims = { data: { claims: { sub: "uid-1", is_anonymous: true } }, error: null };
    expect(await sesionVerificada(cliente())).toEqual({ uid: "uid-1", anonima: true, email: null });
    claims = { data: { claims: { sub: "uid-2", is_anonymous: false, email: "yo@x.com" } }, error: null };
    expect(await sesionVerificada(cliente())).toEqual({ uid: "uid-2", anonima: false, email: "yo@x.com" });
  });

  it("verifica un JWT dado (el de la cookie de reclamo), no el de la sesión", async () => {
    await sesionVerificada(cliente(), "jwt-viejo");
    expect(getClaims).toHaveBeenCalledWith("jwt-viejo");
  });
});
