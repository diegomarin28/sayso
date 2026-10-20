import { z } from "zod";
import { Guia } from "@/lib/supabase/guia";
import { mezclarDelServidor, ResumenServidor, type GuiaGuardada } from "./mis-casos";

/**
 * "Mis casos" desde el servidor (docs/login.md §6): la lista de la sesión y la guía de un caso, para
 * retomarlo en otro celular sin volver a llamar a la IA. Sin sesión (401) o sin red no pasa nada: queda
 * lo del celular. No pide una sesión nueva: si no hay, tampoco hay casos en el servidor.
 */

/** Modo de prueba (NEXT_PUBLIC_DATOS=fixture): no se lee el servidor. */
const SIN_SERVIDOR = process.env.NEXT_PUBLIC_DATOS === "fixture";

/** Trae los casos de la sesión y los mezcla con los del celular. Nunca tira error. */
export async function sincronizarCasos(): Promise<void> {
  if (SIN_SERVIDOR) return;
  try {
    const res = await fetch("/api/casos", { cache: "no-store" });
    if (!res.ok) return;
    const datos = (await res.json()) as { casos?: unknown };
    // Uno que no valida (de una versión vieja) se saltea en vez de descartar la lista.
    const casos = (Array.isArray(datos.casos) ? datos.casos : []).flatMap((c) => {
      const r = ResumenServidor.safeParse(c);
      return r.success ? [r.data] : [];
    });
    mezclarDelServidor(casos);
  } catch (e) {
    console.warn("[mis-casos] no se pudo leer el servidor", e);
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
