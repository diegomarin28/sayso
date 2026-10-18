import { z } from "zod";
import { Caso, Ficha, KnowledgePack, PlanoDePiezas } from "../../shared";
import type { CasoPrueba } from "./casos";

/**
 * Batería de pruebas contra la app corriendo (rutas reales, IA real: gasta saldo).
 * Por cada equipo: entender → ficha (la persona escribe marca y modelo) → knowledge → plano →
 * pregunta → pregunta peligrosa. El costo sale de los eventos "costo" que ya devuelven las rutas.
 * Corta antes del paso siguiente si el gasto acumulado pasa el tope: un paso ya empezado se
 * termina (puede pasarse por lo que cueste ese paso). Sin IA real en los tests: `fetch` inyectable.
 */

/** Lo mismo que recibe /api/plano: para correr el plano otra vez con cada modelo. */
export type EntradaPlano = {
  casoId: string;
  ficha: z.infer<typeof Ficha>;
  knowledgePack: z.infer<typeof KnowledgePack>;
  manualFileId: string | null;
  manualUrl: string | null;
  paginasVistaExplosionada: number[];
  paginaVistaInterior: number | null;
  tipoEquipo?: string;
};

export type CorridaPlano = { modelo: string; usd: number; segundos: number; origen3D: string };

/** Plano con Sonnet y con Haiku para el mismo equipo. `haiku: null` = no se comparó (ver `nota`). */
export type ComparacionPlano = {
  camino: string;
  sonnet: CorridaPlano;
  haiku: CorridaPlano | null;
  coincidencia: { puntos: number; max: number; porcentaje: number } | null;
  nota?: string;
};

export type Opciones = {
  base: string;
  topeUsd: number;
  fetch?: typeof fetch;
  log?: (linea: string) => void;
  esperaMs?: number;
  /** Si está, después del plano de la app se corre el plano con Sonnet y con Haiku (cuenta para el tope). */
  compararPlano?: (entrada: EntradaPlano) => Promise<ComparacionPlano>;
};

export type Fila = {
  id: string;
  equipo: string;
  modelo: string;
  /** Clase y tipo de equipo que entendió la recepción (ej. "otro · reloj inteligente"). */
  identificado: string;
  /** Título del manual, "guía pública" o "—". */
  manual: string;
  verificado: boolean | null;
  pasos: number | null;
  /** Ej. "ia · 4 manual, 3 estimada, 1 plantilla". */
  origen3D: string;
  /** Ej. "peligrosa bloqueada" o "peligrosa NO bloqueada". */
  bloqueos: string;
  /** Preguntas de procedimiento: cuántas respondieron con pasos (ej. "2/3 con pasos · NO: ¿Cómo abro…?"). */
  procedimientos?: string;
  /** Comparación del plano Sonnet vs Haiku (si se pidió). */
  planoComparado?: ComparacionPlano;
  usd: number;
  segundos: number;
  /** Por qué no terminó (error, tope, IA en pausa). */
  nota?: string;
};

/** Se pasó el tope o la IA está en pausa: no se corre nada más. */
export class Corte extends Error {}

export const ConEventos = z.object({ eventos: z.array(z.object({ tipo: z.string(), datos: z.record(z.string(), z.unknown()).optional() })).default([]) });
const RespEntender = ConEventos.extend({ caso: Caso, tipoEquipo: z.string().optional(), bloqueo: z.unknown().optional() });
const RespFicha = ConEventos.extend({ ficha: Ficha });
export const RespKnowledge = ConEventos.extend({
  pack: KnowledgePack,
  manualUrl: z.string().nullable(),
  manualFileId: z.string().nullable(),
  paginasVistaExplosionada: z.array(z.number()).default([]),
  paginaVistaInterior: z.number().nullable().default(null),
  desdeCache: z.boolean().optional(),
});
export const RespPlano = ConEventos.extend({ plano: PlanoDePiezas, origen: z.enum(["ia", "plantilla"]), desdeCache: z.boolean().optional() });
const LineaChat = z.object({ tipo: z.string(), costo: z.object({ usd: z.number() }).optional(), coreografia: z.object({ dice: z.string() }).optional() });

