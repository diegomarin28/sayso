import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { casoEjemplo, eventosEjemplo, fichaEjemplo, fotosEjemplo } from "../../shared";
import { reclamarDispositivo, respuestaDueno, respuestaSinSesion, revisarDueno } from "./dueno";
import { ErrorSupabase } from "./repo";

const MIO = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";

type Fila = Record<string, unknown>;

/** Supabase de mentira: filas ya guardadas por tabla; `select().in()` las filtra por id. */
function falso(filas: Record<string, Fila[]> = {}, error: string | null = null) {
  return {
    from: (tabla: string) => ({
      select: () => ({
        in: async (col: string, ids: string[]) =>
          error
            ? { data: null, error: { message: error } }
            : { data: (filas[tabla] ?? []).filter((f) => ids.includes(f[col] as string)), error: null },
      }),
    }),
  } as unknown as SupabaseClient;
}

const caso = casoEjemplo;
const foto = { ...fotosEjemplo[0], casoId: caso.id };
const evento = { ...eventosEjemplo[0], casoId: caso.id };
const ficha = { ...fichaEjemplo, casoId: caso.id };
const mio = { casos: [{ id: caso.id, dueno: MIO }] };

describe("revisarDueno por uid (#331, #345)", () => {
  it("un pedido vacío no consulta nada", async () => {
    expect(await revisarDueno(falso({}, "no debería consultar"), MIO, { fotos: [], eventos: [] })).toBeNull();
  });

  it("crea un caso nuevo y, en el mismo pedido, sus fotos y eventos", async () => {
    expect(await revisarDueno(falso(), MIO, { caso, fotos: [foto], ficha, eventos: [evento] })).toBeNull();
  });

  it("su dueño actualiza el caso y le agrega fotos, ficha y eventos", async () => {
    expect(await revisarDueno(falso(mio), MIO, { caso, fotos: [foto], ficha, eventos: [evento] })).toBeNull();
  });

  it("otro uid no toca el caso, ni con el caso ni con fotos, ficha o eventos sueltos", async () => {
    const db = falso(mio);
    expect(await revisarDueno(db, OTRO, { caso, fotos: [], eventos: [] })).toBe("caso_ajeno");
    expect(await revisarDueno(db, OTRO, { fotos: [foto], eventos: [] })).toBe("caso_ajeno");
    expect(await revisarDueno(db, OTRO, { fotos: [], ficha, eventos: [] })).toBe("caso_ajeno");
    expect(await revisarDueno(db, OTRO, { fotos: [], eventos: [evento] })).toBe("caso_ajeno");
  });

  it("un caso sin dueño (sin reclamar, o viejo sin dispositivo) no lo escribe nadie", async () => {
    for (const fila of [{ id: caso.id, dueno: null, dispositivo: MIO }, { id: caso.id, dueno: null }]) {
      expect(await revisarDueno(falso({ casos: [fila] }), MIO, { caso, fotos: [], eventos: [] })).toBe("caso_ajeno");
    }
  });

  it("fotos o eventos de un caso que no existe (y no viene en el pedido) se rechazan", async () => {
    expect(await revisarDueno(falso(), MIO, { fotos: [foto], eventos: [] })).toBe("caso_inexistente");
    expect(await revisarDueno(falso(), MIO, { fotos: [], eventos: [evento] })).toBe("caso_inexistente");
  });

  it("no se reescribe una foto o un evento que ya es de otro caso", async () => {
    const ajeno = { casos: mio.casos, fotos: [{ id: foto.id, caso_id: "otro-caso" }] };
    expect(await revisarDueno(falso(ajeno), MIO, { fotos: [foto], eventos: [] })).toBe("id_ajeno");
    const ajenoEv = { casos: mio.casos, eventos: [{ id: evento.id, caso_id: "otro-caso" }] };
    expect(await revisarDueno(falso(ajenoEv), MIO, { fotos: [], eventos: [evento] })).toBe("id_ajeno");
    // La misma foto del mismo caso sí (reintento).
    const propia = { casos: mio.casos, fotos: [{ id: foto.id, caso_id: caso.id }] };
    expect(await revisarDueno(falso(propia), MIO, { fotos: [foto], eventos: [] })).toBeNull();
  });

  it("si la consulta falla no deja seguir", async () => {
    await expect(revisarDueno(falso({}, "caída"), MIO, { caso, fotos: [], eventos: [] })).rejects.toThrow(ErrorSupabase);
  });

  it("respuestaDueno: 403 igual para todos los motivos", async () => {
    const res = respuestaDueno();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Este caso no es tuyo.", codigo: "dueno" });
  });

  it("respuestaSinSesion: 401", async () => {
    const res = respuestaSinSesion();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ codigo: "sesion" });
  });
});

/** Supabase de mentira para el reclamo: `update().eq().is().select()` sobre `casos`. */
function conCasos(casos: Fila[], error: string | null = null) {
  const db = {
    from: () => ({
      update: (cambio: Fila) => ({
        eq: (col: string, val: unknown) => ({
          is: (col2: string, val2: unknown) => ({
            select: async () => {
              if (error) return { data: null, error: { message: error } };
              const tocadas = casos.filter((c) => c[col] === val && c[col2] === val2);
              for (const c of tocadas) Object.assign(c, cambio);
              return { data: tocadas.map((c) => ({ id: c.id })), error: null };
            },
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
  return db;
}

describe("reclamarDispositivo (#345)", () => {
  const DISP = "33333333-3333-4333-8333-333333333333";

  it("pasa al uid los casos del dispositivo sin dueño y les borra el dispositivo", async () => {
    const casos: Fila[] = [
      { id: "a", dispositivo: DISP, dueno: null },
      { id: "b", dispositivo: DISP, dueno: null },
      { id: "c", dispositivo: "otro", dueno: null },
    ];
    expect(await reclamarDispositivo(conCasos(casos), MIO, DISP)).toBe(2);
    expect(casos).toEqual([
      { id: "a", dispositivo: null, dueno: MIO },
      { id: "b", dispositivo: null, dueno: MIO },
      { id: "c", dispositivo: "otro", dueno: null },
    ]);
  });

  it("una sola vez: después el dispositivo no da permiso sobre nada", async () => {
    const casos: Fila[] = [{ id: "a", dispositivo: DISP, dueno: null }];
    expect(await reclamarDispositivo(conCasos(casos), MIO, DISP)).toBe(1);
    expect(await reclamarDispositivo(conCasos(casos), OTRO, DISP)).toBe(0);
    expect(casos[0].dueno).toBe(MIO);
  });

  it("no toca casos que ya tienen dueño", async () => {
    const casos: Fila[] = [{ id: "a", dispositivo: DISP, dueno: OTRO }];
    expect(await reclamarDispositivo(conCasos(casos), MIO, DISP)).toBe(0);
    expect(casos[0].dueno).toBe(OTRO);
  });

  it("si la consulta falla no deja seguir", async () => {
    await expect(reclamarDispositivo(conCasos([], "caída"), MIO, DISP)).rejects.toThrow(ErrorSupabase);
  });
});
