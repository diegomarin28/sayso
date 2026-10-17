import { AsyncLocalStorage } from "node:async_hooks";
import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { frenar, sumarGasto } from "./freno";

/**
 * Llamadas a Claude del carril A — dueño: Juanma.
 * Regla: todo lo que devuelve el modelo pasa por Zod. Si no valida, se reintenta
 * una vez; si vuelve a fallar, se lanza ErrorIA y el código decide qué mostrar.
 * Cada llamada registra sus tokens y su costo estimado (ver "Costo" más abajo).
 */

export const MODELOS = {
  /** Visión y razonamiento: calidad de foto, lectura de chapa, chat con el manual. */
  vision: "claude-sonnet-5-5",
  /** Textos cortos, clasificaciones y pasos sin visión: entender, fotos, elegir páginas, buscar manual. */
  corto: "claude-haiku-5-5",
} as const;

/** Qué modelo usa cada paso que podría ir con cualquiera de los dos (se decide midiendo calidad y costo). */
export const MODELO_DE = {
  /** Lectura del extracto del manual para armar el pack (demo de hackatón: lo más barato que dé buenos pasos). */
  lectura: MODELOS.corto as string,
  /** Bibliotecario: buscar el PDF del manual en la web. */
  bibliotecario: MODELOS.corto as string,
  /** Chat respondiendo solo con el pack (sin PDF). */
  chatPack: MODELOS.vision as string,
};

/** Umbrales y límites del carril A, en un solo lugar (regla "nada hardcodeado"). */
export const LIMITES = {
  foto: {
    /** Nitidez mínima (0–1) para aceptar una foto. */
    nitidezMinima: 0.6,
    /** Máximo de fotos que la IA puede agregar a la lista base. */
    extrasMax: 2,
    /** ~5 MB de imagen en base64 (límite de Claude por imagen). */
    maxBase64: 7_000_000,
    chapaMaxImagenes: 3,
  },
  pdf: { maxBytes: 150 * 1024 * 1024, timeoutMs: 60_000, venceEnSeg: 7 * 24 * 3600 },
  bibliotecario: {
    busquedas: 3,
    paginas: 2,
    vueltas: 6,
    /** Tope de texto por página abierta con web_fetch (los PDF no se cortan: se prueban con probar_pdf). */
    maxTokensPagina: 10_000,
  },
  /** Extracto del manual: lo único que se le manda a la IA (nunca el PDF entero). */
  extracto: { maxPaginas: 14, maxPaginasPorRango: 6, paginasIniciales: 8, caracteresPorPagina: 90, maxMarcadores: 400 },
  pack: { maxPasos: 12 },
  /** Lecturas del manual completo (comparten prefijo y caché de prompts: mismo effort en todas). */
  // maxTokensPack incluye el razonamiento del modelo: con poco margen se queda sin lugar para escribir los pasos.
  lectura: { effort: "medium" as const, maxTokensPack: 32000, maxTokensVistas: 1500 },
  /** Guía pública (sin manual): búsquedas y continuaciones de `pause_turn`. */
  guiaPublica: { busquedas: 4, continuaciones: 3 },
  chat: { maxTokensPack: 1500, maxTokensManual: 2000, maxHistorial: 30 },
} as const;

// ---------- Costo ----------

type Tarifa = { entrada: number; salida: number };
type Precio = Tarifa & { /** Tarifa para prompts largos (Haiku 5.5: más de 100K tokens). */ largo?: Tarifa & { desde: number } };

/**
 * USD por millón de tokens (precios de la API de Anthropic, octubre 2026).
 * Caché de 5 minutos: escribir cuesta 1,25x la entrada y leer 0,1x.
 */
export const PRECIOS: Record<string, Precio> = {
  [MODELOS.vision]: { entrada: 2, salida: 10 },
  [MODELOS.corto]: { entrada: 0.1, salida: 0.5, largo: { desde: 100_000, entrada: 0.5, salida: 2.5 } },
};
const CACHE_ESCRITURA = 1.25;
const CACHE_LECTURA = 0.1;
/** La búsqueda web se cobra aparte: USD 10 cada 1000 búsquedas. */
export const USD_POR_BUSQUEDA_WEB = 0.01;

/** Tokens y costo de una llamada. */
export type Uso = {
  etapa: string;
  modelo: string;
  entrada: number;
  salida: number;
  cacheEscrita: number;
  cacheLeida: number;
  busquedas: number;
  usd: number;
};

/** Lo que devuelve la API en `usage` (mensaje completo o delta del stream). */
type UsoApi = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

