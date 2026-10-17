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
  knowledgePackEjemplo,
  planoEjemplo,
} from "../../../shared";
import { mensajePausa } from "../../../lib/ia/pausa";
import type { ImagenB64 } from "./imagen";

/**
 * Fuente de datos de las pantallas: llama a `/api/intake/*`, `/api/ficha`, `/api/knowledge` (carril A) y `/api/plano` (carril B).
 * Con `NEXT_PUBLIC_DATOS=fixture` responde con los fixtures de `shared/` sin gastar IA
 * (sirve para trabajar sin claves y como plan B de la demo).
 */

export const USAR_FIXTURE = process.env.NEXT_PUBLIC_DATOS === "fixture";

/** Error que se le puede mostrar a la persona tal cual. */
export class ErrorApi extends Error {}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Las llamadas que cuestan IA se hacen una sola vez por clave mientras dure la sesión: si la
 * pantalla se monta dos veces, o la persona va atrás y adelante (incluso con la respuesta en
 * camino), se reusa la misma promesa. Si falla, se borra para poder reintentar.
 */
const yaPedidas = new Map<string, Promise<unknown>>();
function unaVez<T>(clave: string, pedir: () => Promise<T>): Promise<T> {
  const previa = yaPedidas.get(clave);
  if (previa) return previa as Promise<T>;
  const p = pedir();
  yaPedidas.set(clave, p);
  p.catch(() => yaPedidas.delete(clave));
  return p;
}

/** El equipo de la ficha: si la persona corrige marca o modelo, es otro equipo y sí se vuelve a pedir. */
const claveEquipo = (f: Ficha) => `${f.casoId}|${f.marca.valor ?? ""}|${f.modelo.valor ?? ""}`;

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
  const pausa = mensajePausa(res.status, datos);
  if (pausa) throw new ErrorApi(pausa); // freno de gasto: no es un error de la app
  if (!res.ok) {
    // Aviso y no error: es un fallo esperable que la pantalla ya muestra con "Probar de nuevo".
    console.warn(`[api] ${ruta} ${res.status}`, datos);
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
  /** El equipo en texto libre (ej. "heladera no frost"): se pasa a pedidos, chapa y al 3D. */
  tipoEquipo: z.string().optional(),
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
      tipoEquipo: "notebook",
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

export async function pedidosDeFoto(
  caso: Caso,
  tipoEquipo?: string | null,
): Promise<z.infer<typeof RespPedidos>> {
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
  const tipo = tipoEquipo?.trim() || undefined;
  return unaVez(`pedidos|${caso.id}|${caso.clase}|${tipo ?? ""}`, () =>
    llamar(
      "/api/intake/pedidos",
      { casoId: caso.id, clase: caso.clase, sintoma: caso.sintoma, tipoEquipo: tipo },
      RespPedidos,
    ),
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

/**
 * Lee la chapa. `imagenes`: fotos de la etiqueta; `imagenesFrente`: del frente del equipo, para
 * reconocerlo cuando la etiqueta no se lee (sale como "probable", fuente "foto": la persona confirma).
 */
export async function leerChapa(
  caso: Caso,
  imagenes: ImagenB64[],
  { tipoEquipo, imagenesFrente = [] }: { tipoEquipo?: string | null; imagenesFrente?: ImagenB64[] } = {},
): Promise<z.infer<typeof RespChapa>> {
  if (imagenes.length === 0 && imagenesFrente.length === 0 && !USAR_FIXTURE) {
    // Sin ninguna foto no hay nada que leer: la ficha sale vacía y la persona escribe el modelo.
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
  const etiqueta = imagenes.slice(0, 3);
  const frente = imagenesFrente.slice(0, 2);
  // Mismas fotos = misma lectura; si la persona saca otra, se lee de nuevo.
  const huella = [...etiqueta, ...frente].map((i) => `${i.base64.length}:${i.base64.slice(-24)}`).join(",");
  const tipo = tipoEquipo?.trim() || undefined;
  return unaVez(`chapa|${caso.id}|${tipo ?? ""}|${huella}`, () =>
    llamar(
      "/api/intake/chapa",
      { casoId: caso.id, clase: caso.clase, tipoEquipo: tipo, imagenes: etiqueta, imagenesFrente: frente },
      RespChapa,
    ),
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
  paginaVistaInterior: z.number().nullable().default(null),
  desdeCache: z.boolean(),
});
export type Preparado = Omit<z.infer<typeof RespKnowledge>, "eventos">;

/** Busca y lee el manual del modelo y arma la guía (carril A). Tarda de 30 s a 2 min y cuesta ~1 USD. */
export function prepararExperto(ficha: Ficha, sintoma: string): Promise<z.infer<typeof RespKnowledge>> {
  if (USAR_FIXTURE)
    return unaVez(`knowledge-fixture|${claveEquipo(ficha)}`, async () => {
      await esperar(2500);
      return RespKnowledge.parse({
        pack: knowledgePackEjemplo,
        manualUrl: null,
        manualFileId: null,
        paginasVistaExplosionada: [],
        desdeCache: true,
      });
    });
  return unaVez(`knowledge|${claveEquipo(ficha)}`, () =>
    llamar("/api/knowledge", { ficha, sintoma }, RespKnowledge),
  );
}

const RespPlano = conEventos({
  plano: PlanoDePiezas,
  /** "ia" = piezas ubicadas con el manual; "plantilla" = modelo genérico de la clase. */
  origen: z.enum(["ia", "plantilla"]),
  avisos: z.array(z.string()).default([]),
});
export type Plano = Omit<z.infer<typeof RespPlano>, "eventos">;

/**
 * El cartógrafo ubica las piezas en el 3D leyendo la vista explosionada del manual (carril B).
 * Una vez por caso; puede tardar ~1 minuto. Sin manual, ubica con el texto de la guía.
 */
export function generarPlano(
  ficha: Ficha,
  preparado: Preparado,
  /** Lo que dijo la recepción (ej. "heladera no frost"): elige la plantilla de respaldo por tipo. */
  tipoEquipo?: string | null,
): Promise<z.infer<typeof RespPlano>> {
  if (USAR_FIXTURE)
    return unaVez(`plano-fixture|${claveEquipo(ficha)}`, async () => {
      await esperar(1200);
      return RespPlano.parse({ plano: planoEjemplo, origen: "ia" });
    });
  return unaVez(`plano|${claveEquipo(ficha)}`, () =>
    llamar(
      "/api/plano",
      {
        casoId: ficha.casoId,
        ficha,
        knowledgePack: preparado.pack,
        tipoEquipo: tipoEquipo?.trim() || undefined,
        manualFileId: preparado.manualFileId,
        manualUrl: preparado.manualUrl,
        paginasVistaExplosionada: preparado.paginasVistaExplosionada,
        paginaVistaInterior: preparado.paginaVistaInterior,
      },
      RespPlano,
    ),
  );
}
