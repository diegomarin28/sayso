import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase de mentira, en memoria, para los tests del borrado (`borrar.test.ts`) y de la retención
 * (`scripts/retencion`). Solo lo que usan: consultas con filtros, `delete().in()` con la cascada de
 * Postgres sobre `caso_id` y `dueno`, el bucket (`list`/`remove`) y `auth.admin`. Sin red.
 * `escrituras` registra en orden cada operación que borra; `fallar` hace fallar una por su nombre.
 */

type Fila = Record<string, unknown>;
export type Usuario = { id: string; email?: string; is_anonymous?: boolean; last_sign_in_at?: string; created_at: string };
export type Operacion = "remove" | "delete:casos" | "deleteUser";

const HIJAS = ["fotos", "fichas", "eventos", "guias"];

export function supabaseFalso({
  tablas = {},
  bucket = {},
  usuarios = [],
  fallar = [],
}: {
  tablas?: Record<string, Fila[]>;
  /** bucket → rutas de archivos */
  bucket?: Record<string, string[]>;
  usuarios?: Usuario[];
  fallar?: Operacion[];
}) {
  const escrituras: string[] = [];
  const err = (op: Operacion) => (fallar.includes(op) ? { message: `falla simulada: ${op}` } : null);

  function borrarCasosPorId(ids: string[]) {
    tablas.casos = (tablas.casos ?? []).filter((c) => !ids.includes(c.id as string));
    for (const t of HIJAS) tablas[t] = (tablas[t] ?? []).filter((f) => !ids.includes(f.caso_id as string));
  }

  function consulta(tabla: string, opciones: { count?: string; head?: boolean } = {}, borrar = false) {
    const filtros: ((f: Fila) => boolean)[] = [];
    let desde = 0;
    let hasta = Infinity;
    const q = {
      eq: (c: string, v: unknown) => (filtros.push((f) => f[c] === v), q),
      is: (c: string, v: null) => (filtros.push((f) => (f[c] ?? null) === v), q),
      not: (c: string, _op: "is", v: null) => (filtros.push((f) => (f[c] ?? null) !== v), q),
      in: (c: string, vs: unknown[]) => (filtros.push((f) => vs.includes(f[c])), q),
      gte: (c: string, v: string) => (filtros.push((f) => Date.parse(f[c] as string) >= Date.parse(v)), q),
      lt: (c: string, v: string) => (filtros.push((f) => Date.parse(f[c] as string) < Date.parse(v)), q),
      order: () => q,
      range: (a: number, b: number) => ((desde = a), (hasta = b), q),
      limit: (n: number) => ((hasta = desde + n - 1), q),
      then: (ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) => {
        const filas = (tablas[tabla] ?? []).filter((f) => filtros.every((p) => p(f)));
        let r: unknown;
        if (borrar) {
          const e = tabla === "casos" ? err("delete:casos") : null;
          if (!e) {
            escrituras.push(`delete:${tabla}`);
            borrarCasosPorId(filas.map((f) => f.id as string));
          }
          r = { data: null, error: e };
        } else {
          const pagina = filas.slice(desde, hasta + 1);
          r = { data: opciones.head ? null : pagina, error: null, count: opciones.count ? filas.length : null };
        }
        return Promise.resolve(r).then(ok, mal);
      },
    };
    return q;
  }

  const db = {
    from: (tabla: string) => ({
      select: (_cols: string, opciones?: { count?: string; head?: boolean }) => consulta(tabla, opciones),
      delete: () => consulta(tabla, {}, true),
    }),
    storage: {
      from: (b: string) => ({
        list: async (carpeta: string, { limit = 100, offset = 0 }: { limit?: number; offset?: number } = {}) => {
          const prefijo = carpeta ? `${carpeta}/` : "";
          const nombres = (bucket[b] ?? []).filter((r) => r.startsWith(prefijo)).map((r) => r.slice(prefijo.length));
          const entradas = [...new Set(nombres.map((n) => n.split("/")[0]))]
            .sort()
            .map((n) => ({ name: n, id: nombres.includes(n) ? `id-${n}` : null }));
          return { data: entradas.slice(offset, offset + limit), error: null };
        },
        remove: async (rutas: string[]) => {
          const e = err("remove");
          if (e) return { data: null, error: e };
          escrituras.push(`remove:${rutas.length}`);
          bucket[b] = (bucket[b] ?? []).filter((r) => !rutas.includes(r));
          return { data: [], error: null };
        },
      }),
    },
    auth: {
      admin: {
        listUsers: async ({ page = 1, perPage = 50 }: { page?: number; perPage?: number } = {}) => ({
          data: { users: usuarios.slice((page - 1) * perPage, page * perPage) },
          error: null,
        }),
        getUserById: async (id: string) => {
          const user = usuarios.find((u) => u.id === id);
          return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "User not found" } };
        },
        deleteUser: async (id: string) => {
          const e = err("deleteUser");
          if (e) return { data: null, error: e };
          const i = usuarios.findIndex((u) => u.id === id);
          if (i < 0) return { data: null, error: { message: "User not found" } };
          escrituras.push("deleteUser");
          usuarios.splice(i, 1);
          // casos.dueno references auth.users on delete cascade (012)
          borrarCasosPorId((tablas.casos ?? []).filter((c) => c.dueno === id).map((c) => c.id as string));
          return { data: {}, error: null };
        },
      },
    },
  } as unknown as SupabaseClient;

  return { db, tablas, bucket, usuarios, escrituras };
}
