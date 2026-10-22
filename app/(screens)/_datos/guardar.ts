import type { Caso, Evento, Ficha, Foto } from "@/shared";
import type { GuiaDeCaso } from "@/lib/supabase/repo";
import { asegurarSesion, olvidarSesion } from "./cuenta";
import type { ImagenB64 } from "./imagen";
import { fetchConTiempo } from "./con-tiempo";
import {
  dispositivoViejo,
  leerCaso,
  marcarPendiente,
  olvidarDispositivo,
  sumarFotosSinCopia,
  type Cierre,
} from "./mis-casos";
import {
  borrarFotosPendientes,
  fotosPendientesDelCaso,
  guardarFotosPendientes,
} from "./fotos-pendientes";

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

/**
 * El servidor acepta 2 fotos por pedido (`TOPES.fotosPorPedido`, lib/supabase/limite.ts): un pedido con
 * más se rechaza entero. Igual que ahí, se mantiene en 2. El primer pedido lleva todo lo demás del caso;
 * los siguientes, solo sus fotos y el caso (que el servidor no pisa).
 */
const FOTOS_POR_PEDIDO = 2;

function pedidosDe(cambio: Cambio): Cambio[] {
  const { fotos = [], ...resto } = cambio;
  if (fotos.length <= FOTOS_POR_PEDIDO) return [cambio];
  const pedidos: Cambio[] = [];
  for (let i = 0; i < fotos.length; i += FOTOS_POR_PEDIDO) {
    const trozo = fotos.slice(i, i + FOTOS_POR_PEDIDO);
    pedidos.push(i === 0 ? { ...resto, fotos: trozo } : { caso: resto.caso, fotos: trozo });
  }
  return pedidos;
}

/**
 * Un turno de la cola. Manda los pedidos en orden y para en el primero que no llega. Después marca el
 * caso como solo en el celular (o lo desmarca) y guarda en el celular las fotos que no llegaron, o quita
 * las que sí.
 */
function encolar(cambio: Cambio, casoId: string | undefined): Promise<Resultado> {
  const turno = cola.then(async () => {
    let res: Resultado = "ok";
    for (const pedido of pedidosDe(cambio)) {
      res = await enviar(pedido).catch((e): Resultado => {
        console.warn("[guardar]", e);
        return "fallo";
      });
      if (res !== "ok") break;
    }
    if (casoId) marcarPendiente(casoId, res !== "ok");
    const fotos = cambio.fotos ?? [];
    if (casoId && fotos.length) {
      if (res === "ok") {
        await borrarFotosPendientes(fotos.map((f) => f.foto.id));
      } else {
        const sinCopia = await guardarFotosPendientes(
          fotos.map(({ foto, imagen }) => ({ casoId, foto, imagen })),
        );
        sumarFotosSinCopia(casoId, sinCopia);
      }
    }
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
 * cierre y guía) y las fotos que quedaron guardadas en el celular. Las que no se guardaron (tope o sin
 * IndexedDB) ya no están: el caso queda con el aviso de `fotosSinCopia`.
 */
export async function reintentarGuardado(casoId: string): Promise<Resultado> {
  if (NO_GUARDAR) return "ok";
  const local = leerCaso(casoId);
  if (!local) return "fallo";
  const pendientes = await fotosPendientesDelCaso(casoId);
  return encolar(
    {
      caso: local.caso,
      tipoEquipo: local.tipoEquipo,
      ficha: local.ficha ?? undefined,
      cierre: local.cierre ?? undefined,
      guia: local.guia ? { casoId, ...local.guia } : undefined,
      fotos: pendientes.map(({ foto, imagen }) => ({ foto, imagen })),
    },
    casoId,
  );
}
