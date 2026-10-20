import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** @supabase/ssr de mentira: guarda las opciones y, en getClaims, "refresca" la sesión con setAll. */
const creados: { cookieOptions?: Record<string, unknown> }[] = [];
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _clave: string,
    opciones: {
      cookieOptions?: Record<string, unknown>;
      cookies: { setAll: (l: { name: string; value: string; options: object }[], h: object) => void };
    },
  ) => {
    creados.push(opciones);
    return {
      auth: {
        getClaims: async () => {
          opciones.cookies.setAll([{ name: "sb-x-auth-token", value: "nuevo", options: opciones.cookieOptions ?? {} }], {
            "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
          });
          return { data: { claims: { sub: "uid" } }, error: null };
        },
      },
    };
  },
}));

const { proxy, config } = await import("./proxy");

beforeEach(() => {
  creados.length = 0;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proyecto.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "clave-publica-de-prueba");
});
afterEach(() => vi.unstubAllEnvs());

describe("proxy de sesión (#345)", () => {
  it("corre solo en las rutas que leen la sesión, no en páginas ni modelos 3D", () => {
    const corre = (url: string) => unstable_doesMiddlewareMatch({ config, url });
    expect(corre("/api/casos")).toBe(true);
    expect(corre("/api/cuenta/reclamar")).toBe(true);
    for (const url of ["/", "/casos", "/api/chat", "/models/piezas/dispositivos.glb", "/_next/static/x.js"]) {
      expect(corre(url), url).toBe(false);
    }
  });

  it("sin cookie de sesión no llama a Supabase", async () => {
    const res = await proxy(new NextRequest("http://x/api/casos", { method: "POST" }));
    expect(creados).toEqual([]);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("con sesión la refresca y devuelve la cookie nueva httpOnly, sin caché", async () => {
    const req = new NextRequest("http://x/api/casos", { method: "POST", headers: { cookie: "sb-x-auth-token=viejo" } });
    const res = await proxy(req);
    expect(creados[0].cookieOptions).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(res.headers.get("set-cookie")).toMatch(/sb-x-auth-token=nuevo.*HttpOnly/i);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    // La ruta ve la cookie refrescada en el pedido.
    expect(req.cookies.get("sb-x-auth-token")?.value).toBe("nuevo");
  });
});