/** Una frase que manda a otro lado en vez de responder ("consultá el manual", "llevalo al servicio técnico"). */
const DERIVA = /consult[aá]|support\.|servicio t[eé]cnico|t[eé]cnico (autorizado|especializado)|llev[aá]lo a/i;
/** Los avisos del experto sobre la fuente ("El manual oficial no incluye…") no son pasos. */
const AVISO_FUENTE = /^(el manual oficial no incluye|no tengo el manual oficial|tampoco encontr)/i;
/** Desde cuántas frases con acciones una respuesta cuenta como "trae pasos". */
export const MIN_PASOS_PROCEDIMIENTO = 3;

/** ¿La respuesta trae pasos y no se limita a mandar al manual? */
export function evaluarProcedimiento(dichos: string[]): { pasos: number; ok: boolean } {
  const pasos = dichos.filter((d) => !DERIVA.test(d) && !AVISO_FUENTE.test(d.trim())).length;
  return { pasos, ok: pasos >= MIN_PASOS_PROCEDIMIENTO };
}

/** Lo que costó un paso según su evento "costo" (0 si no llamó a la IA). */
export function costoDe(eventos: z.infer<typeof ConEventos>["eventos"]): number {
  return eventos.filter((e) => e.tipo === "costo").reduce((s, e) => s + (typeof e.datos?.usd === "number" ? e.datos.usd : 0), 0);
}

/** POST a una ruta de la app: valida la respuesta y devuelve lo que costó (eventos "costo"). 503 = IA en pausa: corta. */
export async function postJson<T extends z.infer<typeof ConEventos>>(
  o: Pick<Opciones, "base" | "fetch" | "esperaMs">,
  ruta: string,
  cuerpo: unknown,
  esquema: z.ZodType<T>,
): Promise<{ datos: T; usd: number }> {
  const r = await (o.fetch ?? fetch)(o.base + ruta, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(o.esperaMs ?? 300_000),
  });
  const datos: unknown = await r.json().catch(() => null);
  if (r.status === 503) throw new Corte(`IA en pausa en ${ruta}`);
  if (!r.ok) throw new Error(`${ruta} respondió ${r.status}`);
  const v = esquema.safeParse(datos);
  if (!v.success) throw new Error(`${ruta}: respuesta inesperada`);
  return { datos: v.data, usd: costoDe(v.data.eventos) };
}

export async function correrBateria(casos: CasoPrueba[], o: Opciones): Promise<{ filas: Fila[]; totalUsd: number; cortado: boolean }> {
  const filas: Fila[] = [];
  let totalUsd = 0;
  let cortado = false;
  for (const caso of casos) {
    if (cortado) {
      filas.push(filaVacia(caso, "no corrido (se cortó antes)"));
      continue;
    }
    const fila = filaVacia(caso);
    const t0 = Date.now();
    try {
      await correrCaso(caso, fila, o, () => totalUsd + fila.usd);
    } catch (e) {
      if (e instanceof Corte) cortado = true;
      fila.nota = (e as Error).message;
    }
    fila.segundos = (Date.now() - t0) / 1000;
    totalUsd += fila.usd;
    filas.push(fila);
    o.log?.(`${caso.equipo}: US$ ${fila.usd.toFixed(3)} · ${fila.segundos.toFixed(0)} s${fila.nota ? ` · ${fila.nota}` : ""} (acumulado US$ ${totalUsd.toFixed(3)})`);
  }
  return { filas, totalUsd, cortado };
}

function filaVacia(caso: CasoPrueba, nota?: string): Fila {
  return {
    id: caso.id,
    equipo: caso.equipo,
    modelo: `${caso.marca} ${caso.modelo}`,
    identificado: "—",
    manual: "—",
    verificado: null,
    pasos: null,
    origen3D: "—",
    bloqueos: "—",
    usd: 0,
    segundos: 0,
    ...(nota ? { nota } : {}),
  };
}

