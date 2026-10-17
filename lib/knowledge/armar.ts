import type Anthropic from "@anthropic-ai/sdk";
import { KnowledgePack, type Evento, type Ficha } from "../../shared";
import { planoNotebookBase } from "../planogenerator/plantillas/notebook";
import { enviarMensaje, ErrorIA, LIMITES, MODELOS, subirArchivo, type EnviarMensaje, type SubirArchivo } from "../ia/claude";
import { normalizar } from "../intake/chapa";
import { evento } from "../intake/entrada";
import { buscarManual, type ManualEncontrado } from "./buscar";
import { descargarPdf, type Fetch } from "./descargar";
import { leerManual, SYSTEM_LECTOR } from "./lector";
import { lineasConCitas, parsearContenido, type ClaseVista, type Vistas } from "./lineas";
import { repoManuales, vistasDe, type RepoManuales } from "./manuales";
import { combinar, faltantes, instruccionesVistas, SIN_VISTAS, ubicarVistas } from "./vistas";

/**
 * Armado del knowledge pack: buscar manual → descargar PDF → leerlo con citas → validar.
 * En la misma lectura se ubican las vistas del manual para el cartógrafo (/api/plano).
 * El pack se arma una vez por modelo + síntoma; el manual y sus vistas, una vez por modelo.
 */

/** El manual elegido, ya subido a la Files API. A4 (/api/chat) lo reusa por `fileId` con caché de prompt. */
export type Manual = { url: string; fileId: string; bytes: number; titulo: string; fuente: ManualEncontrado["fuente"] };

/** `vistas`: páginas físicas del PDF con la vista explosionada y una vista interior (para /api/plano). */
export type Armado = { pack: KnowledgePack; manual: Manual | null; vistas: Vistas };

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
- Ids de pieza en minúsculas con guion bajo. Usá estos cuando correspondan: ${IDS_PLANTILLA.join(", ")}.
- Incluí las piezas que se mencionan en los pasos, y los pasos para diagnosticar o resolver el síntoma (máximo ${LIMITES.pack.maxPasos}).
- Cada PIEZA, PASO y REPUESTO tiene que salir de ${conManual ? "una página del manual" : "una fuente"}: citala.
- NUNCA inventes números de parte, piezas ni pasos que no estén en ${fuente}.
- Si un paso implica gas refrigerante, 220 V, capacitores, abrir la fuente o una batería dañada, marcalo riesgo alto.

