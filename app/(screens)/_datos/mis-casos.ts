import { z } from "zod";
import { Caso, Ficha, KnowledgePack, PlanoDePiezas } from "../../../shared";

/**
 * "Mis casos": los casos de este dispositivo, guardados en el propio celular (localStorage) con
 * un id anónimo, sin login ni datos personales. Retomar un caso usa lo guardado: no gasta IA.
 * Si el navegador no deja guardar (modo privado, almacenamiento lleno), la app sigue igual.
 */

const CLAVE_CASOS = "sayso:mis-casos:v1";
const CLAVE_DISPOSITIVO = "sayso:dispositivo";
const MAX_CASOS = 30;

export const EstadoCierre = z.enum(["resuelto", "esperando_repuesto", "derivado"]);
export type EstadoCierre = z.infer<typeof EstadoCierre>;

export const Cierre = z.object({
  estado: EstadoCierre,
  /** Pieza que se pidió (id del pack), solo para "esperando_repuesto". */
  pieza: z.string().optional(),
  /** Publicación donde se compró (la abrió la persona desde "Repuestos"). */
  compraUrl: z.string().url().optional(),
  ts: z.string(),
});
export type Cierre = z.infer<typeof Cierre>;

const Guia = z.object({
  preparado: z.object({
    pack: KnowledgePack,
    manualUrl: z.string().nullable(),
    manualFileId: z.string().nullable(),
    paginasVistaExplosionada: z.array(z.number()).default([]),
    paginaVistaInterior: z.number().nullable().default(null),
    /** Página del manual → URL del PNG (vista interior y páginas citadas; nunca fotos de la persona). */
    imagenesPaginas: z.record(z.string(), z.string()).default({}),
    fotosPasos: z.record(z.string(), z.string()).default({}),
    vistaInterior: z
      .object({ url: z.string(), pagina: z.number(), estado: z.enum(["VERIFICADO", "NO_VERIFICADO"]) })
      .nullable()
      .default(null),
    desdeCache: z.boolean(),
  }),
  plano: z.object({
    plano: PlanoDePiezas,
    origen: z.enum(["ia", "plantilla"]),
    avisos: z.array(z.string()).default([]),
  }),
});

export const CasoGuardado = z.object({
  caso: Caso,
  tipoEquipo: z.string().nullable().default(null),
  ficha: Ficha.nullable().default(null),
  guia: Guia.nullable().default(null),
  cierre: Cierre.nullable().default(null),
  actualizadoEn: z.string(),
});
export type CasoGuardado = z.infer<typeof CasoGuardado>;
export type GuiaGuardada = z.infer<typeof Guia>;

let memoria: CasoGuardado[] = []; // si localStorage no está disponible
let idEnMemoria: string | null = null;

function leerTodos(): CasoGuardado[] {
  try {
    const crudo = JSON.parse(localStorage.getItem(CLAVE_CASOS) ?? "[]");
    if (!Array.isArray(crudo)) return memoria;
    // Lo que no valida (por ejemplo, de una versión vieja) se descarta en vez de romper la lista.
    return crudo.map((c) => CasoGuardado.safeParse(c)).flatMap((r) => (r.success ? [r.data] : []));
  } catch {
    return memoria;
  }
}

function escribirTodos(casos: CasoGuardado[]) {
  const recortados = [...casos]
    .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn))
    .slice(0, MAX_CASOS);
  memoria = recortados;
  try {
    localStorage.setItem(CLAVE_CASOS, JSON.stringify(recortados));
  } catch {
    // modo privado o lleno: queda en memoria mientras dure la pestaña
  }
}

/** Id anónimo de este dispositivo (no identifica a la persona; solo agrupa sus casos). */
export function idDispositivo(): string {
  try {
    let id = localStorage.getItem(CLAVE_DISPOSITIVO);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLAVE_DISPOSITIVO, id);
    }
    return id;
  } catch {
    return (idEnMemoria ??= crypto.randomUUID());
  }
}

/** Texto crudo guardado: sirve como "versión" para leerlo con useSyncExternalStore sin desajustes. */
export function firmaCasos(): string {
  try {
    return localStorage.getItem(CLAVE_CASOS) ?? "[]";
  } catch {
    return JSON.stringify(memoria);
  }
}

/** Los casos de este dispositivo, el más reciente primero. */
export function listarCasos(): CasoGuardado[] {
  return leerTodos().sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
}

export function leerCaso(id: string): CasoGuardado | null {
  return leerTodos().find((c) => c.caso.id === id) ?? null;
}

type Cambio = Partial<Omit<CasoGuardado, "caso" | "actualizadoEn">> & { caso: Caso };

/** Crea o actualiza un caso (se mezcla con lo ya guardado). */
export function guardarLocal(cambio: Cambio) {
  const todos = leerTodos();
  const previo = todos.find((c) => c.caso.id === cambio.caso.id);
  const r = CasoGuardado.safeParse({ ...previo, ...cambio, actualizadoEn: new Date().toISOString() });
  if (!r.success) {
    console.warn("[mis-casos] no se guardó: no valida", r.error.issues[0]);
    return;
  }
  escribirTodos([r.data, ...todos.filter((c) => c.caso.id !== cambio.caso.id)]);
}

export const TEXTO_ESTADO: Record<EstadoCierre | "en_curso", string> = {
  resuelto: "Resuelto",
  esperando_repuesto: "Esperando repuesto",
  derivado: "Derivado a técnico",
  en_curso: "En curso",
};
