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

const Pagina = z.number().int().positive().nullable();

export const RegistroManual = z.object({
  marca: z.string(),
  modelo: z.string(),
  url: z.url(),
  titulo: z.string(),
  /** Páginas físicas del PDF para el cartógrafo (ver `Vistas`). null = no se encontró todavía. */
  pagina_vista_explosionada: Pagina.default(null),
  pagina_vista_interior: Pagina.default(null),
  verificado: z.boolean(),
  fuente: z.enum(["fabricante", "ifixit", "otro"]),
});
export type RegistroManual = z.output<typeof RegistroManual>;

export function vistasDe(r: RegistroManual | null): Vistas {
  return { explosionada: r?.pagina_vista_explosionada ?? null, interior: r?.pagina_vista_interior ?? null };
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

/** Columnas de las vistas: si la migración todavía no se aplicó, se guarda sin ellas. */
const COLUMNAS_VISTAS = ["pagina_vista_explosionada", "pagina_vista_interior"] as const;

export function repoSupabase(db: SupabaseClient): RepoManuales {
  return {
    async buscar(marca, modelo) {
      // select("*"): si falta alguna columna nueva, la fila igual se lee (y la vista queda en null).
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
        // PGRST204 = columna inexistente: falta aplicar la migración de las vistas.
        console.warn("[manuales] falta aplicar la migración de vistas en Supabase: guardo el manual sin las páginas.");
        for (const c of COLUMNAS_VISTAS) delete fila[c];
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
