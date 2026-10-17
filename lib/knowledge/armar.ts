import type Anthropic from "@anthropic-ai/sdk";
import { KnowledgePack, type Evento, type Ficha } from "../../shared";
import { planoNotebookBase } from "../planogenerator/plantillas/notebook";
import { tiposParaPrompt } from "../planogenerator/tipos";
import { enviarMensaje, ErrorIA, LIMITES, subirArchivo, type EnviarMensaje, type LlamarIA, type SubirArchivo, MODELO_DE, herramientasWeb } from "../ia/claude";
import { IAEnPausa } from "../ia/freno";
import { normalizar } from "../intake/chapa";
import { evento } from "../intake/entrada";
import { buscarManual, type ManualEncontrado } from "./buscar";
import { descargarPdf, type Fetch } from "./descargar";
import { nombreExtracto, paginaEnExtracto, paginaOriginal, prepararExtracto, type Extracto } from "./extracto";
import { imagenesDePaginas, type SubirPng, type VistaInteriorImagen } from "./imagen";
import { leerManual, SYSTEM_LECTOR, type Lectura } from "./lector";
import { lineasConCitas, parsearContenido, type ClaseVista, type Contenido, type Vistas } from "./lineas";
import { columnasVistas, repoManuales, vistasDe, type RepoManuales } from "./manuales";
import { combinar, instruccionesVistas, SIN_VISTAS } from "./vistas";

/**
 * Armado del knowledge pack: buscar manual → extracto con las páginas que importan → leerlo con citas → validar.
 * A la IA nunca se le manda el PDF entero (ver extracto.ts). En la misma lectura se ubican las vistas
 * para el cartógrafo (/api/plano). Todas las páginas que salen de acá son del manual COMPLETO.
 * El pack se arma una vez por modelo + síntoma; el manual y sus vistas, una vez por modelo.
 */

/**
 * El manual elegido. `fileId` es el EXTRACTO subido a la Files API (A4 y /api/plano lo leen con caché de prompt);
 * `paginas`: qué páginas del manual completo tiene el extracto, en orden.
 */
export type Manual = { url: string; fileId: string; bytes: number; titulo: string; fuente: ManualEncontrado["fuente"]; paginas: number[] };

/** `vistas`: páginas físicas del PDF con la vista explosionada y una vista interior (para /api/plano). */
/** `vistaInterior`: PNG de la página interior del manual (referencia real al lado del 3D), o null. */
/** `imagenesPaginas`: { página del manual: URL del PNG } (vista interior y páginas citadas). */
export type Armado = {
  pack: KnowledgePack;
  manual: Manual | null;
  vistas: Vistas;
  vistaInterior?: VistaInteriorImagen | null;
  imagenesPaginas?: Record<number, string>;
};

/** Caché de packs. En la ruta se usa la de Supabase (`cachePacksSupabase`); acá, memoria por defecto. */
export interface CachePacks {
  get(clave: string): Promise<Armado | undefined>;
  set(clave: string, valor: Armado): Promise<void>;
}
const memoria = new Map<string, Armado>();
export const cacheEnMemoria: CachePacks = {
  get: async (k) => memoria.get(k),
  set: async (k, v) => void memoria.set(k, v),
};

export function claveCache(ficha: Ficha, sintoma: string): string {
  return [ficha.marca.valor ?? "", ficha.modelo.valor ?? "", sintoma].map(normalizar).join("|");
}

const IDS_PLANTILLA = planoNotebookBase.piezas.map((p) => p.pieza);

