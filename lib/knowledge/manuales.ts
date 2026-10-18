import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { normalizar } from "../intake/chapa";
import { supabaseServidor } from "../supabase/cliente";
import type { Vistas } from "./lineas";

/**
 * Caché de manuales (tabla `manuales` en Supabase, migración lib/supabase/migraciones/003_manuales.sql).
 * La llena el bibliotecario cuando encuentra y verifica un manual; la próxima vez se reusa.
 * Nadie la carga a mano. Si Supabase no está configurado, se usa memoria (se pierde al reiniciar).
 */

const Pagina = z.number().int().positive();

export const RegistroManual = z.object({
  marca: z.string(),
  modelo: z.string(),
  url: z.url(),
  titulo: z.string(),
  /** Páginas físicas del PDF (ver `Vistas`): la vista explosionada general (una) y una vista del interior. */
  paginas_vista_explosionada: z.array(Pagina).default([]),
  pagina_vista_interior: Pagina.nullable().default(null),
  verificado: z.boolean(),
  fuente: z.enum(["fabricante", "ifixit", "otro"]),
  /**
   * Sin manual: las páginas web de la guía pública (NO VERIFICADO) para no volver a buscarlas.
   * Si hay, la fila es "solo guía": `url` es la primera de estas, no un manual.
   */
  fuentes_publicas: z.array(z.url()).nullable().default([]).transform((x) => x ?? []),
});
export type RegistroManual = z.output<typeof RegistroManual>;

/** La fila guarda solo las fuentes de una guía pública (no hay manual). */
export function esSoloGuia(r: RegistroManual | null): boolean {
  return !!r && r.fuentes_publicas.length > 0;
}

/** Vistas guardadas de un manual. Filas de antes de la vista interior: no se usan (se vuelven a ubicar gratis). */
export function vistasDe(r: RegistroManual | null): Vistas {
  if (!r || r.pagina_vista_interior === null) return { explosionada: null, interior: null };
  return { explosionada: r.paginas_vista_explosionada[0] ?? null, interior: r.pagina_vista_interior };
}

/** Columnas de la tabla a partir de las vistas. */
export function columnasVistas(v: Vistas): Pick<RegistroManual, "paginas_vista_explosionada" | "pagina_vista_interior"> {
  return { paginas_vista_explosionada: v.explosionada ? [v.explosionada] : [], pagina_vista_interior: v.interior };
}

export interface RepoManuales {
  buscar(marca: string | null, modelo: string): Promise<RegistroManual | null>;
  guardar(r: z.input<typeof RegistroManual>): Promise<void>;
}

export function claveManual(marca: string | null, modelo: string): string {
  return `${normalizar(marca ?? "")}|${normalizar(modelo)}`;
}

export function repoEnMemoria(): RepoManuales {
  const m = new Map<string, RegistroManual>();
  return {
    buscar: async (marca, modelo) => m.get(claveManual(marca, modelo)) ?? null,
    guardar: async (r) => void m.set(claveManual(r.marca, r.modelo), RegistroManual.parse(r)),
  };
}

/** Columnas nuevas: si su migración todavía no se aplicó, se guarda sin ellas. */
const COLUMNAS_NUEVAS = ["pagina_vista_interior", "fuentes_publicas"];

export function repoSupabase(db: SupabaseClient): RepoManuales {
  return {
    async buscar(marca, modelo) {
      // select("*"): si falta la columna nueva, la fila igual se lee (y la vista interior queda en null).
      const { data, error } = await db.from("manuales").select("*").eq("clave", claveManual(marca, modelo)).maybeSingle();
      if (error) {
        console.error("[manuales] no pude leer la caché:", error.message);
        return null;
      }
      const r = RegistroManual.safeParse(data);
      return r.success ? r.data : null;
    },
    async guardar(registro) {
      const fila: Record<string, unknown> = { ...RegistroManual.parse(registro), clave: claveManual(registro.marca, registro.modelo) };
      let { error } = await db.from("manuales").upsert(fila, { onConflict: "clave" });
      if (error?.code === "PGRST204") {
        // PGRST204 = columna inexistente: falta aplicar alguna migración (vista interior o fuentes públicas).
        console.warn("[manuales] falta aplicar una migración de manuales en Supabase: guardo sin las columnas nuevas.");
        for (const c of COLUMNAS_NUEVAS) delete fila[c];
        ({ error } = await db.from("manuales").upsert(fila, { onConflict: "clave" }));
      }
      if (error) console.error("[manuales] no pude guardar en la caché:", error.message);
    },
  };
}

let repo: RepoManuales | null = null;

/** Supabase si las claves están bien cargadas; si no, memoria. */
export function repoManuales(): RepoManuales {
  if (repo) return repo;
  const db = supabaseServidor();
  if (db) repo = repoSupabase(db);
  else {
    console.warn("[manuales] Supabase no configurado: uso caché en memoria.");
    repo = repoEnMemoria();
  }
  return repo;
}
