import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { fotoIdDeRuta, fotosDePersonas, moverFotos } from "./mover";

/** Bucket público de mentira: `objetos` son rutas completas; list devuelve carpetas (id null) y archivos. */
function falso(objetos: string[], filas: Record<string, Record<string, unknown>> = {}) {
  const movidas: { de: string; a: string; bucket?: string }[] = [];
  const actualizadas: { id: string; datos: Record<string, unknown> }[] = [];
  const db = {
    storage: {
      from: () => ({
        list: async (carpeta: string, o: { limit: number; offset: number }) => {
          const prefijo = carpeta ? `${carpeta}/` : "";
          const nombres = new Map<string, string | null>();
          for (const r of objetos.filter((r) => r.startsWith(prefijo))) {
            const resto = r.slice(prefijo.length);
            const barra = resto.indexOf("/");
            if (barra < 0) nombres.set(resto, "id");
            else nombres.set(resto.slice(0, barra), null);
          }
          const todo = [...nombres].sort().map(([name, id]) => ({ name, id }));
          return { data: todo.slice(o.offset, o.offset + o.limit), error: null };
        },
        move: async (de: string, a: string, o?: { destinationBucket?: string }) => {
          movidas.push({ de, a, bucket: o?.destinationBucket });
          return { error: null };
        },
      }),
    },
    from: () => ({
      select: () => ({ eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: filas[id] ? { datos: filas[id] } : null, error: null }) }) }),
      update: (f: { datos: Record<string, unknown> }) => ({
        eq: async (_c: string, id: string) => {
          actualizadas.push({ id, datos: f.datos });
          return { error: null };
        },
      }),
    }),
  };
  return { db: db as unknown as SupabaseClient, movidas, actualizadas };
}

const OBJETOS = ["manuales/hp-250-p3.png", "caso-1/foto-a.jpeg", "caso-1/foto-b.png", "caso-2/foto-c.webp", "suelto.png"];

describe("mover fotos de personas al bucket privado (#330)", () => {
  it("lista las fotos de personas y deja afuera manuales/ y los sueltos", async () => {
    const { db } = falso(OBJETOS);
    expect(await fotosDePersonas(db)).toEqual(["caso-1/foto-a.jpeg", "caso-1/foto-b.png", "caso-2/foto-c.webp"]);
  });

  it("sin --aplicar no mueve nada", async () => {
    const { db, movidas, actualizadas } = falso(OBJETOS);
    const r = await moverFotos(db, await fotosDePersonas(db), false);
    expect(r.every((x) => x.estado === "pendiente")).toBe(true);
    expect(movidas).toEqual([]);
    expect(actualizadas).toEqual([]);
  });

  it("con --aplicar mueve a fotos-usuarios con la misma ruta y actualiza la fila", async () => {
    const { db, movidas, actualizadas } = falso(OBJETOS, {
      "foto-a": { id: "foto-a", url: "https://x.supabase.co/storage/v1/object/public/fotos/caso-1/foto-a.jpeg" },
      "foto-b": { id: "foto-b", url: "fotos-usuarios/caso-1/foto-b.png" },
    });
    const r = await moverFotos(db, await fotosDePersonas(db), true);
    expect(movidas[0]).toEqual({ de: "caso-1/foto-a.jpeg", a: "caso-1/foto-a.jpeg", bucket: "fotos-usuarios" });
    expect(r.map((x) => x.fila)).toEqual(["actualizada", "ya estaba", "sin fila"]);
    expect(actualizadas).toEqual([{ id: "foto-a", datos: { id: "foto-a", url: "fotos-usuarios/caso-1/foto-a.jpeg" } }]);
  });

  it("saca el id de la foto de la ruta", () => {
    expect(fotoIdDeRuta("caso-1/foto-a.jpeg")).toBe("foto-a");
    expect(fotoIdDeRuta("caso-1/sin-extension")).toBe("sin-extension");
  });
});