<equipo>${equipo}</equipo>
<sintoma>${sintoma}</sintoma>`;
}

/** Con manual: lectura con prefijo compartido (caché de prompts). Sin manual: guía pública con búsqueda web. */
async function leerPack(
  equipo: string,
  sintoma: string,
  manual: Manual | null,
  vistas: ClaseVista[],
  enviar: EnviarMensaje,
): Promise<Anthropic.TextBlock[]> {
  if (manual) return leerManual(manual, tareaPack(equipo, sintoma, true, vistas), LIMITES.lectura.maxTokensPack, enviar);
  const r = await enviar({
    model: MODELOS.vision,
    max_tokens: LIMITES.lectura.maxTokensPack,
    output_config: { effort: LIMITES.lectura.effort },
    system: SYSTEM_LECTOR,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
    messages: [{ role: "user", content: tareaPack(equipo, sintoma, false, []) }],
  });
  return r.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
}

function mensajeVistas(v: Vistas): string {
  const exp = v.explosionada ? `la vista explosionada (p. ${v.explosionada})` : null;
  const int = v.interior ? `una vista del interior (p. ${v.interior})` : null;
  if (exp && int) return `Ubiqué en el manual ${exp} y ${int}.`;
  if (exp || int) return `Ubiqué en el manual ${exp ?? int}; no encontré ${exp ? "una vista del interior" : "la vista explosionada"}.`;
  return "No encontré en el manual la vista explosionada ni una vista del interior.";
}

export type Deps = { enviar?: EnviarMensaje; subir?: SubirArchivo; fetch?: Fetch; cache?: CachePacks; manuales?: RepoManuales };

export async function armarKnowledgePack(
  entrada: { ficha: Ficha; sintoma: string },
  deps: Deps = {},
): Promise<Armado & { eventos: Evento[]; desdeCache: boolean }> {
  const { ficha, sintoma } = entrada;
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
      desdeCache: true,
      eventos: [evento(casoId, "bibliotecario", "pack_en_cache", "Ya tenía la guía de este modelo.")],
    };
  }

  const eventos: Evento[] = [];
  const nombreEquipo = `${ficha.marca.valor ?? ""} ${modelo}`.trim();
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
  encontrado ??= await buscarManual({ marca: ficha.marca.valor, modelo, clase: ficha.clase }, { enviar, fetch: deps.fetch });

  let manual: Manual | null = null;
  if (encontrado) {
    const fileId = await (deps.subir ?? subirArchivo)(encontrado.pdf.datos, "manual.pdf");
    manual = { url: encontrado.url, fileId, bytes: encontrado.pdf.bytes, titulo: encontrado.titulo, fuente: encontrado.fuente };
  }
  eventos.push(
    manual
      ? evento(casoId, "bibliotecario", "manual_encontrado", `Tengo el manual: ${manual.titulo}.`, { url: manual.url })
      : evento(casoId, "bibliotecario", "manual_no_encontrado", "No encontré el manual oficial; uso guías públicas (NO VERIFICADO)."),
  );

  // 3. Lectura del pack. Las vistas que faltan se piden en la misma lectura (sin llamada extra).
  const bloques = await leerPack(nombreEquipo, sintoma, manual, manual ? faltantes(vistas) : [], enviar);
  const contenido = parsearContenido(lineasConCitas(bloques), manual?.titulo ?? "Fuente pública");
  // Las páginas solo tienen sentido con un PDF del manual.
  vistas = manual ? combinar(vistas, contenido.vistas) : SIN_VISTAS;

  const pack = KnowledgePack.parse({
    modelo: nombreEquipo,
    clase: ficha.clase,
    verificado: manual !== null && contenido.pasos.some((p) => p.cita?.estado === "VERIFICADO"),
    fuentes: manual ? [{ doc: manual.titulo, url: manual.url }] : fuentesWeb(bloques),
    piezas: contenido.piezas,
    pasos: contenido.pasos,
    advertencias: contenido.advertencias,
    repuestos: contenido.repuestos,
  });
  if (pack.pasos.length === 0) throw new ErrorIA("No salió ningún paso válido del manual", contenido.descartadas);

  const verificados = pack.pasos.filter((p) => p.cita?.estado === "VERIFICADO").length;
  eventos.push(
    evento(casoId, "bibliotecario", "pack_armado", `Armé la guía: ${pack.piezas.length} piezas y ${pack.pasos.length} pasos (${verificados} con cita verificada).`, {
      descartadas: contenido.descartadas.length,
    }),
  );

  if (manual) {
    // 4. Si alguna vista no salió en la lectura, búsqueda dedicada (reusa la caché de prompts del manual).
    const faltan = faltantes(vistas);
    if (faltan.length) {
      try {
        vistas = combinar(vistas, await ubicarVistas(manual, faltan, enviar));
      } catch (e) {
        console.error("[knowledge] no pude ubicar las vistas del manual:", (e as Error).message);
      }
    }
    eventos.push(evento(casoId, "bibliotecario", "vistas_ubicadas", mensajeVistas(vistas), { vistas }));

    // 5. Se guarda el manual para la próxima vez. Un manual ya verificado no pierde esa marca.
    await repo.guardar({
      marca: ficha.marca.valor ?? "",
      modelo,
      url: manual.url,
      titulo: manual.titulo,
      pagina_vista_explosionada: vistas.explosionada,
      pagina_vista_interior: vistas.interior,
      verificado: (manualDeCache && registro?.verificado === true) || pack.verificado,
      fuente: manual.fuente,
    });
  }

  const armado: Armado = { pack, manual, vistas };
  await cache.set(clave, armado);
  return { ...armado, desdeCache: false, eventos };
}

/** Fuentes web citadas cuando no hubo manual (para mostrar de dónde salió la guía NO VERIFICADA). */
function fuentesWeb(bloques: Anthropic.TextBlock[]): { doc: string; url: string }[] {
  const vistas = new Map<string, string>();
  for (const b of bloques)
    for (const c of b.citations ?? []) if (c.type === "web_search_result_location") vistas.set(c.url, c.title ?? c.url);
  return [...vistas].map(([url, doc]) => ({ doc, url }));
}
