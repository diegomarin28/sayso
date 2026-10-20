import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Foto } from "../../shared";
import { supabaseServidor } from "./cliente";

/**
 * Límite de uso de POST /api/casos (#332): sin él, cualquiera llena Storage y la base.
 * - Pedidos e imágenes por IP, por minuto y por día (tabla `limite_uso`, migración 011).
 * - Fotos por caso, contando las filas que el caso ya tiene en `fotos`.
 * Pasado un tope la ruta responde 429; `guardar()` solo lo registra y la app sigue igual.
 *
 * La IP es un dato personal: se guarda HMAC-SHA256(LIMITE_CLAVE_HASH, día + IP), nunca en claro.
 * Con el día adentro, el hash de una IP cambia cada día. Sin LIMITE_CLAVE_HASH se usa la clave
 * secreta de Supabase. Sin la tabla (o si falla) se cuenta en memoria: el límite nunca bloquea
 * por un error propio.
 */

export const TOPES = {
  /** Un caso normal guarda ~10–20 veces en su minuto más cargado; muchos celulares comparten IP (CGNAT). */
  pedidosPorMinuto: 60,
  /** Cada foto lleva varios segundos (sacarla y que la IA la revise): 10 por minuto supera el ritmo humano. */
  imagenesPorMinuto: 10,
  /** Para quien sube despacio y sin parar. */
  imagenesPorDia: 200,
  /** Se piden hasta 5 fotos por caso, más reintentos y alternativas. Incluye las rechazadas. */
  fotosPorCaso: 20,
  /** La app manda una foto por pedido. */
  fotosPorPedido: 2,
  /** Sesiones anónimas nuevas por IP: una por celular, pero muchos comparten IP (CGNAT). */
  sesionesPorDia: 50,
  /** Mails con código por IP y por email (que nadie use la app para llenarle la casilla a otro). */
  codigosPorDia: 10,
  codigosPorEmailPorDia: 5,
  /** Intentos de código por IP y por email: frena probar códigos de a uno. */
  verificacionesPorDia: 30,
  verificacionesPorEmailPorDia: 10,
  /** Intentos de contraseña por IP y por cuenta: frena probar contraseñas (además del CAPTCHA). */
  entradasPorDia: 50,
  entradasPorEmailPorDia: 10,
  /** Guía de un caso en JSON (pack, páginas y plano): una real ronda las decenas de KB. Pasado esto, 400. */
  bytesGuia: 500_000,
} as const;

const MINUTO_MS = 60_000;
const DIA_MS = 86_400_000;

/** IP del cliente. En Vercel `x-real-ip` y `x-forwarded-for` los pone el proxy. Sin ellas (local), una sola cuenta. */
export function ipDelPedido(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const reenviada = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return reenviada || "desconocida";
}

export function hashIp(ip: string, ahora: Date, env: Record<string, string | undefined> = process.env): string {
  const clave = env.LIMITE_CLAVE_HASH?.trim() || env.SUPABASE_SERVICE_ROLE_KEY || "";
  const dia = ahora.toISOString().slice(0, 10);
  return createHmac("sha256", clave).update(`${dia}|${ip}`).digest("hex");
}

// ---------- Contador ----------

export interface ContadorUso {
  /** Suma y devuelve el total de esa clave en la ventana. */
  sumar(clave: string, ventana: string, cantidad: number): Promise<number>;
}

export function contadorEnMemoria(): ContadorUso {
  const m = new Map<string, { ventana: string; cantidad: number }>();
  return {
    sumar: async (clave, ventana, cantidad) => {
      // Solo la ventana vigente de cada clave: la memoria no crece con el tiempo.
      const actual = m.get(clave);
      const total = (actual?.ventana === ventana ? actual.cantidad : 0) + cantidad;
      m.set(clave, { ventana, cantidad: total });
      return total;
    },
  };
}

/** Supabase con respaldo en memoria: si falta la tabla (o falla), avisa una vez y sigue contando en memoria. */
export function contadorSupabase(db: SupabaseClient): ContadorUso {
  const memoria = contadorEnMemoria();
  let avisado = false;
  return {
    async sumar(clave, ventana, cantidad) {
      const enMemoria = await memoria.sumar(clave, ventana, cantidad);
      // Un error lanzado (no solo el devuelto) también cae en memoria: el límite nunca hace fallar el guardado.
      const { data, error } = await Promise.resolve()
        .then(() => db.rpc("sumar_limite_uso", { p_clave: clave, p_ventana: ventana, p_cantidad: cantidad }))
        .catch((e: Error) => ({ data: null, error: { message: e.message } }));
      if (error) {
        if (!avisado) console.warn(`[limite] no pude contar en Supabase (${error.message}): cuento en memoria. ¿Falta la migración 011?`);
        avisado = true;
        return enMemoria;
      }
      return Number(data);
    },
  };
}

let contador: ContadorUso | null = null;

function elContador(): ContadorUso {
  if (!contador) {
    const db = supabaseServidor();
    contador = db ? contadorSupabase(db) : contadorEnMemoria();
  }
  return contador;
}

/** Para los tests: otro contador (o null para volver al de siempre). */
export function usarContador(c: ContadorUso | null): void {
  contador = c;
}

// ---------- Topes ----------

export type MotivoLimite =
  | "pedidos"
  | "imagenes"
  | "fotos_por_caso"
  | "sesiones"
  | "codigos"
  | "verificaciones"
  | "entradas";

export type Excedido = { motivo: MotivoLimite; reintentarEnSeg: number };

