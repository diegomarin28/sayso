import { beforeEach, describe, expect, it, vi } from "vitest";
import { casoEjemplo, eventosEjemplo, fichaEjemplo, fotosEjemplo } from "../../../shared";

type Fila = Record<string, unknown>;

/** Supabase de mentira para la ruta: tablas con clave `id` (fichas: `caso_id`), filtros eq/in y subidas por bucket. */
const tablas: Record<string, Fila[]> = {};
const subidas: string[] = [];
const clave = (tabla: string) => (tabla === "fichas" ? "caso_id" : "id");

function consulta(tabla: string, filtros: ((f: Fila) => boolean)[] = [], cambio?: Fila) {
  const filas = () => (tablas[tabla] ??= []).filter((f) => filtros.every((ok) => ok(f)));
  const q = {
    eq: (col: string, v: unknown) => consulta(tabla, [...filtros, (f) => f[col] === v], cambio),
    in: (col: string, vs: unknown[]) => consulta(tabla, [...filtros, (f) => vs.includes(f[col])], cambio),
    limit: () => q,
    select: () => q,
    then: (r: (x: { data: Fila[]; error: null }) => unknown) => {
      const encontradas = filas();
      if (cambio) for (const f of encontradas) Object.assign(f, cambio);
      return Promise.resolve({ data: encontradas.map((f) => ({ ...f })), error: null }).then(r);
    },
  };
  return q;
}

const db = {
  from: (tabla: string) => ({
    upsert: async (f: Fila | Fila[], o?: { ignoreDuplicates?: boolean }) => {
      const filas = (tablas[tabla] ??= []);
      for (const nueva of Array.isArray(f) ? f : [f]) {
        const vieja = filas.find((x) => x[clave(tabla)] === nueva[clave(tabla)]);
        if (!vieja) filas.push({ ...nueva });
        else if (!o?.ignoreDuplicates) Object.assign(vieja, nueva);
      }
      return { error: null };
    },
    update: (cambio: Fila) => consulta(tabla, [], cambio),
    select: () => consulta(tabla),
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

const MIO = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";

function pedir(cuerpo: Record<string, unknown>) {
  return POST(new Request("http://x/api/casos", { method: "POST", body: JSON.stringify(cuerpo) }));
}

/** El caso de ejemplo ya guardado con ese dueño (null = de antes de la 007). */
function casoGuardado(dispositivo: string | null) {
  tablas.casos = [{ id: casoEjemplo.id, dispositivo, sintoma: casoEjemplo.sintoma, datos: casoEjemplo }];
}

beforeEach(() => {
  for (const t of Object.keys(tablas)) delete tablas[t];
  subidas.length = 0;
});

describe("POST /api/casos (#330)", () => {
  it("sube la foto al bucket privado y guarda la referencia, no una URL pública", async () => {
    const foto = { ...fotosEjemplo[0], casoId: casoEjemplo.id };
    const res = await pedir({
      dispositivo: MIO,
      caso: casoEjemplo,
      fotos: [{ foto, imagen: { base64: "aGk=", mediaType: "image/jpeg" } }],
    });
    const ref = `fotos-usuarios/${casoEjemplo.id}/${foto.id}.jpeg`;
    expect(await res.json()).toEqual({ guardado: true, fotos: [{ id: foto.id, url: ref }] });
    expect(subidas).toEqual([ref]);
    expect((tablas.fotos[0].datos as { url: string }).url).toBe(ref);
  });
});

describe("POST /api/casos: solo el dueño escribe (#331)", () => {
  const otroSintoma = { ...casoEjemplo, sintoma: "otra cosa" };

  it("sin dispositivo no guarda nada", async () => {
    const res = await pedir({ caso: casoEjemplo });
    expect(res.status).toBe(400);
    expect(tablas.casos).toBeUndefined();
  });

  it("un caso nuevo queda a nombre de quien lo crea", async () => {
    const res = await pedir({ dispositivo: MIO, caso: casoEjemplo });
    expect(res.status).toBe(200);
    expect(tablas.casos).toEqual([expect.objectContaining({ id: casoEjemplo.id, dispositivo: MIO })]);
  });

  it("el dueño actualiza su caso, con fotos, ficha y eventos", async () => {
    casoGuardado(MIO);
    const res = await pedir({
      dispositivo: MIO,
      caso: otroSintoma,
      fotos: [{ foto: fotosEjemplo[0] }],
      ficha: fichaEjemplo,
      eventos: eventosEjemplo.filter((e) => e.casoId === casoEjemplo.id),
    });
    expect(res.status).toBe(200);
    expect(tablas.casos[0]).toMatchObject({ dispositivo: MIO, sintoma: "otra cosa" });
    expect(tablas.fotos).toHaveLength(1);
    expect(tablas.fichas).toHaveLength(1);
  });

  it("otro dispositivo no sobrescribe el caso ni le cambia el dueño", async () => {
    casoGuardado(MIO);
    const res = await pedir({ dispositivo: OTRO, caso: otroSintoma });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ codigo: "ajeno" });
    expect(tablas.casos[0]).toMatchObject({ dispositivo: MIO, sintoma: casoEjemplo.sintoma });
  });

  it("un caso sin dueño (antes de la 007) no se toca", async () => {
    casoGuardado(null);
    const res = await pedir({ dispositivo: MIO, caso: otroSintoma });
    expect(res.status).toBe(403);
    expect(tablas.casos[0]).toMatchObject({ dispositivo: null, sintoma: casoEjemplo.sintoma });
  });

  it("no se suben fotos, ficha ni eventos a un caso ajeno", async () => {
    casoGuardado(MIO);
    for (const cuerpo of [
      { fotos: [{ foto: fotosEjemplo[0], imagen: { base64: "aGk=", mediaType: "image/jpeg" } }] },
      { ficha: fichaEjemplo },
      { eventos: [eventosEjemplo[0]] },
    ]) {
      const res = await pedir({ dispositivo: OTRO, ...cuerpo });
      expect(res.status).toBe(403);
    }
    expect(subidas).toEqual([]);
    expect(tablas.fotos ?? []).toEqual([]);
    expect(tablas.fichas ?? []).toEqual([]);
    expect(tablas.eventos ?? []).toEqual([]);
  });

  it("no se guardan fotos de un caso que no existe", async () => {
    const res = await pedir({ dispositivo: MIO, fotos: [{ foto: fotosEjemplo[0] }] });
    expect(res.status).toBe(403);
    expect(tablas.fotos ?? []).toEqual([]);
  });

  it("no se pisa la foto de otro caso reusando su id", async () => {
    casoGuardado(OTRO);
    tablas.casos.push({ id: "caso-mio", dispositivo: MIO });
    tablas.fotos = [{ id: fotosEjemplo[0].id, caso_id: casoEjemplo.id }];
    const res = await pedir({ dispositivo: MIO, fotos: [{ foto: { ...fotosEjemplo[0], casoId: "caso-mio" } }] });
    expect(res.status).toBe(403);
    expect(tablas.fotos).toEqual([{ id: fotosEjemplo[0].id, caso_id: casoEjemplo.id }]);
  });
});