export function calcularUso(etapa: string, modelo: string, u: UsoApi): Uso {
  const entrada = u.input_tokens ?? 0;
  const salida = u.output_tokens ?? 0;
  const cacheEscrita = u.cache_creation_input_tokens ?? 0;
  const cacheLeida = u.cache_read_input_tokens ?? 0;
  const busquedas = u.server_tool_use?.web_search_requests ?? 0;
  // Un modelo sin precio cargado se cuenta como Sonnet, para no subestimar.
  const p = PRECIOS[modelo] ?? PRECIOS[MODELOS.vision];
  const t: Tarifa = p.largo && entrada + cacheEscrita + cacheLeida > p.largo.desde ? p.largo : p;
  const usd =
    (entrada * t.entrada + cacheEscrita * t.entrada * CACHE_ESCRITURA + cacheLeida * t.entrada * CACHE_LECTURA + salida * t.salida) / 1e6 +
    busquedas * USD_POR_BUSQUEDA_WEB;
  return { etapa, modelo, entrada, salida, cacheEscrita, cacheLeida, busquedas, usd };
}

/** Junta el `usage` de un stream (llega en `message_start` y se completa en `message_delta`). */
export class AcumuladorUso {
  private u: UsoApi = {};
  constructor(
    private readonly etapa: string,
    private readonly modelo: string,
  ) {}

  ver(ev: Anthropic.RawMessageStreamEvent): void {
    if (ev.type === "message_start") this.u = { ...ev.message.usage };
    else if (ev.type === "message_delta") {
      // Los valores del delta son acumulados: cuando vienen, reemplazan a los del inicio.
      for (const [k, v] of Object.entries(ev.usage)) if (v !== null && v !== undefined) (this.u as Record<string, unknown>)[k] = v;
    }
  }

  uso(): Uso {
    return calcularUso(this.etapa, this.modelo, this.u);
  }
}

const medicion = new AsyncLocalStorage<Uso[]>();

/** Registra el uso de una llamada: en el log siempre, y en la medición en curso si hay una. */
export function registrarUso(uso: Uso): void {
  medicion.getStore()?.push(uso);
  sumarGasto(uso.usd);
  console.info(
    `[costo] ${uso.etapa} · ${uso.modelo} · entrada ${uso.entrada} · salida ${uso.salida} · caché escrita ${uso.cacheEscrita} / leída ${uso.cacheLeida}` +
      `${uso.busquedas ? ` · ${uso.busquedas} búsquedas` : ""} · US$ ${uso.usd.toFixed(4)}`,
  );
}

/** Corre `fn` y devuelve, además de su resultado, el uso de todas las llamadas que hizo. */
export async function medirCosto<T>(fn: () => Promise<T>): Promise<{ resultado: T; usos: Uso[] }> {
  const usos: Uso[] = [];
  const resultado = await medicion.run(usos, fn);
  return { resultado, usos };
}

export function totalUsd(usos: Uso[]): number {
  return usos.reduce((s, u) => s + u.usd, 0);
}

// ---------- Llamadas ----------

export type PedidoIA = {
  modelo: string;
  system: string;
  contenido: Anthropic.ContentBlockParam[];
  /** Esquema que se le pide al modelo (formato de salida). */
  formato: z.ZodType;
  maxTokens?: number;
  /** Nombre del paso, para el registro de costos (ej. "recepcion: calidad de foto"). */
  etapa?: string;
};

/** Devuelve el texto crudo de la respuesta. Se reemplaza en los tests. */
export type LlamarIA = (pedido: PedidoIA) => Promise<string>;

export class ErrorIA extends Error {
  constructor(
    message: string,
    readonly detalle?: unknown,
  ) {
    super(message);
    this.name = "ErrorIA";
  }
}

let cliente: Anthropic | null = null;
function obtenerCliente(): Anthropic {
  // Se crea recién al usarlo, así el build no necesita la clave.
  cliente ??= new Anthropic();
  return cliente;
}

// Las tres llamadas a Claude pasan por el freno de gasto (lib/ia/freno.ts) antes de gastar.

export const llamarClaude: LlamarIA = async ({ modelo, system, contenido, formato, maxTokens, etapa }) => {
  await frenar();
  const respuesta = await obtenerCliente().messages.create({
    model: modelo,
    max_tokens: maxTokens ?? 4000,
    output_config: { effort: "low", format: zodOutputFormat(formato) },
    system,
    messages: [{ role: "user", content: contenido }],
  });
  registrarUso(calcularUso(etapa ?? "sin etapa", modelo, respuesta.usage));
  if (respuesta.stop_reason === "refusal") {
    throw new ErrorIA("El modelo rechazó el pedido", respuesta.stop_details);
  }
  return respuesta.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
};

