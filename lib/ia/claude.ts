import Anthropic from "@anthropic-ai/sdk";
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
