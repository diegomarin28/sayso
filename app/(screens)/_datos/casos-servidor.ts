import { z } from "zod";
import { Guia } from "../../../lib/supabase/guia";
import { mezclarDelServidor, ResumenServidor, type GuiaGuardada } from "./mis-casos";

/**
 * "Mis casos" desde el servidor (docs/login.md §6): la lista de la sesión y la guía de un caso, para
 * retomarlo en otro celular sin volver a llamar a la IA. Sin sesión (401) o sin red no pasa nada: queda
 * lo del celular. No pide una sesión nueva: si no hay, tampoco hay casos en el servidor.
 */

/** Modo de prueba (NEXT_PUBLIC_DATOS=fixture): no se lee el servidor. */
const SIN_SERVIDOR = process.env.NEXT_PUBLIC_DATOS === "fixture";

/** Cómo salió traer los casos del servidor: "sesion" = no hay sesión (venció); "fallo" = red o servidor. */
export type Sincronizacion = "ok" | "sesion" | "fallo";

/** El estado de la lista según el estado HTTP de `GET /api/casos`. */
export const sincronizacionDeEstado = (status: number): Sincronizacion =>
  status >= 200 && status < 300 ? "ok" : status === 401 ? "sesion" : "fallo";

/** Trae los casos de la sesión y los mezcla con los del celular. Nunca tira error: dice cómo salió. */
export async function sincronizarCasos(): Promise<Sincronizacion> {
  if (SIN_SERVIDOR) return "ok";
  try {
    const res = await fetch("/api/casos", { cache: "no-store" });
    if (!res.ok) return sincronizacionDeEstado(res.status);
    const datos = (await res.json()) as { casos?: unknown };
    // Uno que no valida (de una versión vieja) se saltea en vez de descartar la lista.
    const casos = (Array.isArray(datos.casos) ? datos.casos : []).flatMap((c) => {
      const r = ResumenServidor.safeParse(c);
      return r.success ? [r.data] : [];
    });
    mezclarDelServidor(casos);
    return "ok";
  } catch (e) {
    console.warn("[mis-casos] no se pudo leer el servidor", e);
    return "fallo";
  }
}

/** Una foto aceptada de un caso, con su URL firmada (vence a los 5 minutos). */
export type FotoDelCaso = { tipo: string; url: string };

const FotosDelCaso = z.object({
  fotos: z.array(z.object({ tipoPedido: z.string(), url: z.string().nullable(), aceptada: z.boolean() })),
});

/** Las fotos aceptadas de un caso de la sesión, para mostrarlas en su charla. Nunca tira error. */
export async function fotosDelServidor(id: string): Promise<FotoDelCaso[]> {
  if (SIN_SERVIDOR) return [];
  try {
    const res = await fetch(`/api/casos/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!res.ok) return [];
    const r = FotosDelCaso.safeParse(await res.json());
    if (!r.success) return [];
    return r.data.fotos.flatMap((f) => (f.url && f.aceptada ? [{ tipo: f.tipoPedido, url: f.url }] : []));
  } catch {
    return [];
  }
}

/** La guía guardada de un caso de la sesión, o null si no está o no se pudo leer. */
export async function guiaDelServidor(id: string): Promise<GuiaGuardada | null> {
  if (SIN_SERVIDOR) return null;
  try {
    const res = await fetch(`/api/casos/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const r = z.object({ guia: Guia.nullable() }).safeParse(await res.json());
    return r.success ? r.data.guia : null;
  } catch {
    return null;
  }
}
