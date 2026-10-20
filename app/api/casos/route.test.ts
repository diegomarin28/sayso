import { beforeEach, describe, expect, it, vi } from "vitest";
import { casoEjemplo, fotosEjemplo } from "../../../shared";
import { contadorEnMemoria, usarContador } from "../../../lib/supabase/limite";

const MIO = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";

/** Supabase de mentira para la ruta: tablas con upsert por id (o caso_id) y subidas por bucket. */
const tablas: Record<string, Record<string, unknown>[]> = {};
const subidas: string[] = [];
const bytesSubidos: Buffer[] = [];
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
    update: (cambio: Record<string, unknown>) => ({
      eq: (col: string, val: unknown) => ({
        is: (col2: string, val2: unknown) => ({
          select: async () => {
            const tocadas = (tablas[tabla] ?? []).filter((f) => f[col] === val && (f[col2] ?? null) === val2);
            for (const f of tocadas) Object.assign(f, cambio);
            return { data: tocadas.map((f) => ({ id: f.id })), error: null };
          },
        }),
      }),
    }),
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
      upload: async (ruta: string, bytes: Buffer) => {
        subidas.push(`${bucket}/${ruta}`);
        bytesSubidos.push(bytes);
        return { error: null };
      },
      getPublicUrl: () => {
        throw new Error("las fotos de personas no tienen URL pública");
      },
    }),
  },
};
vi.mock("../../../lib/supabase/cliente", () => ({ supabaseServidor: () => db }));
/** La sesión verificada (cookie httpOnly) de cada pedido; null = sin sesión. */
let sesion: string | null = MIO;
vi.mock("../../../lib/supabase/sesion", () => ({ uidDeSesion: async () => sesion }));

const { POST } = await import("./route");

const enviar = (cuerpo: unknown) =>
  POST(new Request("http://x/api/casos", { method: "POST", body: JSON.stringify(cuerpo) }));
const foto = { ...fotosEjemplo[0], casoId: casoEjemplo.id };
/** JPEG mínimo con un bloque EXIF (APP1) antes de los datos de la imagen. */
const EXIF = Buffer.from([0xff, 0xe1, 0x00, 0x08, ...Buffer.from("Exif\0\0", "latin1")]);
const IMAGEN = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]);
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), EXIF, IMAGEN]);
const imagen = { base64: jpeg.toString("base64"), mediaType: "image/jpeg" };

beforeEach(() => {
  for (const t of Object.keys(tablas)) delete tablas[t];
  subidas.length = 0;
  bytesSubidos.length = 0;
  sesion = MIO;
  usarContador(contadorEnMemoria());
});

describe("POST /api/casos (#330)", () => {
  it("sube la foto al bucket privado y guarda la referencia, no una URL pública", async () => {
    const res = await enviar({ caso: casoEjemplo, fotos: [{ foto, imagen }] });
    const ref = `fotos-usuarios/${casoEjemplo.id}/${foto.id}.jpeg`;
    expect(await res.json()).toEqual({ guardado: true, fotos: [{ id: foto.id, url: ref }] });
    expect(subidas).toEqual([ref]);
    expect((tablas.fotos[0].datos as { url: string }).url).toBe(ref);
  });

  it("sube la foto sin EXIF (#345)", async () => {
    await enviar({ caso: casoEjemplo, fotos: [{ foto, imagen }] });
    expect(bytesSubidos[0]).toEqual(Buffer.concat([Buffer.from([0xff, 0xd8]), IMAGEN]));
  });

  it("una imagen que no es del tipo que dice: 400 sin guardar nada", async () => {
    const png = { base64: imagen.base64, mediaType: "image/png" };
    for (const mala of [png, { base64: "aGk=", mediaType: "image/jpeg" }, { ...imagen, mediaType: "image/gif" }]) {
      expect((await enviar({ caso: casoEjemplo, fotos: [{ foto, imagen: mala }] })).status).toBe(400);
    }
    expect(tablas).toEqual({});
    expect(subidas).toEqual([]);
  });
});

describe("POST /api/casos: dueño del caso por sesión (#331, #345)", () => {
  it("sin sesión: 401 y no guarda nada, aunque el cuerpo traiga un dispositivo", async () => {
    sesion = null;
    for (const cuerpo of [{ caso: casoEjemplo }, { dispositivo: MIO, caso: casoEjemplo }]) {
      const res = await enviar(cuerpo);
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ codigo: "sesion" });
    }
    expect(tablas).toEqual({});
  });

  it("la sesión que crea el caso queda de dueña y lo sigue escribiendo en pedidos sueltos", async () => {
    expect((await enviar({ caso: casoEjemplo })).status).toBe(200);
    expect(tablas.casos[0].dueno).toBe(MIO);
    expect(tablas.casos[0]).not.toHaveProperty("dispositivo");
    expect((await enviar({ fotos: [{ foto, imagen }] })).status).toBe(200);
    expect((await enviar({ caso: { ...casoEjemplo, estado: "cerrado" } })).status).toBe(200);
    expect(tablas.casos[0]).toMatchObject({ estado: "cerrado", dueno: MIO });
  });

  it("otra sesión recibe 403 y no cambia nada: ni el caso, ni su dueño, ni sus fotos", async () => {
    await enviar({ caso: casoEjemplo });
    const antes = structuredClone(tablas);
    sesion = OTRO;
    const intentos = [
      { caso: { ...casoEjemplo, sintoma: "pisado" } },
      { fotos: [{ foto, imagen }] },
      // El cuerpo no da permiso: ni con el uid del dueño como dispositivo.
      { dispositivo: MIO, caso: casoEjemplo },
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
    const res = await enviar({ fotos: [{ foto, imagen }] });
    expect(res.status).toBe(403);
    expect(subidas).toEqual([]);
  });
});

describe("POST /api/casos: reclamo del dispositivo (#345)", () => {
  const VIEJO = "33333333-3333-4333-8333-333333333333";
  const casoDelDispositivo = () => {
    tablas.casos = [{ id: casoEjemplo.id, dispositivo: VIEJO, dueno: null }];
  };

  it("el primer pedido con sesión pasa los casos del dispositivo a la sesión y avisa", async () => {
    casoDelDispositivo();
    const res = await enviar({ dispositivo: VIEJO, caso: { ...casoEjemplo, estado: "cerrado" } });
    expect(await res.json()).toMatchObject({ guardado: true, dispositivoReclamado: true });
    expect(tablas.casos[0]).toMatchObject({ dueno: MIO, dispositivo: null, estado: "cerrado" });
  });

  it("después del reclamo, el dispositivo no le da permiso a otra sesión", async () => {
    casoDelDispositivo();
    await enviar({ dispositivo: VIEJO });
    sesion = OTRO;
    expect((await enviar({ dispositivo: VIEJO, caso: casoEjemplo })).status).toBe(403);
    expect(tablas.casos[0].dueno).toBe(MIO);
  });

  it("sin dispositivo, un caso sin reclamar no lo escribe nadie", async () => {
    casoDelDispositivo();
    expect((await enviar({ caso: casoEjemplo })).status).toBe(403);
    expect(tablas.casos[0].dueno).toBeNull();
  });
});