async function correrCaso(caso: CasoPrueba, fila: Fila, o: Opciones, gastado: () => number): Promise<void> {
  const f = o.fetch ?? fetch;
  const espera = o.esperaMs ?? 300_000;
  const antes = (paso: string) => {
    if (gastado() > o.topeUsd) throw new Corte(`corte antes de ${paso}: US$ ${gastado().toFixed(3)} > tope US$ ${o.topeUsd}`);
  };
  const post = async <T extends z.infer<typeof ConEventos>>(ruta: string, cuerpo: unknown, esquema: z.ZodType<T>): Promise<T> => {
    const { datos, usd } = await postJson(o, ruta, cuerpo, esquema);
    fila.usd += usd;
    return datos;
  };

  antes("entender");
  const e = await post("/api/intake/entender", { texto: caso.relato }, RespEntender);
  fila.identificado = `${e.caso.clase}${e.tipoEquipo ? ` · ${e.tipoEquipo}` : ""}`;
  const bloqueos: string[] = e.bloqueo ? ["relato bloqueado"] : [];
  // Como la app: el tipo de equipo de la recepción va a knowledge, plano y chat (plantilla y avisos por tipo).
  const tipoEquipo = e.tipoEquipo?.trim() || undefined;

  // La chapa no se lee en la batería: la persona escribe marca y modelo (sin IA).
  const nada = { valor: null, estado: "desconocido" as const };
  const fi = await post(
    "/api/ficha",
    {
      ficha: { casoId: e.caso.id, clase: e.caso.clase, marca: nada, modelo: nada, serie: nada, anio: nada, confirmadaPorUsuario: false },
      correcciones: { marca: caso.marca, modelo: caso.modelo },
    },
    RespFicha,
  );

  antes("knowledge");
  const k = await post("/api/knowledge", { ficha: fi.ficha, sintoma: e.caso.sintoma, tipoEquipo }, RespKnowledge);
  fila.manual = k.manualFileId ? (k.pack.fuentes[0]?.doc ?? "manual") : k.pack.fuentes.length ? "guía pública" : "—";
  fila.verificado = k.pack.verificado;
  fila.pasos = k.pack.pasos.length;

  antes("plano");
  const entradaPlano: EntradaPlano = {
    casoId: e.caso.id,
    ficha: fi.ficha,
    knowledgePack: k.pack,
    manualFileId: k.manualFileId,
    manualUrl: k.manualUrl,
    paginasVistaExplosionada: k.paginasVistaExplosionada,
    paginaVistaInterior: k.paginaVistaInterior,
    tipoEquipo,
  };
  const p = await post("/api/plano", entradaPlano, RespPlano);
  fila.origen3D = textoOrigen(p.origen, p.plano);

  if (o.compararPlano) {
    antes("la comparación del plano");
    try {
      fila.planoComparado = await o.compararPlano(entradaPlano);
      fila.usd += fila.planoComparado.sonnet.usd + (fila.planoComparado.haiku?.usd ?? 0);
    } catch (err) {
      // El freno de gasto también vale acá; otro error no corta el caso (siguen las preguntas).
      if ((err as Error).name === "IAEnPausa") throw new Corte("IA en pausa en la comparación del plano");
      fila.nota = `comparación del plano: ${(err as Error).message}`;
    }
  }

  const historial: { rol: "persona" | "experto"; texto: string }[] = [];
  const preguntas = [
    { pregunta: caso.pregunta, tipo: "normal" as const },
    ...(caso.procedimientos ?? []).map((pregunta) => ({ pregunta, tipo: "procedimiento" as const })),
    { pregunta: caso.peligrosa, tipo: "peligrosa" as const },
  ];
  const sinPasos: string[] = [];
  for (const [i, { pregunta, tipo }] of preguntas.entries()) {
    antes(tipo === "peligrosa" ? "la pregunta peligrosa" : `la pregunta ${i + 1}`);
    const r = await f(o.base + "/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ casoId: e.caso.id, pack: k.pack, plano: p.plano, manualFileId: k.manualFileId, historial, pregunta, tipoEquipo }),
      signal: AbortSignal.timeout(espera),
    });
    if (r.status === 503) throw new Corte("IA en pausa en /api/chat");
    if (!r.ok) throw new Error(`/api/chat respondió ${r.status}`);
    const lineas = (await r.text())
      .split("\n")
      .filter(Boolean)
      .map((l) => LineaChat.safeParse(JSON.parse(l)))
      .flatMap((l) => (l.success ? [l.data] : []));
    fila.usd += lineas.find((l) => l.tipo === "fin")?.costo?.usd ?? 0;
    const bloqueada = lineas.some((l) => l.tipo === "bloqueo");
    if (tipo === "peligrosa") bloqueos.push(bloqueada ? "peligrosa bloqueada" : "peligrosa NO bloqueada");
    else if (bloqueada) bloqueos.push(`pregunta ${tipo} bloqueada`);
    if (lineas.some((l) => l.tipo === "error")) bloqueos.push(`error en la pregunta ${i + 1}`);
    const dichos = lineas.flatMap((l) => (l.tipo === "paso" && l.coreografia ? [l.coreografia.dice] : []));
    if (tipo === "procedimiento" && !evaluarProcedimiento(dichos).ok) sinPasos.push(pregunta);
    historial.push({ rol: "persona", texto: pregunta }, { rol: "experto", texto: dichos.join(" ").slice(0, 3900) });
  }
  fila.bloqueos = bloqueos.join(", ");
  const total = caso.procedimientos?.length ?? 0;
  if (total) fila.procedimientos = `${total - sinPasos.length}/${total} con pasos${sinPasos.length ? ` · NO: ${sinPasos.join(" ")}` : ""}`;
}

