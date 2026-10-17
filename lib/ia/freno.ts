import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServidor } from "../supabase/cliente";
import { CODIGO_PAUSA } from "./pausa";

/**
 * Freno de gasto de la IA. Dos variables de entorno (se leen en cada pedido):
 * - IA_APAGADA=1          → ninguna llamada a Claude.
 * - IA_LIMITE_USD_DIA=5   → cuando el gasto estimado del día llega al límite, lo mismo.
 *   Un valor inválido pausa la IA (un error de tipeo no puede desactivar el freno).
 * El día es el de IA_ZONA_HORARIA (por defecto Argentina).
 *
 * Dos capas: las rutas preguntan `estadoFreno()` antes de empezar (503 "ia_en_pausa") y
 * lib/ia/claude.ts llama a `frenar()` antes de cada llamada, por si el límite se cruza a
 * mitad de un pedido. El último pedido antes del límite puede pasarlo por lo que cueste.
 *
 * El gasto se suma en `registrarUso` y se guarda en Supabase (tabla `gasto_ia`, migración 006);
 * sin la tabla o sin Supabase, se cuenta en memoria (cada instancia por su lado).
 */

const ZONA_POR_DEFECTO = "America/Argentina/Buenos_Aires";
/** Cada cuánto se vuelve a leer el total del día de Supabase (otras instancias también suman). */
const RELEER_MS = 10_000;

export type MotivoPausa = "apagada" | "limite";

const MENSAJES: Record<MotivoPausa, string> = {
  apagada: "IA en pausa: el equipo la apagó por un rato. Probá de nuevo más tarde.",
  limite: "IA en pausa: se llegó al límite de gasto de hoy. Probá de nuevo más tarde.",
};

/**
 * No es un ErrorIA a propósito: nadie lo convierte en "plantilla genérica" ni en "guía pública".
 * Sube hasta la ruta, que responde 503 con `codigo: "ia_en_pausa"`.
 */
export class IAEnPausa extends Error {
  readonly codigo = CODIGO_PAUSA;
  constructor(readonly motivo: MotivoPausa) {
    super(MENSAJES[motivo]);
    this.name = "IAEnPausa";
  }
}

export type ConfigFreno = { apagada: boolean; limiteUsdDia: number | null; zona: string };

export function configFreno(env: Record<string, string | undefined> = process.env): ConfigFreno {
  const apagada = /^(1|true|si|sí|on)$/i.test(env.IA_APAGADA?.trim() ?? "");
  const crudo = env.IA_LIMITE_USD_DIA?.trim();
  let limiteUsdDia: number | null = null;
  if (crudo) {
    const n = Number(crudo.replace(",", "."));
    if (Number.isFinite(n) && n >= 0) limiteUsdDia = n;
    else {
      console.error(`[freno] IA_LIMITE_USD_DIA no es un número (${crudo.length} caracteres): la IA queda en pausa.`);
      limiteUsdDia = 0;
    }
  }
  return { apagada, limiteUsdDia, zona: env.IA_ZONA_HORARIA?.trim() || ZONA_POR_DEFECTO };
}

/** "2026-10-17" en la zona del freno. */
export function diaDe(fecha: Date, zona: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(fecha);
}

// ---------- Contador del gasto ----------

export interface ContadorGasto {
  total(dia: string): Promise<number>;
  /** Suma y devuelve el total del día. */
  sumar(dia: string, usd: number): Promise<number>;
}

export function contadorEnMemoria(): ContadorGasto {
  const m = new Map<string, number>();
  return {
    total: async (dia) => m.get(dia) ?? 0,
    sumar: async (dia, usd) => {
      const t = (m.get(dia) ?? 0) + usd;
      m.set(dia, t);
      return t;
    },
  };
}