function tareaPack(equipo: string, sintoma: string, conManual: boolean, vistas: ClaseVista[]): string {
  const fuente = conManual ? "el manual" : "las fuentes";
  return `Prepará una guía de reparación casera a partir de ${
    conManual ? "el manual de servicio adjunto" : "fuentes públicas de la web (buscá con la herramienta)"
  }.
Escribí SOLO líneas con este formato exacto, una por renglón, sin títulos ni markdown:
PIEZA|id|nombre|ubicación en palabras (relativa a otras piezas)|número en la vista explosionada (o vacío)
PASO|orden|instrucción corta para una persona sin experiencia|ids de piezas separados por coma|riesgo (bajo, medio o alto)
REPUESTO|id de pieza|número de parte tal cual figura en ${fuente}
ADVERTENCIA|texto
${vistas.length ? `${instruccionesVistas(vistas)}\n` : ""}Reglas:
- Ids de pieza en minúsculas con guion bajo, que EMPIECEN con el tipo de pieza (así el 3D sabe dibujarla), por ejemplo ventilador_evaporador o carcasa_heladera. En una notebook, si la pieza coincide, usá estos ids tal cual: ${IDS_PLANTILLA.join(", ")}.
- Tipos de pieza que el 3D sabe dibujar:
${tiposParaPrompt()}
- Incluí las piezas que se mencionan en los pasos, y los pasos para diagnosticar o resolver el síntoma (máximo ${LIMITES.pack.maxPasos}).
- Cada PIEZA, PASO y REPUESTO tiene que salir de ${conManual ? "una página del manual" : "una fuente"}: citala.
- NUNCA inventes números de parte, piezas ni pasos que no estén en ${fuente}.
- Si un paso implica gas refrigerante, 220 V, capacitores, abrir la fuente o una batería dañada, marcalo riesgo alto. Desconectar el cable de una batería sana o sacarla como indica el manual es riesgo medio.

<equipo>${equipo}</equipo>
<sintoma>${sintoma}</sintoma>`;
}

/** Guía pública (sin manual): búsqueda web. Sigue si la búsqueda queda a mitad de camino (`pause_turn`). */
async function guiaPublica(equipo: string, sintoma: string, enviar: EnviarMensaje): Promise<Lectura> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: tareaPack(equipo, sintoma, false, []) }];
  const bloques: Anthropic.TextBlock[] = [];
  let motivo: string | null = null;
  for (let i = 0; i <= LIMITES.guiaPublica.continuaciones; i++) {
    const r = await enviar(
      {
        model: MODELO_DE.guiaPublica,
        max_tokens: LIMITES.lectura.maxTokensPack,
        output_config: { effort: LIMITES.lectura.effort },
        system: SYSTEM_LECTOR,
        tools: herramientasWeb(MODELO_DE.guiaPublica, { busquedas: LIMITES.guiaPublica.busquedas }),
        messages,
      },
      "bibliotecario: guía pública",
    );
    bloques.push(...r.content.filter((b): b is Anthropic.TextBlock => b.type === "text"));
    motivo = r.stop_reason;
    if (r.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: r.content });
  }
  return { bloques, motivo };
}

/** Datos para entender por qué una lectura no dio pasos, sin volver a pagarla. */
function diagnostico(l: Lectura, c: Contenido) {
  return {
    motivo: l.motivo,
    lineas: lineasConCitas(l.bloques).length,
    caracteres: l.bloques.reduce((n, b) => n + b.text.length, 0),
    descartadas: c.descartadas.slice(0, 5),
    inicio: l.bloques.map((b) => b.text).join("").slice(0, 300),
  };
}

function mensajeVistas(v: Vistas): string {
  const exp = v.explosionada ? `la vista explosionada (p. ${v.explosionada})` : null;
  const int = v.interior ? `una vista del interior (p. ${v.interior})` : null;
  if (exp && int) return `Ubiqué en el manual ${exp} y ${int}.`;
  if (exp || int) return `Ubiqué en el manual ${exp ?? int}; no encontré ${exp ? "una vista del interior" : "la vista explosionada"}.`;
  return "No encontré en el manual la vista explosionada ni una vista del interior.";
}

export type Deps = {
  enviar?: EnviarMensaje;
  /** Llamadas cortas (elegir páginas del extracto). */
  llamar?: LlamarIA;
  subir?: SubirArchivo;
  /** Sube el PNG de la vista interior (Supabase Storage). */
  subirPng?: SubirPng;
  fetch?: Fetch;
  cache?: CachePacks;
  manuales?: RepoManuales;
};

