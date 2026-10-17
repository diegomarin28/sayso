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
