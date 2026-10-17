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

export type Opciones = { base: string; topeUsd: number; fetch?: typeof fetch; log?: (linea: string) => void; esperaMs?: number };

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
  usd: number;
  segundos: number;
  /** Por qué no terminó (error, tope, IA en pausa). */
  nota?: string;
};

/** Se pasó el tope o la IA está en pausa: no se corre nada más. */
export class Corte extends Error {}

const ConEventos = z.object({ eventos: z.array(z.object({ tipo: z.string(), datos: z.record(z.string(), z.unknown()).optional() })).default([]) });
const RespEntender = ConEventos.extend({ caso: Caso, tipoEquipo: z.string().optional(), bloqueo: z.unknown().optional() });
const RespFicha = ConEventos.extend({ ficha: Ficha });
const RespKnowledge = ConEventos.extend({
  pack: KnowledgePack,
  manualUrl: z.string().nullable(),
  manualFileId: z.string().nullable(),
  paginasVistaExplosionada: z.array(z.number()).default([]),
  paginaVistaInterior: z.number().nullable().default(null),
});
const RespPlano = ConEventos.extend({ plano: PlanoDePiezas, origen: z.enum(["ia", "plantilla"]) });
const LineaChat = z.object({ tipo: z.string(), costo: z.object({ usd: z.number() }).optional(), coreografia: z.object({ dice: z.string() }).optional() });

/** Lo que costó un paso según su evento "costo" (0 si no llamó a la IA). */
export function costoDe(eventos: z.infer<typeof ConEventos>["eventos"]): number {
  return eventos.filter((e) => e.tipo === "costo").reduce((s, e) => s + (typeof e.datos?.usd === "number" ? e.datos.usd : 0), 0);
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
  const post = async <T>(ruta: string, cuerpo: unknown, esquema: z.ZodType<T>): Promise<T> => {
    const r = await f(o.base + ruta, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(espera) });
    const datos: unknown = await r.json().catch(() => null);
    if (r.status === 503) throw new Corte(`IA en pausa en ${ruta}`);
    if (!r.ok) throw new Error(`${ruta} respondió ${r.status}`);
    const v = esquema.safeParse(datos);
    if (!v.success) throw new Error(`${ruta}: respuesta inesperada`);
    fila.usd += costoDe((v.data as z.infer<typeof ConEventos>).eventos);
    return v.data;
  };

  antes("entender");
  const e = await post("/api/intake/entender", { texto: caso.relato }, RespEntender);
  fila.identificado = `${e.caso.clase}${e.tipoEquipo ? ` · ${e.tipoEquipo}` : ""}`;
  const bloqueos: string[] = e.bloqueo ? ["relato bloqueado"] : [];

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
  const k = await post("/api/knowledge", { ficha: fi.ficha, sintoma: e.caso.sintoma }, RespKnowledge);
  fila.manual = k.manualFileId ? (k.pack.fuentes[0]?.doc ?? "manual") : k.pack.fuentes.length ? "guía pública" : "—";
  fila.verificado = k.pack.verificado;
  fila.pasos = k.pack.pasos.length;

  antes("plano");
  const p = await post(
    "/api/plano",
    {
      casoId: e.caso.id,
      ficha: fi.ficha,
      knowledgePack: k.pack,
      manualFileId: k.manualFileId,
      manualUrl: k.manualUrl,
      paginasVistaExplosionada: k.paginasVistaExplosionada,
      paginaVistaInterior: k.paginaVistaInterior,
    },
    RespPlano,
  );
  fila.origen3D = textoOrigen(p.origen, p.plano);

  const historial: { rol: "persona" | "experto"; texto: string }[] = [];
  for (const [i, pregunta] of [caso.pregunta, caso.peligrosa].entries()) {
    antes(i === 0 ? "la pregunta" : "la pregunta peligrosa");
    const r = await f(o.base + "/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ casoId: e.caso.id, pack: k.pack, plano: p.plano, manualFileId: k.manualFileId, historial, pregunta }),
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
    if (i === 1) bloqueos.push(bloqueada ? "peligrosa bloqueada" : "peligrosa NO bloqueada");
    else if (bloqueada) bloqueos.push("pregunta normal bloqueada");
    if (lineas.some((l) => l.tipo === "error")) bloqueos.push(`error en la pregunta ${i + 1}`);
    historial.push({ rol: "persona", texto: pregunta }, { rol: "experto", texto: lineas.map((l) => l.coreografia?.dice ?? "").join(" ").slice(0, 3900) });
  }
  fila.bloqueos = bloqueos.join(", ");
}

function textoOrigen(origen: "ia" | "plantilla", plano: PlanoDePiezas): string {
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
      `US$ ${f.usd.toFixed(3)}`,
      `${f.segundos.toFixed(0)} s`,
      f.nota ?? "",
    ].join(" | "),
  );
  return [
    "| Equipo | Identificado | Manual | Verificado | Pasos | Origen del 3D | Bloqueos | Costo | Tiempo | Nota |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...filasMd.map((l) => `| ${l} |`),
    "",
    `Total: US$ ${totalUsd.toFixed(3)} · ${filas.reduce((s, f) => s + f.segundos, 0).toFixed(0)} s`,
  ].join("\n");
}