/** Pasa las páginas citadas del extracto a las del manual completo. */
function aPaginasDelManual(c: Contenido, paginas: number[]): Contenido {
  const pag = (n: number | undefined) => (n === undefined ? undefined : paginaOriginal(paginas, n));
  const vista = (n: number | null) => (n === null ? null : paginaOriginal(paginas, n));
  return {
    ...c,
    pasos: c.pasos.map((p) => (p.cita?.pagina ? { ...p, cita: { ...p.cita, pagina: pag(p.cita.pagina) } } : p)),
    repuestos: c.repuestos.map((r) => (r.cita.pagina ? { ...r, cita: { ...r.cita, pagina: pag(r.cita.pagina) } } : r)),
    vistas: { explosionada: vista(c.vistas.explosionada), interior: vista(c.vistas.interior) },
  };
}

export async function armarKnowledgePack(
  /** `tipoEquipo`: el de /api/intake/entender (ej. "celular", "heladera no frost"); ayuda con equipos fuera de las clases fijas. */
  entrada: { ficha: Ficha; sintoma: string; tipoEquipo?: string },
  deps: Deps = {},
): Promise<Armado & { eventos: Evento[]; desdeCache: boolean }> {
  const { ficha, sintoma, tipoEquipo } = entrada;
  const enviar = deps.enviar ?? enviarMensaje;
  const cache = deps.cache ?? cacheEnMemoria;
  const casoId = ficha.casoId;
  const modelo = ficha.modelo.valor;
  if (!modelo || ficha.modelo.estado !== "confirmado") throw new ErrorIA("El modelo no está confirmado");

  const clave = claveCache(ficha, sintoma);
  const guardado = await cache.get(clave);
  if (guardado) {
    return {
      ...guardado,
      vistas: guardado.vistas ?? SIN_VISTAS,
      vistaInterior: guardado.vistaInterior ?? null,
      imagenesPaginas: guardado.imagenesPaginas ?? {},
      desdeCache: true,
      eventos: [evento(casoId, "bibliotecario", "pack_en_cache", "Ya tenía la guía de este modelo.")],
    };
  }

  const eventos: Evento[] = [];
  /** Si algo falló (API, red, PDF), el resultado NO se guarda en la caché: se vuelve a intentar la próxima vez. */
  let huboFalla = false;
  let vistaInterior: VistaInteriorImagen | null = null;
  let imagenesPaginas: Record<number, string> = {};
  const nombreEquipo = `${ficha.marca.valor ?? ""} ${modelo}`.trim();
  /** Para la IA: marca y modelo más el tipo de equipo, si se sabe. */
  const equipoDescrito = tipoEquipo ? `${nombreEquipo} (${tipoEquipo})` : nombreEquipo;
  eventos.push(evento(casoId, "bibliotecario", "manual_buscando", `Busco el manual de servicio de ${nombreEquipo}.`));

  // 1. Caché de manuales (Supabase): si ya lo encontramos y verificamos antes, se reusa con sus vistas.
  const repo = deps.manuales ?? repoManuales();
  let encontrado: ManualEncontrado | null = null;
  let vistas: Vistas = SIN_VISTAS;
  const registro = await repo.buscar(ficha.marca.valor, modelo);
  if (registro?.verificado) {
    const pdf = await descargarPdf(registro.url, deps.fetch);
    if (pdf) {
      encontrado = { url: registro.url, titulo: registro.titulo, fuente: registro.fuente, pdf };
      vistas = vistasDe(registro);
      eventos.push(evento(casoId, "bibliotecario", "manual_en_cache", `Ya conocía el manual: ${registro.titulo}.`, { url: registro.url }));
    }
  }
  const manualDeCache = encontrado !== null;
  // 2. Si no, el bibliotecario lo busca (agente con búsqueda web + probar_pdf).
  encontrado ??= await buscarManual({ marca: ficha.marca.valor, modelo, clase: tipoEquipo ?? ficha.clase }, { enviar, fetch: deps.fetch });

  // 3. Extracto: solo las páginas que importan. Si no se puede armar, no se manda el PDF entero: guía pública.
  let manual: Manual | null = null;
  let extracto: Extracto | null = null;
  if (encontrado) {
    try {
      const fijas = [vistas.explosionada, vistas.interior].filter((n): n is number => n !== null);
      extracto = await prepararExtracto(new Uint8Array(encontrado.pdf.datos), equipoDescrito, sintoma, fijas, deps.llamar);
      const datos = Buffer.from(extracto.datos);
      const fileId = await (deps.subir ?? subirArchivo)(datos, nombreExtracto(extracto.paginas));
      manual = { url: encontrado.url, fileId, bytes: datos.length, titulo: encontrado.titulo, fuente: encontrado.fuente, paginas: extracto.paginas };
      eventos.push(
        evento(casoId, "bibliotecario", "extracto_armado", `Elegí ${extracto.paginas.length} páginas del manual para leer (no el manual entero).`, {
          paginas: extracto.paginas,
        }),
      );
    } catch (e) {
      if (e instanceof IAEnPausa) throw e; // el freno de gasto no es una falla del manual: la ruta responde "IA en pausa"
      huboFalla = true;
      console.error("[knowledge] no pude armar el extracto del manual:", (e as Error).message);
    }
  }
  eventos.push(
    manual
      ? evento(casoId, "bibliotecario", "manual_encontrado", `Tengo el manual: ${manual.titulo}.`, { url: manual.url })
      : evento(casoId, "bibliotecario", "manual_no_encontrado", "No encontré el manual oficial; uso guías públicas (NO VERIFICADO)."),
  );

  // 3. Lectura del pack. Las vistas que faltan se piden en la misma lectura (sin llamada extra).
  //    Nunca se reintenta la misma lectura: si el manual no da pasos, se cae en la guía pública.
  let lectura: Lectura | null = null;
  let contenido: Contenido | null = null;
  if (manual) {
    try {
      lectura = await leerManual(manual, tareaPack(equipoDescrito, sintoma, true, ["explosionada", "interior"]), LIMITES.lectura.maxTokensPack, enviar, "bibliotecario: leer manual");
      contenido = aPaginasDelManual(parsearContenido(lineasConCitas(lectura.bloques), manual.titulo), manual.paginas);
    } catch (e) {
      if (e instanceof IAEnPausa) throw e; // el freno de gasto no es una falla del manual: la ruta responde "IA en pausa"
      huboFalla = true;
      console.error("[knowledge] falló la lectura del manual:", (e as Error).message);
    }
    if (!contenido || contenido.pasos.length === 0) {
      eventos.push(
        evento(casoId, "bibliotecario", "lectura_sin_pasos", "El manual no me dio pasos que pueda usar; armo una guía pública (NO VERIFICADO).", {
          ...(lectura && contenido ? diagnostico(lectura, contenido) : { error: true }),
        }),
      );
      console.warn("[knowledge] lectura sin pasos:", JSON.stringify(lectura && contenido ? diagnostico(lectura, contenido) : { error: true }));
    }
  }
  const conManual = manual !== null && contenido !== null && contenido.pasos.length > 0;
  if (!conManual) {
    try {
      lectura = await guiaPublica(equipoDescrito, sintoma, enviar);
      contenido = parsearContenido(lineasConCitas(lectura.bloques), "Fuente pública");
    } catch (e) {
      if (e instanceof IAEnPausa) throw e; // el freno de gasto no es una falla del manual: la ruta responde "IA en pausa"
      huboFalla = true;
      console.error("[knowledge] falló la guía pública:", (e as Error).message);
      lectura = { bloques: [], motivo: null };
      contenido = parsearContenido([], "Fuente pública");
    }
  }
  if (!contenido || !lectura) throw new Error("inalcanzable");
  // Las páginas solo tienen sentido con lo que se leyó del PDF del manual.
  // Si la lectura no marcó alguna vista, queda la que eligió el bibliotecario al armar el extracto.
  const elegidas: Vistas = {
    explosionada: extracto?.seleccion?.explosionada.find((n) => manual?.paginas.includes(n)) ?? null,
    interior: extracto?.seleccion?.interior.find((n) => manual?.paginas.includes(n)) ?? null,
  };
  vistas = conManual ? combinar(combinar(vistas, contenido.vistas), elegidas) : SIN_VISTAS;

  const pack = KnowledgePack.parse({
    modelo: nombreEquipo,
    clase: ficha.clase,
    verificado: conManual && contenido.pasos.some((p) => p.cita?.estado === "VERIFICADO"),
    fuentes: conManual && manual ? [{ doc: manual.titulo, url: manual.url }] : fuentesWeb(lectura.bloques),
    piezas: contenido.piezas,
    pasos: contenido.pasos,
    advertencias: contenido.advertencias,
    repuestos: contenido.repuestos,
  });
  // Sin pasos igual se sigue: la persona llega al 3D (plantilla) con la guía marcada NO VERIFICADO.
  const verificados = pack.pasos.filter((p) => p.cita?.estado === "VERIFICADO").length;
  eventos.push(
    pack.pasos.length
      ? evento(casoId, "bibliotecario", "pack_armado", `Armé la guía: ${pack.piezas.length} piezas y ${pack.pasos.length} pasos (${verificados} con cita verificada).`, {
          descartadas: contenido.descartadas.length,
          verificado: pack.verificado,
        })
      : evento(casoId, "bibliotecario", "guia_vacia", "No conseguí pasos para este equipo: te muestro el esquema genérico (NO VERIFICADO).", diagnostico(lectura, contenido)),
  );

  if (manual && conManual) {
    eventos.push(evento(casoId, "bibliotecario", "vistas_ubicadas", mensajeVistas(vistas), { vistas }));

    // Imágenes reales de páginas del manual (sin IA): la vista interior y las páginas citadas en los pasos.
    // Se dibujan desde el extracto (todas están ahí). VERIFICADO si la cita de la lectura confirmó la vista interior.
    if (extracto) {
      const citadas = pack.pasos.map((p) => (p.cita?.estado === "VERIFICADO" ? p.cita.pagina : undefined));
      const paginas = [...new Set([vistas.interior, ...citadas].filter((n): n is number => typeof n === "number"))];
      const hojas = paginas
        .map((pagina) => ({ pagina, hoja: paginaEnExtracto(manual.paginas, pagina) }))
        .filter((h): h is { pagina: number; hoja: number } => h.hoja !== null);
      imagenesPaginas = await imagenesDePaginas(extracto.datos, { marca: ficha.marca.valor, modelo }, hojas, deps.subirPng);
      const url = vistas.interior !== null ? imagenesPaginas[vistas.interior] : undefined;
      if (url && vistas.interior !== null) {
        vistaInterior = { url, pagina: vistas.interior, estado: contenido.vistas.interior === vistas.interior ? "VERIFICADO" : "NO_VERIFICADO" };
      }
    }

    // 5. Se guarda el manual para la próxima vez. Un manual ya verificado no pierde esa marca.
    await repo.guardar({
      marca: ficha.marca.valor ?? "",
      modelo,
      url: manual.url,
      titulo: manual.titulo,
      ...columnasVistas(vistas),
      verificado: (manualDeCache && registro?.verificado === true) || pack.verificado,
      fuente: manual.fuente,
    });
  }

  const armado: Armado = { pack, manual: conManual ? manual : null, vistas, vistaInterior, imagenesPaginas };
  // Solo se guarda una guía con pasos y sin fallas: un pack vacío no puede volver como "ya tenía la guía".
  if (!huboFalla && pack.pasos.length > 0) await cache.set(clave, armado);
  return { ...armado, desdeCache: false, eventos };
}

/** Fuentes web citadas cuando no hubo manual (para mostrar de dónde salió la guía NO VERIFICADA). */
function fuentesWeb(bloques: Anthropic.TextBlock[]): { doc: string; url: string }[] {
  const vistas = new Map<string, string>();
  for (const b of bloques)
    for (const c of b.citations ?? []) if (c.type === "web_search_result_location") vistas.set(c.url, c.title ?? c.url);
  return [...vistas].map(([url, doc]) => ({ doc, url }));
}
