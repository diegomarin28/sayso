import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ClaseEquipo, Evento, TipoFoto, type Agente } from "../../shared";
import { ErrorIA } from "../ia/claude";

/** Esquemas de entrada de /api/intake/*. Todo lo que manda el cliente se valida acá. */

/** ~5 MB de imagen. Claude acepta hasta 5 MB por imagen. */
const MAX_BASE64 = 7_000_000;

export const ImagenSchema = z.object({
  base64: z
    .string()
    .min(1)
    .max(MAX_BASE64, "La imagen es demasiado grande (máximo 5 MB)")
    .transform((s) => s.replace(/^data:[^;]+;base64,/, "")),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
});

export const EntradaPedidos = z.object({
  casoId: z.string().min(1),
  clase: ClaseEquipo,
  sintoma: z.string().min(1).max(2000),
});

export const EntradaCalidad = z.object({
  casoId: z.string().min(1),
  tipoPedido: TipoFoto,
  imagen: ImagenSchema,
  url: z.string().optional(),
});

export const EntradaChapa = z.object({
  casoId: z.string().min(1),
  clase: ClaseEquipo,
  imagenes: z.array(ImagenSchema).min(1).max(3),
});

export function evento(
  casoId: string,
  agente: z.infer<typeof Agente>,
  tipo: string,
  mensaje: string,
  datos?: Record<string, unknown>,
): Evento {
  return Evento.parse({
    id: crypto.randomUUID(),
    casoId,
    agente,
    tipo,
    mensaje,
    ts: new Date().toISOString(),
    ...(datos ? { datos } : {}),
  });
}

/** Lee y valida el cuerpo; ejecuta `fn`; traduce errores a respuestas HTTP. */
export async function manejar<T>(
  req: Request,
  esquema: z.ZodType<T>,
  fn: (entrada: T) => Promise<unknown>,
): Promise<Response> {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return Response.json({ error: "El cuerpo no es JSON" }, { status: 400 });
  }
  const r = esquema.safeParse(cuerpo);
  if (!r.success) {
    return Response.json({ error: "Entrada inválida", detalle: z.treeifyError(r.error) }, { status: 400 });
  }
  try {
    return Response.json(await fn(r.data));
  } catch (e) {
    if (e instanceof ErrorIA || e instanceof Anthropic.APIError) {
      console.error("[intake] IA", e.message);
      return Response.json({ error: "La IA no pudo responder. Probá de nuevo." }, { status: 502 });
    }
    console.error("[intake]", e);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}
