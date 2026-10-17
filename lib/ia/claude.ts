import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/**
 * Llamadas a Claude del carril A — dueño: Juanma.
 * Regla: todo lo que devuelve el modelo pasa por Zod. Si no valida, se reintenta
 * una vez; si vuelve a fallar, se lanza ErrorIA y el código decide qué mostrar.
 */

export const MODELOS = {
  /** Visión, lectura de chapa, conversación. */
  vision: "claude-sonnet-5-5",
  /** Textos cortos y clasificaciones. */
  corto: "claude-haiku-5-5",
} as const;

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
  bibliotecario: { busquedas: 6, paginas: 6, vueltas: 12 },
  pack: { maxPasos: 12 },
  /** Lecturas del manual completo (comparten prefijo y caché de prompts: mismo effort en todas). */
  lectura: { effort: "medium" as const, maxTokensPack: 16000, maxTokensVistas: 1500 },
  chat: { maxTokensPack: 1500, maxTokensManual: 2000, maxHistorial: 30 },
} as const;

export type PedidoIA = {
  modelo: string;
  system: string;
  contenido: Anthropic.ContentBlockParam[];
  /** Esquema que se le pide al modelo (formato de salida). */
  formato: z.ZodType;
  maxTokens?: number;
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

export const llamarClaude: LlamarIA = async ({ modelo, system, contenido, formato, maxTokens }) => {
  const respuesta = await obtenerCliente().messages.create({
    model: modelo,
    max_tokens: maxTokens ?? 4000,
    output_config: { effort: "low", format: zodOutputFormat(formato) },
    system,
    messages: [{ role: "user", content: contenido }],
  });
  if (respuesta.stop_reason === "refusal") {
    throw new ErrorIA("El modelo rechazó el pedido", respuesta.stop_details);
  }
  return respuesta.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
};

/** Llamada completa (con streaming para pedidos largos, ej. un PDF). Se reemplaza en los tests. */
export type EnviarMensaje = (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;

export const enviarMensaje: EnviarMensaje = async (params) => {
  const mensaje = await obtenerCliente().messages.stream(params).finalMessage();
  if (mensaje.stop_reason === "refusal") throw new ErrorIA("El modelo rechazó el pedido", mensaje.stop_details);
  return mensaje;
};

/** Stream de eventos crudos (texto y citas a medida que llegan). Se reemplaza en los tests. */
export type StreamIA = (params: Anthropic.MessageCreateParamsNonStreaming) => AsyncIterable<Anthropic.RawMessageStreamEvent>;

export const streamClaude: StreamIA = (params) => obtenerCliente().messages.stream(params);

/** Sube un PDF a la Files API y devuelve su file_id (vence en 7 días). Se reemplaza en los tests. */
export type SubirArchivo = (datos: Buffer, nombre: string) => Promise<string>;

export const subirArchivo: SubirArchivo = async (datos, nombre) => {
  const archivo = await toFile(datos, nombre, { type: "application/pdf" });
  const meta = await obtenerCliente().files.upload({ file: archivo, expires_in_seconds: LIMITES.pdf.venceEnSeg });
  return meta.id;
};

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
