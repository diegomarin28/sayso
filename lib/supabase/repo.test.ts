import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { casoEjemplo, eventosEjemplo, fichaEjemplo, fotosEjemplo } from "../../shared";
import {
  ErrorSupabase,
  cachePacksSupabase,
  filaAEvento,
  guardarCaso,
  guardarEventos,
  guardarFicha,
  guardarFoto,
  listarEventos,
  subirFotoUsuario,
  subirImagen,
  urlFirmadaFoto,
} from "./repo";

/** Supabase de mentira: anota cada upsert y devuelve las filas guardadas al hacer select. */
function falso(error: { message: string } | null = null) {
  const tablas: Record<string, Record<string, unknown>[]> = {};
  const db = {
    from(tabla: string) {
      const filas = (tablas[tabla] ??= []);
      return {
        upsert: async (f: Record<string, unknown> | Record<string, unknown>[]) => {
          if (!error) filas.push(...(Array.isArray(f) ? f : [f]));
          return { error };
        },
        select: () => ({
          eq: (col: string, val: unknown) => {
            const encontradas = filas.filter((f) => f[col] === val);
            return {
              order: async () => ({ data: encontradas, error }),
              maybeSingle: async () => ({ data: encontradas[0] ?? null, error }),
            };
          },
        }),
      };
    },
  };
  return { db: db as unknown as SupabaseClient, tablas };
}

describe("lib/supabase/repo", () => {
  it("sin Supabase configurado no hace nada", async () => {
    await guardarCaso(null, casoEjemplo);
    await guardarEventos(null, eventosEjemplo);
    expect(await listarEventos(null, casoEjemplo.id)).toEqual([]);
    expect(await cachePacksSupabase(null).get("x")).toBeUndefined();
  });

  it("guarda caso, foto y ficha con columnas sueltas y el objeto entero en datos", async () => {
    const { db, tablas } = falso();
    await guardarCaso(db, casoEjemplo);
    await guardarFoto(db, fotosEjemplo[0]);
    await guardarFicha(db, fichaEjemplo);
    expect(tablas.casos[0]).toMatchObject({
      id: casoEjemplo.id,
      clase: casoEjemplo.clase,
      datos: casoEjemplo,
    });
    expect(tablas.fotos[0]).toMatchObject({
      caso_id: fotosEjemplo[0].casoId,
      aceptada: fotosEjemplo[0].aceptada,
    });
    expect(tablas.fichas[0]).toMatchObject({ caso_id: fichaEjemplo.casoId, datos: fichaEjemplo });
  });

  it("los eventos van y vuelven iguales al contrato", async () => {
    const { db } = falso();
    await guardarEventos(db, eventosEjemplo);
    const casoId = eventosEjemplo[0].casoId;
    expect(await listarEventos(db, casoId)).toEqual(eventosEjemplo.filter((e) => e.casoId === casoId));
  });

  it("descarta filas de eventos que no validan", () => {
    expect(
      filaAEvento({ id: "x", caso_id: "c", agente: "inventado", tipo: "t", mensaje: "m", ts: "2026-10-17" }),
    ).toBeNull();
  });

  it("no guarda datos que no cumplen el contrato", async () => {
    const { db } = falso();
    await expect(guardarCaso(db, { ...casoEjemplo, clase: "heladera" as never })).rejects.toThrow();
  });

  it("un error de Supabase se informa como ErrorSupabase", async () => {
    const { db } = falso({ message: "sin permiso" });
    await expect(guardarCaso(db, casoEjemplo)).rejects.toBeInstanceOf(ErrorSupabase);
  });

  it("la caché de packs guarda y devuelve por clave", async () => {
    const { db } = falso();
    const cache = cachePacksSupabase<{ pack: string }>(db);
    await cache.set("lenovo|t480|ruido", { pack: "ok" });
    expect(await cache.get("lenovo|t480|ruido")).toEqual({ pack: "ok" });
    expect(await cache.get("otra")).toBeUndefined();
  });
});

/** Storage de mentira: anota subidas por bucket y responde el error que se le pida. */
function storageFalso(error: { message: string; statusCode?: string } | null = null) {
  const subidas: { bucket: string; ruta: string; contentType?: string }[] = [];
  const publicas: string[] = [];
  const db = {
    storage: {
      from: (bucket: string) => ({
        upload: async (ruta: string, _b: Buffer, o: { contentType?: string }) => {
          if (!error) subidas.push({ bucket, ruta, contentType: o.contentType });
          return { error };
        },
        getPublicUrl: (ruta: string) => {
          publicas.push(`${bucket}/${ruta}`);
          return { data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${ruta}` } };
        },
        createSignedUrl: async (ruta: string, segundos: number) => ({
          data: { signedUrl: `https://x.supabase.co/storage/v1/object/sign/${bucket}/${ruta}?exp=${segundos}` },
          error: null,
        }),
      }),
    },
  };
  return { db: db as unknown as SupabaseClient, subidas, publicas };
}

describe("fotos de personas en el bucket privado (#330)", () => {
  it("suben a fotos-usuarios y devuelven la referencia, nunca una URL pública", async () => {
    const { db, subidas, publicas } = storageFalso();
    const ref = await subirFotoUsuario(db, "caso-1", "foto-1", "aGk=", "image/jpeg");
    expect(ref).toBe("fotos-usuarios/caso-1/foto-1.jpeg");
    expect(subidas).toEqual([{ bucket: "fotos-usuarios", ruta: "caso-1/foto-1.jpeg", contentType: "image/jpeg" }]);
    expect(publicas).toEqual([]);
  });

  it("las páginas del manual siguen en el bucket público fotos", async () => {
    const { db, subidas } = storageFalso();
    const url = await subirImagen(db, "manuales", "pagina-3", "aGk=", "image/png");
    expect(subidas[0].bucket).toBe("fotos");
    expect(url).toContain("/object/public/fotos/manuales/pagina-3.png");
  });

  it("sin la migración 010 (bucket inexistente) no sube y devuelve null", async () => {
    const { db } = storageFalso({ message: "Bucket not found", statusCode: "404" });
    expect(await subirFotoUsuario(db, "c", "f", "aGk=", "image/jpeg")).toBeNull();
  });

  it("cualquier otro error al subir se informa", async () => {
    const { db } = storageFalso({ message: "mime type not supported", statusCode: "415" });
    await expect(subirFotoUsuario(db, "c", "f", "aGk=", "image/svg+xml")).rejects.toBeInstanceOf(ErrorSupabase);
  });

  it("URL firmada solo para referencias del bucket privado", async () => {
    const { db } = storageFalso();
    expect(await urlFirmadaFoto(db, "fotos-usuarios/caso-1/foto-1.jpeg", 60)).toBe(
      "https://x.supabase.co/storage/v1/object/sign/fotos-usuarios/caso-1/foto-1.jpeg?exp=60",
    );
    expect(await urlFirmadaFoto(db, "pendiente:foto-1")).toBeNull();
    expect(await urlFirmadaFoto(null, "fotos-usuarios/x.jpeg")).toBeNull();
  });
});