export function textoOrigen(origen: "ia" | "plantilla", plano: PlanoDePiezas): string {
  const cuenta = new Map<string, number>();
  for (const p of plano.piezas) cuenta.set(p.origen ?? "sin dato", (cuenta.get(p.origen ?? "sin dato") ?? 0) + 1);
  return `${origen} · ${[...cuenta].map(([k, n]) => `${n} ${k}`).join(", ")}`;
}

/** Tabla en Markdown para pegar en el grupo o en un PR. */
export function tabla(filas: Fila[], totalUsd: number): string {
  const sino = (v: boolean | null) => (v === null ? "—" : v ? "sí" : "no");
  const filasMd = filas.map((f) =>
    [
      `${f.equipo} (${f.modelo})`,
      f.identificado,
      f.manual,
      sino(f.verificado),
      f.pasos ?? "—",
      f.origen3D,
      f.bloqueos || "—",
      f.procedimientos ?? "—",
      `US$ ${f.usd.toFixed(3)}`,
      `${f.segundos.toFixed(0)} s`,
      f.nota ?? "",
    ].join(" | "),
  );
  return [
    "| Equipo | Identificado | Manual | Verificado | Pasos | Origen del 3D | Bloqueos | Procedimientos | Costo | Tiempo | Nota |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...filasMd.map((l) => `| ${l} |`),
    "",
    `Total: US$ ${totalUsd.toFixed(3)} · ${filas.reduce((s, f) => s + f.segundos, 0).toFixed(0)} s`,
  ].join("\n");
}

/** Segunda tabla: el plano 3D con Sonnet y con Haiku para los mismos equipos. */
export function tablaPlano(filas: Fila[]): string {
  const corrida = (c: CorridaPlano | null) => (c ? `US$ ${c.usd.toFixed(4)} · ${c.segundos.toFixed(0)} s · ${c.origen3D}` : "—");
  const con = filas.filter((f) => f.planoComparado);
  const comparados = con.filter((f) => f.planoComparado!.coincidencia);
  const suma = (k: "sonnet" | "haiku") => con.reduce((s, f) => s + (f.planoComparado![k]?.usd ?? 0), 0);
  const media = comparados.length
    ? Math.round(comparados.reduce((s, f) => s + f.planoComparado!.coincidencia!.porcentaje, 0) / comparados.length)
    : null;
  return [
    "| Equipo | Camino | Sonnet | Haiku | Coincidencia Haiku vs Sonnet | Nota |",
    "|---|---|---|---|---|---|",
    ...con.map((f) => {
      const c = f.planoComparado!;
      const coin = c.coincidencia ? `${c.coincidencia.puntos}/${c.coincidencia.max} (${c.coincidencia.porcentaje} %)` : "—";
      return `| ${f.equipo} | ${c.camino} | ${corrida(c.sonnet)} | ${corrida(c.haiku)} | ${coin} | ${c.nota ?? ""} |`;
    }),
    "",
    `Plano: Sonnet US$ ${suma("sonnet").toFixed(4)} · Haiku US$ ${suma("haiku").toFixed(4)}` +
      (media === null ? "" : ` · coincidencia media ${media} % en ${comparados.length} equipos`) +
      ". Coincidencia = cuánto ubican igual (escala 0–2 por pieza), no cuál acierta.",
  ].join("\n");
}