function ventana(ahora: number, largo: number) {
  const inicio = Math.floor(ahora / largo) * largo;
  return { inicio: new Date(inicio).toISOString(), quedanSeg: Math.max(1, Math.ceil((inicio + largo - ahora) / 1000)) };
}

/** Cuenta este pedido y sus imágenes contra los topes por IP. null = puede seguir. */
export async function revisarPorIp(
  req: Request,
  imagenes: number,
  ahora = new Date(),
  env: Record<string, string | undefined> = process.env,
): Promise<Excedido | null> {
  const h = hashIp(ipDelPedido(req), ahora, env);
  const minuto = ventana(ahora.getTime(), MINUTO_MS);
  const dia = ventana(ahora.getTime(), DIA_MS);
  const c = elContador();
  const [pedidos, imgMinuto, imgDia] = await Promise.all([
    c.sumar(`pedidos:${h}`, minuto.inicio, 1),
    imagenes > 0 ? c.sumar(`imagenes:${h}`, minuto.inicio, imagenes) : 0,
    imagenes > 0 ? c.sumar(`imagenes_dia:${h}`, dia.inicio, imagenes) : 0,
  ]);
  if (pedidos > TOPES.pedidosPorMinuto) return { motivo: "pedidos", reintentarEnSeg: minuto.quedanSeg };
  if (imgDia > TOPES.imagenesPorDia) return { motivo: "imagenes", reintentarEnSeg: dia.quedanSeg };
  if (imgMinuto > TOPES.imagenesPorMinuto) return { motivo: "imagenes", reintentarEnSeg: minuto.quedanSeg };
  return null;
}

/**
 * Topes de las rutas de cuenta (`app/api/cuenta`), por IP y por día; los de código también por
 * email (HMAC como la IP, nunca en claro). Supabase tiene sus propios topes, pero desde el servidor
 * ve la IP de Vercel, no la de cada persona. null = puede seguir.
 */
export async function revisarCuenta(
  req: Request,
  accion: "sesion" | "codigo" | "verificar" | "entrar",
  email?: string,
  ahora = new Date(),
  env: Record<string, string | undefined> = process.env,
): Promise<Excedido | null> {
  const dia = ventana(ahora.getTime(), DIA_MS);
  const c = elContador();
  const [porIp, porEmail, motivo]: readonly [number, number, MotivoLimite] = {
    sesion: [TOPES.sesionesPorDia, Infinity, "sesiones"] as const,
    codigo: [TOPES.codigosPorDia, TOPES.codigosPorEmailPorDia, "codigos"] as const,
    verificar: [TOPES.verificacionesPorDia, TOPES.verificacionesPorEmailPorDia, "verificaciones"] as const,
    entrar: [TOPES.entradasPorDia, TOPES.entradasPorEmailPorDia, "entradas"] as const,
  }[accion];
  const [ip, deEmail] = await Promise.all([
    c.sumar(`${accion}:${hashIp(ipDelPedido(req), ahora, env)}`, dia.inicio, 1),
    email ? c.sumar(`${accion}_email:${hashIp(email.toLowerCase(), ahora, env)}`, dia.inicio, 1) : 0,
  ]);
  if (ip > porIp || deEmail > porEmail) return { motivo, reintentarEnSeg: dia.quedanSeg };
  return null;
}

/**
 * Tope de fotos por caso: las filas que ya tiene más las nuevas de este pedido (reescribir una foto
 * que ya está no suma). Si la consulta falla, deja seguir.
 */
export async function revisarFotosPorCaso(db: SupabaseClient, fotos: Foto[]): Promise<Excedido | null> {
  const porCaso = new Map<string, Set<string>>();
  for (const f of fotos) porCaso.set(f.casoId, (porCaso.get(f.casoId) ?? new Set()).add(f.id));
  for (const [casoId, ids] of porCaso) {
    const { data, error } = await Promise.resolve()
      .then(() => db.from("fotos").select("id").eq("caso_id", casoId).limit(TOPES.fotosPorCaso + TOPES.fotosPorPedido))
      .catch((e: Error) => ({ data: null, error: { message: e.message } }));
    if (error) {
      console.warn("[limite] no pude contar las fotos del caso:", error.message);
      continue;
    }
    const existentes = new Set((data ?? []).map((f: { id: string }) => f.id));
    const nuevas = [...ids].filter((id) => !existentes.has(id)).length;
    if (nuevas > 0 && existentes.size + nuevas > TOPES.fotosPorCaso) {
      return { motivo: "fotos_por_caso", reintentarEnSeg: DIA_MS / 1000 };
    }
  }
  return null;
}

const MENSAJES: Record<MotivoLimite, string> = {
  pedidos: "Demasiados pedidos seguidos. Probá de nuevo en un rato.",
  imagenes: "Demasiadas fotos seguidas. Probá de nuevo en un rato.",
  fotos_por_caso: "Este caso ya tiene el máximo de fotos guardadas.",
  sesiones: "Demasiadas sesiones nuevas desde esta conexión. Probá de nuevo mañana.",
  codigos: "Ya mandamos muchos códigos. Probá de nuevo mañana.",
  verificaciones: "Demasiados intentos con el código. Probá de nuevo mañana.",
  entradas: "Demasiados intentos para entrar. Probá de nuevo mañana o cambiá la contraseña.",
};

export function respuestaLimite(e: Excedido): Response {
  return Response.json(
    { error: MENSAJES[e.motivo], codigo: "limite", motivo: e.motivo },
    { status: 429, headers: { "Retry-After": String(e.reintentarEnSeg) } },
  );
}
