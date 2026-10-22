import { beforeEach, describe, expect, it, vi } from "vitest";
import { casoEjemplo, fichaEjemplo, fotosEjemplo, knowledgePackEjemplo, planoEjemplo } from "../../../shared";
import { Guia } from "../../../lib/supabase/guia";
import { contadorEnMemoria, TOPES, usarContador } from "../../../lib/supabase/limite";

const MIO = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";

/** Supabase de mentira para las rutas: tablas con upsert por id (o caso_id), consultas y subidas por bucket. */
const tablas: Record<string, Record<string, unknown>[]> = {};
const subidas: string[] = [];
const bytesSubidos: Buffer[] = [];
const clave = (f: Record<string, unknown>) => f.id ?? f.caso_id;
type Fila = Record<string, unknown>;
/** select encadenable (eq, in, is, order desc, limit) que se resuelve al esperarlo o con maybeSingle. */
function consulta(tabla: string) {
  const filtros: ((f: Fila) => boolean)[] = [];
  let orden: string | undefined;
  let tope = Infinity;
  const filas = () => {
    const r = (tablas[tabla] ?? []).filter((f) => filtros.every((p) => p(f)));
    if (orden) r.sort((a, b) => String(b[orden!]).localeCompare(String(a[orden!])));
    return r.slice(0, tope);
  };
  const q = {
    eq: (col: string, val: unknown) => (filtros.push((f) => f[col] === val), q),
    in: (col: string, vals: unknown[]) => (filtros.push((f) => vals.includes(f[col])), q),
    is: (col: string, val: unknown) => (filtros.push((f) => (f[col] ?? null) === val), q),
    order: (col: string) => ((orden = col), q),
    limit: (n: number) => ((tope = n), q),
    maybeSingle: async () => ({ data: filas()[0] ?? null, error: null }),
    then: (ok: (r: { data: Fila[]; error: null }) => unknown, mal?: (e: unknown) => unknown) =>
      Promise.resolve({ data: filas(), error: null }).then(ok, mal),
  };
  return q;
}
const db = {
  from: (tabla: string) => ({
    upsert: async (f: Fila | Fila[], opciones?: { ignoreDuplicates?: boolean }) => {
      const filas = (tablas[tabla] ??= []);
      for (const fila of Array.isArray(f) ? f : [f]) {
        const i = filas.findIndex((x) => clave(x) === clave(fila));
        if (i >= 0 && opciones?.ignoreDuplicates) continue;
        if (i >= 0) filas[i] = { ...filas[i], ...fila };
        else filas.push(fila);
      }
      return { error: null };
    },
    update: (cambio: Fila) => ({
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
    select: () => consulta(tabla),
  }),
  storage: {
    from: (bucket: string) => ({
      upload: async (ruta: string, bytes: Buffer) => {
        subidas.push(`${bucket}/${ruta}`);
        bytesSubidos.push(bytes);
        return { error: null };
      },
      createSignedUrl: async (ruta: string, segundos: number) => ({
        data: { signedUrl: `https://firmada.test/${bucket}/${ruta}?vence=${segundos}` },
        error: null,
      }),
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

const { GET: listar, POST } = await import("./route");
const { GET: leer } = await import("./[id]/route");

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

const guia = {
  casoId: casoEjemplo.id,
  preparado: { pack: knowledgePackEjemplo, manualUrl: null, manualFileId: null, desdeCache: false },
  plano: { plano: planoEjemplo, origen: "ia" as const },
};

describe("POST /api/casos: guía del caso (#347)", () => {
  it("la guarda validada, y una vez escrita no la pisa otra", async () => {
    expect((await enviar({ caso: casoEjemplo, guia })).status).toBe(200);
    const otra = { ...guia, plano: { ...guia.plano, origen: "plantilla", avisos: ["otra"] } };
    expect((await enviar({ guia: otra })).status).toBe(200);
    expect(tablas.guias).toHaveLength(1);
    const { preparado, plano } = Guia.parse(guia);
    expect(tablas.guias[0]).toEqual({ caso_id: casoEjemplo.id, preparado, plano });
  });

  it("con las reglas de dueño: la guía de un caso ajeno o inexistente es 403 y no se guarda", async () => {
    expect((await enviar({ guia })).status).toBe(403);
    await enviar({ caso: casoEjemplo });
    sesion = OTRO;
    expect((await enviar({ guia })).status).toBe(403);
    expect(tablas.guias).toBeUndefined();
  });

  it("sin sesión: 401", async () => {
    sesion = null;
    expect((await enviar({ caso: casoEjemplo, guia })).status).toBe(401);
    expect(tablas).toEqual({});
  });

  it("una guía que no valida o que pasa el tope de tamaño: 400 sin guardar nada", async () => {
    const grande = { ...guia, plano: { ...guia.plano, avisos: ["x".repeat(TOPES.bytesGuia)] } };
    for (const mala of [{ ...guia, plano: null }, grande]) {
      expect((await enviar({ caso: casoEjemplo, guia: mala })).status).toBe(400);
    }
    expect(tablas).toEqual({});
  });
});

describe("GET /api/casos y /api/casos/[id] (#347)", () => {
  const AJENO = "ajeno-1";
  const pedir = (id: string) => leer(new Request(`http://x/api/casos/${id}`), { params: Promise.resolve({ id }) });

  /** Dos casos míos (el más viejo con guía) y uno de otra sesión. */
  async function preparar() {
    await enviar({ caso: casoEjemplo, ficha: { ...fichaEjemplo, casoId: casoEjemplo.id }, guia });
    await enviar({ caso: { ...casoEjemplo, id: "nuevo-1" } });
    sesion = OTRO;
    await enviar({ caso: { ...casoEjemplo, id: AJENO } });
    sesion = MIO;
    tablas.casos.find((c) => c.id === casoEjemplo.id)!.actualizado_en = "2026-10-01T10:00:00.000Z";
    tablas.casos.find((c) => c.id === "nuevo-1")!.actualizado_en = "2026-10-02T10:00:00.000Z";
  }

  it("sin sesión: 401 en las dos", async () => {
    await preparar();
    sesion = null;
    expect((await listar()).status).toBe(401);
    expect((await pedir(casoEjemplo.id)).status).toBe(401);
  });

  it("la lista trae solo los casos de la sesión, el más reciente primero y sin la guía", async () => {
    await preparar();
    const res = await listar();
    expect(res.headers.get("cache-control")).toContain("no-store");
    const { casos } = await res.json();
    expect(casos.map((c: { caso: { id: string } }) => c.caso.id)).toEqual(["nuevo-1", casoEjemplo.id]);
    expect(casos[1]).toMatchObject({ tieneGuia: true, ficha: { marca: fichaEjemplo.marca } });
    expect(casos[0].tieneGuia).toBe(false);
    for (const c of casos) expect(c).not.toHaveProperty("guia");
    expect(JSON.stringify(casos)).not.toContain(knowledgePackEjemplo.pasos[0].texto);
  });

  it("un caso ajeno y uno inexistente dan el mismo 404", async () => {
    await preparar();
    const [ajeno, inexistente] = [await pedir(AJENO), await pedir("no-existe")];
    expect(ajeno.status).toBe(404);
    expect(inexistente.status).toBe(404);
    expect(await ajeno.json()).toEqual(await inexistente.json());
  });

  it("el caso trae su ficha, la guía tal como se guardó y fotos firmadas por 5 minutos, nunca una URL pública", async () => {
    await preparar();
    const sinImagen = { ...foto, id: "foto-sin-imagen", aceptada: false };
    await enviar({ fotos: [{ foto, imagen }, { foto: sinImagen }] });
    // Una foto vieja con URL pública (antes de la 010) no sale tal cual.
    const vieja = { ...foto, id: "foto-vieja", url: "https://p.supabase.co/storage/v1/object/public/fotos/x.jpg" };
    tablas.fotos.push({ id: vieja.id, caso_id: casoEjemplo.id, datos: vieja });

    const res = await pedir(casoEjemplo.id);
    expect(res.status).toBe(200);
    const c = await res.json();
    expect(c.caso).toEqual(casoEjemplo);
    expect(c.ficha.casoId).toBe(casoEjemplo.id);
    expect(c.guia).toEqual(Guia.parse(guia));
    const url = (id: string) => c.fotos.find((f: { id: string }) => f.id === id).url;
    expect(url(foto.id)).toBe(`https://firmada.test/fotos-usuarios/${casoEjemplo.id}/${foto.id}.jpeg?vence=300`);
    expect(url(sinImagen.id)).toBeNull();
    expect(url(vieja.id)).toBeNull();
    expect(JSON.stringify(c)).not.toContain("/object/public/");
  });

  it("un caso sin guía devuelve guia: null (no se regenera nada)", async () => {
    await preparar();
    const c = await (await pedir("nuevo-1")).json();
    expect(c).toMatchObject({ guia: null, fotos: [], ficha: null });
  });
});