/** Supabase con respaldo en memoria: si falta la tabla (o falla), avisa una vez y sigue contando en memoria. */
export function contadorSupabase(db: SupabaseClient): ContadorGasto {
  const memoria = contadorEnMemoria();
  let avisado = false;
  const respaldo = (que: string, mensaje: string) => {
    if (!avisado) console.warn(`[freno] no pude ${que} el gasto en Supabase (${mensaje}): cuento en memoria. ¿Falta la migración 006?`);
    avisado = true;
  };
  return {
    async total(dia) {
      const { data, error } = await db.from("gasto_ia").select("usd").eq("dia", dia).maybeSingle();
      if (error) {
        respaldo("leer", error.message);
        return memoria.total(dia);
      }
      return Math.max(Number(data?.usd ?? 0), await memoria.total(dia));
    },
    async sumar(dia, usd) {
      const enMemoria = await memoria.sumar(dia, usd);
      const { data, error } = await db.rpc("sumar_gasto_ia", { p_dia: dia, p_usd: usd });
      if (error) {
        respaldo("sumar", error.message);
        return enMemoria;
      }
      return Number(data);
    },
  };
}

// ---------- Estado (una instancia del servidor) ----------

let contador: ContadorGasto | null = null;
let conocido: { dia: string; usd: number; leidoEn: number } | null = null;
const pendientes = new Set<Promise<unknown>>();

function elContador(): ContadorGasto {
  if (!contador) {
    const db = supabaseServidor();
    contador = db ? contadorSupabase(db) : contadorEnMemoria();
  }
  return contador;
}

/** Para los tests: otro contador (o null para volver al de siempre). */
export function usarContador(c: ContadorGasto | null): void {
  contador = c;
  conocido = null;
}

async function gastoDelDia(dia: string, ahora: number): Promise<number> {
  if (conocido?.dia === dia && ahora - conocido.leidoEn < RELEER_MS) return conocido.usd;
  const usd = await elContador().total(dia);
  conocido = { dia, usd, leidoEn: ahora };
  return usd;
}

/** null = la IA puede trabajar; si no, el motivo de la pausa (sin lanzar). */
export async function estadoFreno(ahora = new Date(), env: Record<string, string | undefined> = process.env): Promise<IAEnPausa | null> {
  const cfg = configFreno(env);
  if (cfg.apagada) return new IAEnPausa("apagada");
  if (cfg.limiteUsdDia === null) return null;
  const gastado = await gastoDelDia(diaDe(ahora, cfg.zona), ahora.getTime());
  return gastado >= cfg.limiteUsdDia ? new IAEnPausa("limite") : null;
}

/** Lanza IAEnPausa si la IA está apagada o pasada del límite. */
export async function frenar(): Promise<void> {
  const pausa = await estadoFreno();
  if (pausa) throw pausa;
}

/** Suma el costo de una llamada. No bloquea: las rutas esperan `gastoPendiente()` antes de responder. */
export function sumarGasto(usd: number, ahora = new Date()): void {
  if (!(usd > 0)) return;
  const dia = diaDe(ahora, configFreno().zona);
  if (conocido?.dia === dia) conocido.usd += usd; // la próxima consulta ya lo ve, sin esperar a Supabase
  const p = elContador()
    .sumar(dia, usd)
    .then((total) => {
      if (conocido?.dia === dia) conocido = { dia, usd: Math.max(total, conocido.usd), leidoEn: Date.now() };
    })
    .catch((e) => console.error("[freno] no pude sumar el gasto:", (e as Error).message))
    .finally(() => pendientes.delete(p));
  pendientes.add(p);
}

/** Espera a que se guarde el gasto ya sumado (en serverless, lo que queda colgado después de responder se pierde). */
export async function gastoPendiente(): Promise<void> {
  await Promise.allSettled([...pendientes]);
}

/** Respuesta HTTP para la app: 503 con un mensaje que se puede mostrar tal cual. */
export function respuestaPausa(e: IAEnPausa): Response {
  return Response.json({ error: e.message, codigo: e.codigo, motivo: e.motivo }, { status: 503 });
}
