import type { Caso, Evento, Ficha, Foto } from "@/shared";
import { asegurarSesion, olvidarSesion } from "./cuenta";
import type { ImagenB64 } from "./imagen";
import { dispositivoViejo, olvidarDispositivo, type Cierre } from "./mis-casos";

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
  eventos?: Evento[];
};

let cola: Promise<unknown> = Promise.resolve();

/** Modo de prueba (NEXT_PUBLIC_DATOS=fixture): no se llenan las tablas con casos de ejemplo. */
const NO_GUARDAR = process.env.NEXT_PUBLIC_DATOS === "fixture";

export function guardar(cambio: Cambio): void {
  if (NO_GUARDAR) return;
  cola = cola
    .then(async () => {
      await asegurarSesion();
      const dispositivo = dispositivoViejo();
      const res = await fetch("/api/casos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cambio, dispositivo }),
      });
      if (!res.ok) {
        if (res.status === 401) olvidarSesion();
        console.warn("[guardar]", res.status, await res.text().catch(() => ""));
        return;
      }
      const r = (await res.json().catch(() => null)) as { dispositivoReclamado?: boolean } | null;
      if (dispositivo && r?.dispositivoReclamado) olvidarDispositivo(dispositivo);
    })
    .catch((e) => console.warn("[guardar]", e));
}
