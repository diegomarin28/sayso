import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ClaseEquipo, Evento, TipoFoto, type Agente } from "../../shared";
import { ErrorIA, LIMITES, medirCosto, MODELOS, totalUsd, type Uso, TEXTO_ESCALADA } from "../ia/claude";
import { estadoFreno, gastoPendiente, IAEnPausa, respuestaPausa } from "../ia/freno";

/** Esquemas de entrada de /api/intake/*. Todo lo que manda el cliente se valida acá. */

/** ~5 MB de imagen. Claude acepta hasta 5 MB por imagen. */
const MAX_BASE64 = LIMITES.foto.maxBase64;

export const ImagenSchema = z.object({
  base64: z
    .string()
    .min(1)
    .max(MAX_BASE64, "La imagen es demasiado grande (máximo 5 MB)")
    .transform((s) => s.replace(/^data:[^;]+;base64,/, "")),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
});

/** Tipo de equipo en texto libre (cualquier dispositivo), como lo devuelve /api/intake/entender. */
export const TipoEquipo = z.string().trim().min(1).max(60);

export const EntradaPedidos = z.object({
  casoId: z.string().min(1),
  clase: ClaseEquipo,
  sintoma: z.string().min(1).max(2000),
  tipoEquipo: TipoEquipo.optional(),
});

export const EntradaCalidad = z.object({
  casoId: z.string().min(1),
  tipoPedido: TipoFoto,
  imagen: ImagenSchema,
  url: z.string().optional(),
});

export const EntradaChapa = z
  .object({
    casoId: z.string().min(1),
    clase: ClaseEquipo,
    tipoEquipo: TipoEquipo.optional(),
    /** Fotos de la etiqueta (pueden faltar si no se encontró). */
    imagenes: z.array(ImagenSchema).max(LIMITES.foto.chapaMaxImagenes).default([]),
    /** Fotos del equipo entero: si la etiqueta no se lee, se reconoce la marca y el modelo por acá (siempre "probable"). */
    imagenesFrente: z.array(ImagenSchema).max(2).default([]),
  })
  .refine((e) => e.imagenes.length + e.imagenesFrente.length > 0, "Mandá al menos una foto de la etiqueta o del equipo");

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

const NOMBRE_MODELO: Record<string, string> = { [MODELOS.vision]: "Sonnet", [MODELOS.corto]: "Haiku" };

/** "US$ 0,0123" */
export function formatoUsd(usd: number): string {
  return `US$ ${usd.toFixed(4).replace(".", ",")}`;
}

/** Evento del feed con el costo de las llamadas a la IA de un paso (null si no hubo llamadas). */
export function eventoCosto(casoId: string, agente: z.infer<typeof Agente>, usos: Uso[]): Evento | null {
  if (usos.length === 0) return null;
  const suma = (k: "entrada" | "salida" | "cacheEscrita" | "cacheLeida") => usos.reduce((s, u) => s + u[k], 0);
  const modelos = [...new Set(usos.map((u) => NOMBRE_MODELO[u.modelo] ?? u.modelo))].join(" y ");
  const leida = suma("cacheLeida");
  const usd = totalUsd(usos);
  const escaladas = usos.filter((u) => u.escalada);
  const textoEscaladas = escaladas.length
    ? ` Escaló a un modelo más capaz ${escaladas.length === 1 ? "1 vez" : `${escaladas.length} veces`} (${[...new Set(escaladas.map((u) => TEXTO_ESCALADA[u.escalada!]))].join("; ")}).`
    : "";
  return evento(
    casoId,
    agente,
    "costo",
    `Costo de este paso: ${formatoUsd(usd)} (${usos.length} ${usos.length === 1 ? "llamada" : "llamadas"} a ${modelos}; ` +
      `${suma("entrada") + suma("cacheEscrita")} tokens de entrada${leida ? ` y ${leida} leídos de la caché` : ""}, ${suma("salida")} de salida).` +
      textoEscaladas,
    { usd, usos, escaladas: escaladas.length },
  );
}

/** Si el resultado trae `eventos`, le suma el del costo (con el caso y el agente del primer evento). */
function conCosto(resultado: unknown, usos: Uso[]): unknown {
  if (!resultado || typeof resultado !== "object" || !("eventos" in resultado)) return resultado;
  const eventos = (resultado as { eventos: unknown }).eventos;
  if (!Array.isArray(eventos) || eventos.length === 0) return resultado;
  const primero = Evento.safeParse(eventos[0]);
  if (!primero.success) return resultado;
  const costo = eventoCosto(primero.data.casoId, primero.data.agente, usos);
  return costo ? { ...resultado, eventos: [...eventos, costo] } : resultado;
}

/**
 * Lee y valida el cuerpo; ejecuta `fn` midiendo el costo de la IA; traduce errores a respuestas HTTP.
 * Si la IA está en pausa (lib/ia/freno.ts), responde 503 "ia_en_pausa" sin empezar.
 * `ia: false` para las rutas que no llaman a la IA (no se frenan).
 */
export async function manejar<T>(
  req: Request,
  esquema: z.ZodType<T>,
  fn: (entrada: T) => Promise<unknown>,
  opciones: { ia?: boolean } = {},
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
  if (opciones.ia !== false) {
    const pausa = await estadoFreno();
    if (pausa) return respuestaPausa(pausa);
  }
  try {
    const { resultado, usos } = await medirCosto(() => fn(r.data));
    await gastoPendiente();
    return Response.json(conCosto(resultado, usos));
  } catch (e) {
    await gastoPendiente();
    if (e instanceof IAEnPausa) return respuestaPausa(e);
    if (e instanceof ErrorIA || e instanceof Anthropic.APIError) {
      console.error("[intake] IA", e.message);
      return Response.json({ error: "La IA no pudo responder. Probá de nuevo." }, { status: 502 });
    }
    console.error("[intake]", e);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}
