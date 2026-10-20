import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { casoEjemplo, fotosEjemplo, type Foto } from "../../shared";
import {
  contadorEnMemoria,
  contadorSupabase,
  hashIp,
  ipDelPedido,
  respuestaLimite,
  revisarFotosPorCaso,
  revisarPorIp,
  TOPES,
  usarContador,
} from "./limite";

/** Supabase de mentira: `fotos` ya guardadas por caso, rpc que anota o falla, upserts y Storage que no hacen nada. */
function falso(opciones: { fotosGuardadas?: { id: string; caso_id: string }[]; errorRpc?: string } = {}) {
  const rpc = vi.fn(async (_fn: string, args: { p_cantidad: number }) =>
    opciones.errorRpc ? { data: null, error: { message: opciones.errorRpc } } : { data: args.p_cantidad, error: null },
  );
  const upserts: string[] = [];
  const db = {
    rpc,
    from(tabla: string) {
      return {
        select: () => ({
          eq: (_col: string, casoId: string) => ({
            limit: async () => ({
              data: (opciones.fotosGuardadas ?? []).filter((f) => f.caso_id === casoId).map((f) => ({ id: f.id })),
              error: null,
            }),
          }),
          // El dueño (dueno.ts): ningún caso, foto ni evento guardado todavía.
          in: async () => ({ data: [], error: null }),
        }),
        upsert: async () => {
          upserts.push(tabla);
          return { error: null };
        },
      };
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://ejemplo/foto.jpg" } }),
      }),
    },
  };
  return { db: db as unknown as SupabaseClient, rpc, upserts };
}

const ENV = { LIMITE_CLAVE_HASH: "clave-de-prueba" };
const AHORA = new Date("2026-10-20T12:00:30Z");
const DUENO = "11111111-1111-4111-8111-111111111111";
const pedido = (ip = "200.1.2.3") => new Request("http://x/api/casos", { headers: { "x-real-ip": ip } });
const foto = (id: string): Foto => ({ ...fotosEjemplo[0], id, casoId: casoEjemplo.id });

beforeEach(() => usarContador(contadorEnMemoria()));
afterEach(() => {
  usarContador(null);
  vi.restoreAllMocks();
  vi.doUnmock("./cliente");
  vi.resetModules();
});

describe("IP", () => {
  it("toma x-real-ip, si no el primer x-forwarded-for, si no una sola cuenta", () => {
    expect(ipDelPedido(pedido("1.1.1.1"))).toBe("1.1.1.1");
    expect(ipDelPedido(new Request("http://x", { headers: { "x-forwarded-for": "2.2.2.2, 10.0.0.1" } }))).toBe("2.2.2.2");
    expect(ipDelPedido(new Request("http://x"))).toBe("desconocida");
  });

  it("se guarda como hash: sin la IP en claro, distinto cada día y con otra clave", () => {
    const h = hashIp("200.1.2.3", AHORA, ENV);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("200.1.2.3");
    expect(hashIp("200.1.2.3", AHORA, ENV)).toBe(h);
    expect(hashIp("200.1.2.3", new Date("2026-10-21T12:00:00Z"), ENV)).not.toBe(h);
    expect(hashIp("200.1.2.3", AHORA, { LIMITE_CLAVE_HASH: "otra" })).not.toBe(h);
    expect(hashIp("200.1.2.3", AHORA, { SUPABASE_SERVICE_ROLE_KEY: "clave-de-prueba" })).toBe(h);
  });
});

describe("revisarPorIp", () => {
  it(`deja ${TOPES.pedidosPorMinuto} pedidos por minuto y frena el siguiente`, async () => {
    for (let i = 0; i < TOPES.pedidosPorMinuto; i++) expect(await revisarPorIp(pedido(), 0, AHORA, ENV)).toBeNull();
    expect(await revisarPorIp(pedido(), 0, AHORA, ENV)).toEqual({ motivo: "pedidos", reintentarEnSeg: 30 });
    // Otra IP y el minuto siguiente arrancan de cero.
    expect(await revisarPorIp(pedido("9.9.9.9"), 0, AHORA, ENV)).toBeNull();
    expect(await revisarPorIp(pedido(), 0, new Date("2026-10-20T12:01:00Z"), ENV)).toBeNull();
  });

  it(`deja ${TOPES.imagenesPorMinuto} imágenes por minuto y ${TOPES.imagenesPorDia} por día`, async () => {
    for (let i = 0; i < TOPES.imagenesPorMinuto; i++) expect(await revisarPorIp(pedido(), 1, AHORA, ENV)).toBeNull();
    expect(await revisarPorIp(pedido(), 1, AHORA, ENV)).toMatchObject({ motivo: "imagenes" });
    // Un pedido sin imágenes sigue pasando.
    expect(await revisarPorIp(pedido(), 0, AHORA, ENV)).toBeNull();

    usarContador(contadorEnMemoria());
    let t = new Date("2026-10-20T00:00:00Z").getTime();
    for (let i = 0; i < TOPES.imagenesPorDia; i++, t += 7_000) {
      expect(await revisarPorIp(pedido(), 1, new Date(t), ENV)).toBeNull();
    }
    expect(await revisarPorIp(pedido(), 1, new Date(t), ENV)).toMatchObject({ motivo: "imagenes" });
  });

  it("cuenta en Supabase con la IP como hash", async () => {
    const { db, rpc } = falso();
    usarContador(contadorSupabase(db));
    await revisarPorIp(pedido(), 1, AHORA, ENV);
    expect(rpc).toHaveBeenCalledTimes(3);
    for (const [fn, args] of rpc.mock.calls) {
      expect(fn).toBe("sumar_limite_uso");
      expect(JSON.stringify(args)).not.toContain("200.1.2.3");
    }
    expect(rpc.mock.calls[0][1]).toEqual({
      p_clave: `pedidos:${hashIp("200.1.2.3", AHORA, ENV)}`,
      p_ventana: "2026-10-20T12:00:00.000Z",
      p_cantidad: 1,
    });
  });

  it("sin la migración 011 cuenta en memoria y avisa una vez (no bloquea por un error propio)", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    usarContador(contadorSupabase(falso({ errorRpc: "function sumar_limite_uso does not exist" }).db));
    for (let i = 0; i < TOPES.pedidosPorMinuto; i++) expect(await revisarPorIp(pedido(), 0, AHORA, ENV)).toBeNull();
    expect(await revisarPorIp(pedido(), 0, AHORA, ENV)).toMatchObject({ motivo: "pedidos" });
    expect(aviso).toHaveBeenCalledTimes(1);
  });
});

