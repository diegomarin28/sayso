import { z } from "zod";
import {
  Caso,
  Evento,
  Ficha,
  Foto,
  KnowledgePack,
  PedidoDeFoto,
  PlanoDePiezas,
  fichaEjemplo,
  fotosEjemplo,
} from "@/shared";
import type { ImagenB64 } from "./imagen";

/**
 * Fuente de datos de las pantallas: llama a `/api/intake/*`, `/api/ficha`, `/api/knowledge` (carril A) y `/api/plano` (carril B).
 * Con `NEXT_PUBLIC_DATOS=fixture` responde con los fixtures de `shared/` sin gastar IA
 * (sirve para trabajar sin claves y como plan B de la demo).
 */

const USAR_FIXTURE = process.env.NEXT_PUBLIC_DATOS === "fixture";

/** Error que se le puede mostrar a la persona tal cual. */
export class ErrorApi extends Error {}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function llamar<T>(ruta: string, cuerpo: unknown, esquema: z.ZodType<T>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ruta, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi("No hay conexión. Revisá internet y probá de nuevo.");
  }
  const datos: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`[api] ${ruta} ${res.status}`, datos);
    throw new ErrorApi(
      res.status === 502 ? "Me trabé pensando. Probá de nuevo." : "Algo salió mal. Probá de nuevo.",
    );
  }
  const r = esquema.safeParse(datos);
  if (!r.success) {
    console.error(`[api] ${ruta} respuesta inválida`, r.error);
    throw new ErrorApi("Algo salió mal. Probá de nuevo.");
  }
  return r.data;
}

const conEventos = <T extends z.ZodRawShape>(forma: T) =>
  z.object({ ...forma, eventos: z.array(Evento).default([]) });

const RespPedidos = conEventos({ pedidos: z.array(PedidoDeFoto) });
const RespCalidad = conEventos({ foto: Foto });
const RespChapa = conEventos({ ficha: Ficha });
const RespFicha = conEventos({ ficha: Ficha, listaParaPreparar: z.boolean() });
const RespEntender = conEventos({
  caso: Caso,
  /** Lo que contó la persona es de riesgo alto (gas, batería hinchada...): mostrar antes de seguir. */
  bloqueo: z.object({ clases: z.array(z.string()), derivacion: z.string().optional() }).optional(),
});
export type Bloqueo = NonNullable<z.infer<typeof RespEntender>["bloqueo"]>;

/** La IA saca el equipo y el síntoma del texto. Si no puede, viene clase "otro" y la persona elige. */
export async function entenderSintoma(texto: string): Promise<z.infer<typeof RespEntender>> {
  if (USAR_FIXTURE) {
    await esperar(600);
    return RespEntender.parse({
      caso: {
        id: crypto.randomUUID(),
        clase: "notebook",
        sintoma: texto.trim(),
        estado: "captura",
        creadoEn: new Date().toISOString(),
      },
    });
  }
  return llamar("/api/intake/entender", { texto }, RespEntender);
}

export async function pedidosDeFoto(caso: Caso): Promise<z.infer<typeof RespPedidos>> {
  if (USAR_FIXTURE) {
    await esperar(300);
    return RespPedidos.parse({
      pedidos: [
        {
          tipo: "frente",
          instruccion: "Sacale una foto de frente, con la tapa abierta.",
        },
        {
          tipo: "etiqueta",
          instruccion: "Dala vuelta y sacale una foto a la etiqueta de abajo. Que se lean las letras.",
          advertencia: "Apagala y desenchufala antes de darla vuelta.",
        },
        {
          tipo: "puertos",
          instruccion: "Ahora los costados, donde están los puertos.",
        },
      ],
    });
  }
  return llamar(
    "/api/intake/pedidos",
    { casoId: caso.id, clase: caso.clase, sintoma: caso.sintoma },
    RespPedidos,
  );
}

export async function evaluarFoto(
  casoId: string,
  tipo: PedidoDeFoto["tipo"],
  imagen: ImagenB64,
  intento: number,
): Promise<z.infer<typeof RespCalidad>> {
  if (USAR_FIXTURE) {
    // La primera foto de la etiqueta sale "movida", como en el fixture.
    await esperar(1600);
    const base = tipo === "etiqueta" && intento === 1 ? fotosEjemplo[0] : fotosEjemplo[1];
    return RespCalidad.parse({
      foto: {
        ...base,
        id: `foto-${tipo}-${intento}`,
        casoId,
        tipoPedido: tipo,
        url: `pendiente:${tipo}`,
      },
    });
  }
  return llamar("/api/intake/calidad", { casoId, tipoPedido: tipo, imagen }, RespCalidad);
}

