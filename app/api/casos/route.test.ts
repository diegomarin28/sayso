import { beforeEach, describe, expect, it, vi } from "vitest";
import { casoEjemplo, fotosEjemplo } from "../../../shared";
import { contadorEnMemoria, usarContador } from "../../../lib/supabase/limite";

const MIO = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";

/** Supabase de mentira para la ruta: tablas con upsert por id (o caso_id) y subidas por bucket. */
const tablas: Record<string, Record<string, unknown>[]> = {};
const subidas: string[] = [];
const clave = (f: Record<string, unknown>) => f.id ?? f.caso_id;
const db = {
  from: (tabla: string) => ({
    upsert: async (f: Record<string, unknown> | Record<string, unknown>[]) => {
      const filas = (tablas[tabla] ??= []);
      for (const fila of Array.isArray(f) ? f : [f]) {
        const i = filas.findIndex((x) => clave(x) === clave(fila));
        if (i >= 0) filas[i] = { ...filas[i], ...fila };
        else filas.push(fila);
      }
      return { error: null };
    },
    select: () => ({
      in: async (col: string, ids: string[]) => ({
        data: (tablas[tabla] ?? []).filter((f) => ids.includes(f[col] as string)),
        error: null,
      }),
      eq: (col: string, val: string) => ({
        limit: async () => ({ data: (tablas[tabla] ?? []).filter((f) => f[col] === val), error: null }),
      }),
    }),
  }),
  storage: {
    from: (bucket: string) => ({
      upload: async (ruta: string) => {
        subidas.push(`${bucket}/${ruta}`);
        return { error: null };
      },
      getPublicUrl: () => {
        throw new Error("las fotos de personas no tienen URL pública");
      },
    }),
  },
};
vi.mock("../../../lib/supabase/cliente", () => ({ supabaseServidor: () => db }));

const { POST } = await import("./route");

const enviar = (cuerpo: unknown) =>
  POST(new Request("http://x/api/casos", { method: "POST", body: JSON.stringify(cuerpo) }));
const foto = { ...fotosEjemplo[0], casoId: casoEjemplo.id };
const imagen = { base64: "aGk=", mediaType: "image/jpeg" };

beforeEach(() => {
  for (const t of Object.keys(tablas)) delete tablas[t];
  subidas.length = 0;
  usarContador(contadorEnMemoria());
});

describe("POST /api/casos (#330)", () => {
  it("sube la foto al bucket privado y guarda la referencia, no una URL pública", async () => {
    const res = await enviar({ dispositivo: MIO, caso: casoEjemplo, fotos: [{ foto, imagen }] });
    const ref = `fotos-usuarios/${casoEjemplo.id}/${foto.id}.jpeg`;
    expect(await res.json()).toEqual({ guardado: true, fotos: [{ id: foto.id, url: ref }] });
    expect(subidas).toEqual([ref]);
    expect((tablas.fotos[0].datos as { url: string }).url).toBe(ref);
  });
});

describe("POST /api/casos: dueño del caso (#331)", () => {
  it("el dispositivo que crea el caso lo sigue escribiendo en pedidos sueltos", async () => {
    expect((await enviar({ dispositivo: MIO, caso: casoEjemplo })).status).toBe(200);
    expect(tablas.casos[0].dispositivo).toBe(MIO);
    expect((await enviar({ dispositivo: MIO, fotos: [{ foto, imagen }] })).status).toBe(200);
    expect((await enviar({ dispositivo: MIO, caso: { ...casoEjemplo, estado: "cerrado" } })).status).toBe(200);
    expect(tablas.casos[0]).toMatchObject({ estado: "cerrado", dispositivo: MIO });
  });

  it("otro dispositivo recibe 403 y no cambia nada: ni el caso, ni su dueño, ni sus fotos", async () => {
    await enviar({ dispositivo: MIO, caso: casoEjemplo });
    const antes = structuredClone(tablas);
    const intentos = [
      { dispositivo: OTRO, caso: { ...casoEjemplo, sintoma: "pisado" } },
      { dispositivo: OTRO, fotos: [{ foto, imagen }] },
      { caso: casoEjemplo },
    ];
    for (const cuerpo of intentos) {
      const res = await enviar(cuerpo);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ codigo: "dueno" });
    }
    expect(tablas).toEqual(antes);
    expect(subidas).toEqual([]);
  });

  it("fotos de un caso que no existe: 403 sin subir nada", async () => {
    const res = await enviar({ dispositivo: MIO, fotos: [{ foto, imagen }] });
    expect(res.status).toBe(403);
    expect(subidas).toEqual([]);
  });
});