/** Llamada completa (con streaming para pedidos largos, ej. un PDF). Se reemplaza en los tests. */
export type EnviarMensaje = (params: Anthropic.MessageCreateParamsNonStreaming, etapa?: string) => Promise<Anthropic.Message>;

export const enviarMensaje: EnviarMensaje = async (params, etapa) => {
  await frenar();
  const mensaje = await obtenerCliente().messages.stream(params).finalMessage();
  registrarUso(calcularUso(etapa ?? "sin etapa", params.model, mensaje.usage));
  if (mensaje.stop_reason === "refusal") throw new ErrorIA("El modelo rechazó el pedido", mensaje.stop_details);
  return mensaje;
};

/**
 * Stream de eventos crudos (texto y citas a medida que llegan). Se reemplaza en los tests.
 * Quien lo consume registra el uso con `AcumuladorUso` (ver lib/chat/conversar.ts).
 */
export type StreamIA = (params: Anthropic.MessageCreateParamsNonStreaming) => AsyncIterable<Anthropic.RawMessageStreamEvent>;

export const streamClaude: StreamIA = async function* (params) {
  await frenar();
  yield* obtenerCliente().messages.stream(params);
};

/** Sube un PDF a la Files API y devuelve su file_id (vence en 7 días). Se reemplaza en los tests. */
export type SubirArchivo = (datos: Buffer, nombre: string) => Promise<string>;

export const subirArchivo: SubirArchivo = async (datos, nombre) => {
  const archivo = await toFile(datos, nombre, { type: "application/pdf" });
  const meta = await obtenerCliente().files.upload({ file: archivo, expires_in_seconds: LIMITES.pdf.venceEnSeg });
  return meta.id;
};

/** Nombre con el que se subió un archivo a la Files API. */
export async function nombreDeArchivo(fileId: string): Promise<string> {
  return (await obtenerCliente().files.retrieveMetadata(fileId)).filename;
}

/**
 * Herramientas web según el modelo: Sonnet usa las versiones con filtrado dinámico;
 * Haiku, las básicas (las nuevas son solo para Sonnet y Opus).
 */
export function herramientasWeb(
  modelo: string,
  maximos: { busquedas: number; paginas?: number; maxTokensPagina?: number },
): Anthropic.ToolUnion[] {
  const nuevas = modelo !== MODELOS.corto;
  const tools: Anthropic.ToolUnion[] = [
    nuevas
      ? { type: "web_search_20260209", name: "web_search", max_uses: maximos.busquedas }
      : { type: "web_search_20250305", name: "web_search", max_uses: maximos.busquedas },
  ];
  if (maximos.paginas) {
    tools.push(
      nuevas
        ? { type: "web_fetch_20260209", name: "web_fetch", max_uses: maximos.paginas, max_content_tokens: maximos.maxTokensPagina }
        : { type: "web_fetch_20250910", name: "web_fetch", max_uses: maximos.paginas, max_content_tokens: maximos.maxTokensPagina },
    );
  }
  return tools;
}

/** Primer objeto JSON dentro de un texto (por si el modelo agrega algo alrededor). */
export function extraerJson(texto: string): unknown {
  const ini = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (ini < 0 || fin <= ini) throw new ErrorIA("No hay JSON en la respuesta");
  return JSON.parse(texto.slice(ini, fin + 1));
}

/**
 * Pide JSON al modelo y lo valida con `esquema`. Un reintento si no valida.
 * `esquema` puede ser más estricto que `formato` (ej. rangos numéricos).
 */
export async function pedirJson<T>(
  esquema: z.ZodType<T>,
  pedido: Omit<PedidoIA, "formato"> & { formato?: z.ZodType },
  llamar: LlamarIA = llamarClaude,
): Promise<T> {
  const completo: PedidoIA = { ...pedido, formato: pedido.formato ?? esquema };
  let ultimoError: unknown;
  for (let intento = 0; intento < 2; intento++) {
    const texto = await llamar(completo);
    let json: unknown;
    try {
      json = JSON.parse(texto);
    } catch (e) {
      ultimoError = e;
      continue;
    }
    const r = esquema.safeParse(json);
    if (r.success) return r.data;
    ultimoError = r.error;
  }
  throw new ErrorIA("La respuesta del modelo no validó dos veces", ultimoError);
}

/** Bloque de imagen en base64 para mandar al modelo. */
export function bloqueImagen(imagen: ImagenEntrada): Anthropic.ImageBlockParam {
  return {
    type: "image",
    source: { type: "base64", media_type: imagen.mediaType, data: imagen.base64 },
  };
}

export type ImagenEntrada = {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
};
