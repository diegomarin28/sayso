import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { normalizar } from "../intake/chapa";

/**
 * Caché de manuales (tabla `manuales` en Supabase, migración en lib/supabase/migrations).
 * La llena el bibliotecario cuando encuentra y verifica un manual; la próxima vez se reusa.
 * Nadie la carga a mano. Si Supabase no está configurado, se usa memoria (se pierde al reiniciar).
 */

export const RegistroManual = z.object({
  marca: z.string(),
  modelo: z.string(),
  url: z.url(),
  titulo: z.string(),
  paginas_vista_explosionada: z.array(z.number().int().positive()),
  verificado: z.boolean(),
  fuente: z.enum(["fabricante", "ifixit", "otro"]),
});
export type RegistroManual = z.infer<typeof RegistroManual>;

export interface RepoManuales {
  buscar(marca: string | null, modelo: string): Promise<RegistroManual | null>;
  guardar(r: RegistroManual): Promise<void>;
}

export function claveManual(marca: string | null, modelo: string): string {
  return `${normalizar(marca ?? "")}|${normalizar(modelo)}`;
}

export function repoEnMemoria(): RepoManuales {
  const m = new Map<string, RegistroManual>();
  return {
    buscar: async (marca, modelo) => m.get(claveManual(marca, modelo)) ?? null,
    guardar: async (r) => void m.set(claveManual(r.marca, r.modelo), r),
  };
}

export function repoSupabase(db: SupabaseClient): RepoManuales {
  return {
    async buscar(marca, modelo) {
      const { data, error } = await db
        .from("manuales")
        .select("marca, modelo, url, titulo, paginas_vista_explosionada, verificado, fuente")
        .eq("clave", claveManual(marca, modelo))
        .maybeSingle();
      if (error) {
        console.error("[manuales] no pude leer la caché:", error.message);
        return null;
      }
      const r = RegistroManual.safeParse(data);
      return r.success ? r.data : null;
    },
    async guardar(r) {
      const { error } = await db
        .from("manuales")
        .upsert({ ...RegistroManual.parse(r), clave: claveManual(r.marca, r.modelo) }, { onConflict: "clave" });
      if (error) console.error("[manuales] no pude guardar en la caché:", error.message);
    },
  };
}

let repo: RepoManuales | null = null;

/** Supabase si las claves están bien cargadas; si no, memoria. */
export function repoManuales(): RepoManuales {
  if (repo) return repo;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secreta = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && /^https:\/\/\S+\.supabase\.co\/?$/.test(url) && secreta) {
    repo = repoSupabase(createClient(url, secreta, { auth: { persistSession: false } }));
  } else {
    console.warn("[manuales] Supabase no configurado: uso caché en memoria.");
    repo = repoEnMemoria();
  }
  return repo;
}
