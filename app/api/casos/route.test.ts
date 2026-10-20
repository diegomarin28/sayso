import { describe, expect, it, vi } from "vitest";
import { casoEjemplo, fotosEjemplo } from "../../../shared";

/** Supabase de mentira para la ruta: anota tablas y subidas por bucket. */
const tablas: Record<string, Record<string, unknown>[]> = {};
const subidas: string[] = [];
const db = {
  from: (tabla: string) => ({
    upsert: async (f: Record<string, unknown> | Record<string, unknown>[]) => {
      (tablas[tabla] ??= []).push(...(Array.isArray(f) ? f : [f]));
      return { error: null };
    },
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

describe("POST /api/casos (#330)", () => {
  it("sube la foto al bucket privado y guarda la referencia, no una URL pública", async () => {
    const foto = { ...fotosEjemplo[0], casoId: casoEjemplo.id };
    const res = await POST(
      new Request("http://x/api/casos", {
        method: "POST",
        body: JSON.stringify({ caso: casoEjemplo, fotos: [{ foto, imagen: { base64: "aGk=", mediaType: "image/jpeg" } }] }),
      }),
    );
    const ref = `fotos-usuarios/${casoEjemplo.id}/${foto.id}.jpeg`;
    expect(await res.json()).toEqual({ guardado: true, fotos: [{ id: foto.id, url: ref }] });
    expect(subidas).toEqual([ref]);
    expect((tablas.fotos[0].datos as { url: string }).url).toBe(ref);
  });
});
