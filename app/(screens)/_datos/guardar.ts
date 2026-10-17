import type { Caso, Evento, Ficha, Foto } from "@/shared";
import { sinIA } from "../../../lib/demo/modo";
import type { ImagenB64 } from "./imagen";

/**
 * Guarda el avance del caso en Supabase vía `/api/casos`, en segundo plano y en orden
 * (el caso tiene que existir antes que sus fotos y eventos). Si falla, solo se registra:
 * guardar nunca frena el recorrido.
 */

type Cambio = {
  caso?: Caso;
  fotos?: { foto: Foto; imagen?: ImagenB64 }[];
  ficha?: Ficha;
  eventos?: Evento[];
};

let cola: Promise<unknown> = Promise.resolve();

export function guardar(cambio: Cambio): void {
  // Modo de prueba o demo: no se llenan las tablas con casos de ejemplo (y no hace falta internet).
  if (sinIA()) return;
  cola = cola
    .then(async () => {
      const res = await fetch("/api/casos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambio),
      });
      if (!res.ok) console.warn("[guardar]", res.status, await res.text().catch(() => ""));
    })
    .catch((e) => console.warn("[guardar]", e));
}
