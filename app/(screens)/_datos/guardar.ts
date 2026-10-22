import type { Caso, Evento, Ficha, Foto } from "@/shared";
import type { GuiaDeCaso } from "@/lib/supabase/repo";
import { asegurarSesion, olvidarSesion } from "./cuenta";
import type { ImagenB64 } from "./imagen";
import { fetchConTiempo } from "./con-tiempo";
import { dispositivoViejo, leerCaso, marcarPendiente, olvidarDispositivo, type Cierre } from "./mis-casos";

/**
 * Guarda el avance del caso en Supabase vía `/api/casos`, en segundo plano y en orden
 * (el caso tiene que existir antes que sus fotos y eventos). Si falla, solo se registra:
 * guardar nunca frena el recorrido. El dueño es la sesión (cookie httpOnly), que se pide al abrir la
 * app (`asegurarSesion`); sin sesión el servidor responde 401 y el caso queda solo en el celular. Si quedó el id anónimo de antes del login, viaja
 * para que el servidor reclame sus casos, y se borra cuando lo confirma (docs/login.md §4).
 */

type Cambio = {
  caso?: Caso;
  tipoEquipo?: string | null;
  cierre?: Cierre;
  fotos?: { foto: Foto; imagen?: ImagenB64 }[];
  ficha?: Ficha;
  /** Una sola vez por caso: el servidor no pisa una guía ya guardada. */
  guia?: GuiaDeCaso;
  eventos?: Evento[];
};

let cola: Promise<unknown> = Promise.resolve();

/** Modo de prueba (NEXT_PUBLIC_DATOS=fixture): no se llenan las tablas con casos de ejemplo. */
const NO_GUARDAR = process.env.NEXT_PUBLIC_DATOS === "fixture";

/** "ok" llegó al servidor; "sesion" venció (401); "fallo" sin red, sin tiempo o el servidor no lo tomó. */
export type Resultado = "ok" | "sesion" | "fallo";

async function enviar(cambio: Cambio): Promise<Resultado> {
  await asegurarSesion();
  const dispositivo = dispositivoViejo();
  let res: Response;
  try {
    res = await fetchConTiempo("/api/casos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cambio, dispositivo }),
    });
  } catch (e) {
    console.warn("[guardar]", e);
    return "fallo";
  }
  if (!res.ok) {
    console.warn("[guardar]", res.status, await res.text().catch(() => ""));
    if (res.status !== 401) return "fallo";
    olvidarSesion();
    return "sesion";
  }
  const r = (await res.json().catch(() => null)) as { dispositivoReclamado?: boolean } | null;
  if (dispositivo && r?.dispositivoReclamado) olvidarDispositivo(dispositivo);
  return "ok";
}

/** Un turno de la cola: si no llega, el caso queda marcado como solo en el celular (y se desmarca al llegar). */
function encolar(cambio: Cambio, casoId: string | undefined): Promise<Resultado> {
  const turno = cola.then(async () => {
    const res = await enviar(cambio);
    if (casoId) marcarPendiente(casoId, res !== "ok");
    return res;
  });
  cola = turno.catch(() => undefined);
  return turno;
}

export function guardar(cambio: Cambio, casoId?: string): void {
  if (NO_GUARDAR) return;
  void encolar(cambio, casoId);
}

/**
 * "Reintentar guardado" de Mis casos: manda lo que el celular tiene del caso (caso, equipo, ficha,
 * cierre y guía). Las fotos no se guardan en el celular: si no llegaron, no vuelven con el reintento.
 */
export function reintentarGuardado(casoId: string): Promise<Resultado> {
  if (NO_GUARDAR) return Promise.resolve("ok");
  const local = leerCaso(casoId);
  if (!local) return Promise.resolve("fallo");
  return encolar(
    {
      caso: local.caso,
      tipoEquipo: local.tipoEquipo,
      ficha: local.ficha ?? undefined,
      cierre: local.cierre ?? undefined,
      guia: local.guia ? { casoId, ...local.guia } : undefined,
    },
    casoId,
  );
}