describe("revisarFotosPorCaso", () => {
  const guardadas = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `f${i}`, caso_id: casoEjemplo.id }));

  it(`deja llegar a ${TOPES.fotosPorCaso} fotos por caso y frena la siguiente`, async () => {
    const { db } = falso({ fotosGuardadas: guardadas(TOPES.fotosPorCaso - 1) });
    expect(await revisarFotosPorCaso(db, [foto("nueva")])).toBeNull();
    const lleno = falso({ fotosGuardadas: guardadas(TOPES.fotosPorCaso) }).db;
    expect(await revisarFotosPorCaso(lleno, [foto("nueva")])).toMatchObject({ motivo: "fotos_por_caso" });
  });

  it("reescribir una foto que ya está no suma", async () => {
    const { db } = falso({ fotosGuardadas: guardadas(TOPES.fotosPorCaso) });
    expect(await revisarFotosPorCaso(db, [foto("f3")])).toBeNull();
  });
});

describe("POST /api/casos", () => {
  // Hora fija: los pedidos no pueden caer en dos minutos distintos.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AHORA);
  });
  afterEach(() => vi.useRealTimers());

  async function ruta(db: SupabaseClient) {
    vi.doMock("./cliente", () => ({ supabaseServidor: () => db }));
    vi.doMock("./sesion", () => ({ uidDeSesion: async () => DUENO }));
    const lim = await import("./limite");
    lim.usarContador(lim.contadorEnMemoria());
    return (await import("../../app/api/casos/route")).POST;
  }
  const enviar = (POST: (r: Request) => Promise<Response>, cuerpo: unknown) =>
    POST(new Request("http://x/api/casos", {
      method: "POST",
      headers: { "x-real-ip": "200.1.2.3" },
      body: JSON.stringify(cuerpo),
    }));

  it("pasado el tope de pedidos responde 429 con Retry-After y no guarda nada", async () => {
    const { db, upserts } = falso();
    const POST = await ruta(db);
    for (let i = 0; i < TOPES.pedidosPorMinuto; i++) expect((await enviar(POST, { caso: casoEjemplo })).status).toBe(200);
    const n = upserts.length;
    const res = await enviar(POST, { caso: casoEjemplo });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await res.json()).toMatchObject({ codigo: "limite", motivo: "pedidos" });
    expect(upserts.length).toBe(n);
  });

  it("una foto de más en un caso lleno responde 429 sin subirla", async () => {
    const { db, upserts } = falso({
      fotosGuardadas: Array.from({ length: TOPES.fotosPorCaso }, (_, i) => ({ id: `f${i}`, caso_id: casoEjemplo.id })),
    });
    const POST = await ruta(db);
    const res = await enviar(POST, { fotos: [{ foto: foto("nueva") }] });
    expect(res.status).toBe(429);
    expect(upserts).toEqual([]);
  });

  it(`más de ${TOPES.fotosPorPedido} fotos en un pedido es entrada inválida`, async () => {
    const POST = await ruta(falso().db);
    const fotos = Array.from({ length: TOPES.fotosPorPedido + 1 }, (_, i) => ({ foto: foto(`n${i}`) }));
    expect((await enviar(POST, { fotos })).status).toBe(400);
  });
});

it("respuestaLimite: 429 con mensaje que se puede mostrar", async () => {
  const res = respuestaLimite({ motivo: "imagenes", reintentarEnSeg: 12 });
  expect(res.status).toBe(429);
  expect(res.headers.get("Retry-After")).toBe("12");
  expect((await res.json()).error).toMatch(/fotos/);
});