export async function leerChapa(caso: Caso, imagenes: ImagenB64[]): Promise<z.infer<typeof RespChapa>> {
  if (imagenes.length === 0 && !USAR_FIXTURE) {
    // Sin foto de la etiqueta no hay nada que leer: la ficha sale vacía y la persona escribe el modelo.
    const nada = { valor: null, estado: "desconocido" as const };
    return RespChapa.parse({
      ficha: {
        casoId: caso.id,
        clase: caso.clase,
        marca: nada,
        modelo: nada,
        serie: nada,
        anio: nada,
        confirmadaPorUsuario: false,
      },
    });
  }
  if (USAR_FIXTURE) {
    await esperar(1800);
    return RespChapa.parse({
      ficha: { ...fichaEjemplo, casoId: caso.id, confirmadaPorUsuario: false },
    });
  }
  return llamar(
    "/api/intake/chapa",
    { casoId: caso.id, clase: caso.clase, imagenes: imagenes.slice(0, 3) },
    RespChapa,
  );
}

type NombreCampo = "marca" | "modelo" | "serie" | "anio";

/** La persona confirma la ficha: lo que miró queda confirmado, lo que corrigió también. */
export async function confirmarFicha(
  ficha: Ficha,
  confirmados: NombreCampo[],
  correcciones: Partial<Record<NombreCampo, string | null>>,
): Promise<z.infer<typeof RespFicha>> {
  if (USAR_FIXTURE) {
    await esperar(300);
    const nueva = { ...ficha, confirmadaPorUsuario: true };
    return RespFicha.parse({
      ficha: nueva,
      listaParaPreparar: !!ficha.modelo.valor,
    });
  }
  return llamar("/api/ficha", { ficha, confirmados, correcciones }, RespFicha);
}

const RespKnowledge = conEventos({
  pack: KnowledgePack,
  manualUrl: z.string().nullable(),
  manualFileId: z.string().nullable(),
  paginasVistaExplosionada: z.array(z.number()).default([]),
  desdeCache: z.boolean(),
});
export type Preparado = Omit<z.infer<typeof RespKnowledge>, "eventos">;

/** Una sola búsqueda por caso aunque la pantalla se monte dos veces: cada una cuesta ~1 USD. */
const preparando = new Map<string, Promise<z.infer<typeof RespKnowledge>>>();

/** Busca y lee el manual del modelo y arma la guía (carril A). Tarda de 30 s a 2 min. */
export function prepararExperto(ficha: Ficha, sintoma: string): Promise<z.infer<typeof RespKnowledge>> {
  const enCurso = preparando.get(ficha.casoId);
  if (enCurso) return enCurso;
  const p = llamar("/api/knowledge", { ficha, sintoma }, RespKnowledge);
  preparando.set(ficha.casoId, p);
  p.catch(() => preparando.delete(ficha.casoId)); // si falla, se puede reintentar
  return p;
}

const RespPlano = conEventos({
  plano: PlanoDePiezas,
  /** "ia" = piezas ubicadas con el manual; "plantilla" = modelo genérico de la clase. */
  origen: z.enum(["ia", "plantilla"]),
  avisos: z.array(z.string()).default([]),
});
export type Plano = Omit<z.infer<typeof RespPlano>, "eventos">;

const generando = new Map<string, Promise<z.infer<typeof RespPlano>>>();

/**
 * El cartógrafo ubica las piezas en el 3D leyendo la vista explosionada del manual (carril B).
 * Una vez por caso; puede tardar ~1 minuto. Sin manual, ubica con el texto de la guía.
 */
export function generarPlano(ficha: Ficha, preparado: Preparado): Promise<z.infer<typeof RespPlano>> {
  const casoId = ficha.casoId;
  const enCurso = generando.get(casoId);
  if (enCurso) return enCurso;
  const p = llamar(
    "/api/plano",
    {
      casoId,
      ficha,
      knowledgePack: preparado.pack,
      manualFileId: preparado.manualFileId,
      manualUrl: preparado.manualUrl,
      paginasVistaExplosionada: preparado.paginasVistaExplosionada,
    },
    RespPlano,
  );
  generando.set(casoId, p);
  p.catch(() => generando.delete(casoId));
  return p;
}
