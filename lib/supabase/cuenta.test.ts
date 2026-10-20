import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import { borrarCuenta, exportarCuenta, pasarCasos } from "./cuenta";

const YO = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";

/** Supabase de mentira: tablas, archivos del bucket y el orden de lo que se borra. */
let tablas: Record<string, Record<string, unknown>[]>;
let archivos: string[];
let pasos: string[];
let falla: string | null;

const filtrar = (tabla: string, col: string, val: unknown) => (tablas[tabla] ?? []).filter((f) => f[col] === val);
const db = {
  from: (tabla: string) => ({
    select: () => ({
      eq: (col: string, val: unknown) => {
        const r = { data: filtrar(tabla, col, val), error: null };
        return Object.assign(Promise.resolve(r), { order: async () => r });
      },
      in: async (col: string, ids: string[]) => ({
        data: (tablas[tabla] ?? []).filter((f) => ids.includes(f[col] as string)),
        error: null,
      }),
    }),
    update: (cambio: Record<string, unknown>) => ({
      eq: (col: string, val: unknown) => ({
        select: async () => {
          const tocadas = filtrar(tabla, col, val);
          for (const f of tocadas) Object.assign(f, cambio);
          return { data: tocadas.map((f) => ({ id: f.id })), error: null };
        },
      }),
    }),
  }),
  storage: {
    from: () => ({
      list: async (carpeta: string) => ({
        data: archivos.filter((a) => a.startsWith(`${carpeta}/`)).map((a) => ({ name: a.split("/")[1] })),
        error: falla === "list" ? { message: "storage caído" } : null,
      }),
      remove: async (rutas: string[]) => {
        pasos.push(`fotos:${rutas.join(",")}`);
        archivos = archivos.filter((a) => !rutas.includes(a));
        return { error: null };
      },
      createSignedUrl: async (ruta: string) => ({ data: { signedUrl: `https://firmada/${ruta}` }, error: null }),
    }),
  },
  auth: {
    admin: {
      getUserById: async (uid: string) => ({
        data: { user: { id: uid, email: "yo@ejemplo.com", user_metadata: { nombre: "Ana", apellido: "Pérez" } } },
        error: null,
      }),
      deleteUser: async (uid: string) => {
        pasos.push(`usuario:${uid}`);
        return { error: null };
      },
    },
  },
} as unknown as SupabaseClient;

beforeEach(() => {
  tablas = {
    casos: [
      { id: "c1", dueno: YO, dispositivo: null, sintoma: "no enfría", creado_en: "1" },
      { id: "c2", dueno: OTRO, dispositivo: null, sintoma: "ajeno", creado_en: "2" },
    ],
    fotos: [
      { id: "f1", caso_id: "c1", datos: { id: "f1", url: "fotos-usuarios/c1/f1.jpeg" } },
      { id: "f2", caso_id: "c2", datos: { id: "f2", url: "fotos-usuarios/c2/f2.jpeg" } },
    ],
    fichas: [{ caso_id: "c1", datos: { casoId: "c1", serie: "S1" } }],
    eventos: [],
    guias: [{ caso_id: "c1", preparado: { pack: {} }, plano: null, creado_en: "3" }],
  };
  archivos = ["c1/f1.jpeg", "c2/f2.jpeg"];
  pasos = [];
  falla = null;
});

describe("pasarCasos", () => {
  it("pasa solo los casos de la sesión vieja", async () => {
    expect(await pasarCasos(db, OTRO, YO)).toBe(1);
    expect(tablas.casos.every((c) => c.dueno === YO)).toBe(true);
  });
});

describe("borrarCuenta", () => {
  it("borra los archivos de sus casos antes que el usuario, y no toca los de otro", async () => {
    expect(await borrarCuenta(db, YO)).toEqual({ casos: 1 });
    expect(pasos).toEqual(["fotos:c1/f1.jpeg", `usuario:${YO}`]);
    expect(archivos).toEqual(["c2/f2.jpeg"]);
  });

  it("si no puede borrar las fotos, no borra el usuario (se puede reintentar)", async () => {
    falla = "list";
    await expect(borrarCuenta(db, YO)).rejects.toThrow(/listar fotos/);
    expect(pasos).toEqual([]);
  });
});

describe("exportarCuenta", () => {
  it("solo sus casos, sin columnas internas y con las fotos firmadas", async () => {
    const r = await exportarCuenta(db, YO);
    expect(r.cuenta).toEqual({ email: "yo@ejemplo.com", nombre: "Ana", apellido: "Pérez" });
    expect(r.casos).toHaveLength(1);
    const [c] = r.casos;
    expect(c).not.toHaveProperty("dueno");
    expect(c).not.toHaveProperty("dispositivo");
    expect(c.ficha).toEqual({ casoId: "c1", serie: "S1" });
    expect(c.fotos).toEqual([{ id: "f1", url: "https://firmada/c1/f1.jpeg" }]);
    expect(c.guia).toMatchObject({ preparado: { pack: {} } });
    expect(JSON.stringify(r)).not.toContain("ajeno");
  });
});
