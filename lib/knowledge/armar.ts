import type Anthropic from "@anthropic-ai/sdk";
import { KnowledgePack, type Evento, type Ficha } from "../../shared";
import { planoNotebookBase } from "../planogenerator/plantillas/notebook";
import { tiposParaPrompt } from "../planogenerator/tipos";
import { enviarMensaje, ErrorIA, LIMITES, subirArchivo, type EnviarMensaje, type LlamarIA, type SubirArchivo, MODELO_DE, herramientasWeb, ESCALADA, puedeEscalar, type MotivoEscalada } from "../ia/claude";
import { IAEnPausa } from "../ia/freno";
import { normalizar } from "../intake/chapa";
import { evento } from "../intake/entrada";
import { buscarManual, type ManualEncontrado } from "./buscar";
import { descargarPdf, type Fetch } from "./descargar";
import { nombreExtracto, paginaEnExtracto, paginaOriginal, paginasConDibujo, prepararExtracto, type Extracto } from "./extracto";
import { imagenesDePaginas, type SubirPng, type VistaInteriorImagen } from "./imagen";
import { atribucion, buscarGuiaIfixit, fotosPorPaso, guiaIfixit, manualWebDeIfixit, type GuiaIfixit } from "./ifixit";
import { bloqueManual, leerDocumentos, leerManual, leerManualWeb, SYSTEM_LECTOR, type Lectura } from "./lector";
import { armarManualWeb, bloquesManualWeb, elegirSecciones, leerPaginaWeb, pareceIndice, type ManualWeb } from "./manualweb";
import { lineasConCitas, parsearContenido, type ClaseVista, type Contenido, type Vistas } from "./lineas";
import { columnasVistas, esSoloGuia, repoManuales, vistasDe, type RepoManuales } from "./manuales";
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
  /** Guía de iFixit: { URL del paso (la de su cita): foto del paso }. Vacío si no hubo iFixit. */
  fotosPasos?: Record<string, string>;
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

/** `publicasAdjuntas`: sin manual, pero con las páginas de una guía pública ya guardadas (van adjuntas, sin búsqueda web). */
function tareaPack(equipo: string, sintoma: string, conManual: boolean, vistas: ClaseVista[], publicasAdjuntas = false, manualAdjunto = false): string {
  const fuente = conManual ? "el manual" : "las fuentes";
  const publicas = publicasAdjuntas ? "las guías públicas adjuntas (no son del fabricante)" : "fuentes públicas de la web (buscá con la herramienta)";
  const origen = conManual
    ? "el manual de servicio adjunto"
    : manualAdjunto
      ? `${publicas} y el manual oficial adjunto (que no trae el diagnóstico de este síntoma). Si un paso o una pieza está en el manual oficial, citá el manual`
      : publicas;
  return `Prepará una guía de reparación casera con ${origen}.
Escribí SOLO líneas con este formato exacto, una por renglón, sin títulos ni markdown:
PIEZA|id|nombre|ubicación en palabras (relativa a otras piezas)|número en la vista explosionada (o vacío)
PASO|orden|instrucción para una persona sin experiencia, en 1 a 3 frases: qué hacer, cómo (herramienta, dónde, hacia dónde) y qué vas a ver si va bien|ids de piezas separados por coma|riesgo (bajo, medio o alto)
REPUESTO|id de pieza|número de parte tal cual figura en ${fuente}
ADVERTENCIA|aviso de seguridad del equipo (nada sobre las fuentes o el manual)
FALTA|parte del procedimiento que ${fuente} no trae (ej. cómo abrir el equipo y sacar la pantalla)
${vistas.length ? `${instruccionesVistas(vistas)}\n` : ""}Los PASO forman la guía completa, en TRES PARTES y en este orden (numerados seguidos):
1. Chequeos sin abrir (3 a 6 pasos): primero descartá lo que NO es una falla de hardware y lo que se revisa con el equipo cerrado, según el tipo de equipo y el síntoma: apagar del todo y reiniciar, configuración y ajustes, actualizar el sistema o el firmware, modo seguro o restablecer (avisando qué se pierde), las pruebas de diagnóstico del fabricante, cables, cargador, enchufe, pilas o accesorios, limpieza por fuera. Cada chequeo dice cómo se hace y qué cambia si ese era el problema.
2. Desarme y reparación: si después de los chequeos sigue igual, el procedimiento COMPLETO sin saltear nada: preparar (herramientas, apagar, desenchufar o descargar la batería), abrir el equipo, sacar cada pieza que haya que sacar antes para llegar, y revisar, limpiar o cambiar la pieza del síntoma.
3. Armado y prueba: volver a armar en orden inverso (cables, tornillos, adhesivos), la prueba final y qué quiere decir si sigue igual.
Reglas:
- Ids de pieza en minúsculas con guion bajo, que EMPIECEN con el tipo de pieza (así el 3D sabe dibujarla), por ejemplo ventilador_evaporador o carcasa_heladera. En una notebook, si la pieza coincide, usá estos ids tal cual: ${IDS_PLANTILLA.join(", ")}.
- Tipos de pieza que el 3D sabe dibujar:
${tiposParaPrompt()}
- Incluí las piezas que se mencionan en los pasos. Máximo ${LIMITES.pack.maxPasos} pasos entre las tres partes: si no alcanzan, juntá en un paso acciones chicas seguidas sobre la misma pieza, pero nunca saltees una pieza que haya que sacar.
- Si ${fuente} no trae una parte del procedimiento, NO escribas que falta, que el manual no lo detalla ni que hay que consultar el manual, una web o un servicio técnico: escribí una línea FALTA con esa parte y seguí con lo que sí está.
- Cada PIEZA, REPUESTO y cada PASO de las partes 2 y 3 tiene que salir de ${conManual ? "una página del manual" : "una fuente"}: citala. Los chequeos sin abrir de la parte 1 que ${fuente} no trae pueden ser los habituales para este tipo de equipo y este síntoma: van sin cita (se muestran sin verificar), nunca con datos inventados de este modelo.
- NUNCA inventes números de parte, piezas ni pasos de desarme que no estén en ${fuente}.
- Todo lo que se le dice a la persona (nombre y ubicación de la PIEZA, PASO, ADVERTENCIA) va en castellano rioplatense: traducí, nunca copies frases del manual en inglés ni las pegues al final (el original ya queda en la cita), y sin negritas ni markdown.
- Sin manual oficial, igual armá pasos CONCRETOS para el síntoma, no consejos genéricos.
- Los pasos arrancan con el equipo CERRADO, como lo tiene la persona: el primer paso de la parte 2 es cómo abrirlo según ${fuente} (herramientas, tornillos, calor, ventosa, etc.).
- Si ${fuente} lista las piezas que se pueden pedir con su número de parte, agregá un REPUESTO por cada pieza que tenga que ver con el síntoma (el número tal cual figura).
- Si un paso implica gas refrigerante, 220 V, capacitores, abrir la fuente o una batería dañada, marcalo riesgo alto. Desconectar el cable de una batería sana o sacarla como indica el manual es riesgo medio.
- Lo de riesgo alto va al FINAL de la parte 2, después de todo lo que se puede hacer sin riesgo: en ese paso la guía se corta y se deriva a un técnico. Una precaución ("si la batería está hinchada, no la uses") no es un paso de riesgo alto.

<equipo>${equipo}</equipo>
<sintoma>${sintoma}</sintoma>`;
}

/** Guía pública (sin manual): búsqueda web. Sigue si la búsqueda queda a mitad de camino (`pause_turn`). */
async function guiaPublica(equipo: string, sintoma: string, enviar: EnviarMensaje, adjuntos: Anthropic.DocumentBlockParam[] = []): Promise<Lectura> {
  const tarea = tareaPack(equipo, sintoma, false, [], false, adjuntos.length > 0);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: [...adjuntos, { type: "text", text: tarea }] }];
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

/** Deja en cada juego de vistas solo las páginas que tienen un dibujo en el PDF (las demás quedan en null). */
async function soloConDibujo(datos: Uint8Array, ...candidatas: Vistas[]): Promise<Vistas[]> {
  const paginas = candidatas.flatMap((v) => [v.explosionada, v.interior]).filter((n): n is number => n !== null);
  const validas = await paginasConDibujo(datos, paginas);
  const filtrar = (n: number | null) => (n !== null && validas.has(n) ? n : null);
  return candidatas.map((v) => ({ explosionada: filtrar(v.explosionada), interior: filtrar(v.interior) }));
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

  // 1. Caché de manuales (Supabase): si ya lo encontramos antes, se reusa con sus vistas (la URL la verificó
  //    el código al encontrarla; "verificado" es de las citas). Una fila "solo guía" guarda fuentes públicas.
  const repo = deps.manuales ?? repoManuales();
  let encontrado: ManualEncontrado | null = null;
  let vistas: Vistas = SIN_VISTAS;
  const registro = await repo.buscar(ficha.marca.valor, modelo);
  if (registro && !esSoloGuia(registro)) {
    const pdf = await descargarPdf(registro.url, deps.fetch);
    const indice = pdf ? null : await leerPaginaWeb(registro.url, deps.fetch);
    if (pdf || pareceIndice(indice)) {
      encontrado = pdf
        ? { formato: "pdf", url: registro.url, titulo: registro.titulo, fuente: registro.fuente, pdf }
        : { formato: "web", url: registro.url, titulo: registro.titulo, fuente: registro.fuente, indice: indice! };
      // Una vista guardada sin dibujo en su página (ej. adivinada por un título) se descarta y se vuelve a pedir.
      vistas = pdf ? (await soloConDibujo(new Uint8Array(pdf.datos), vistasDe(registro)))[0] : vistasDe(registro);
      eventos.push(evento(casoId, "bibliotecario", "manual_en_cache", `Ya conocía el manual: ${registro.titulo}.`, { url: registro.url }));
    }
  }
  const manualDeCache = encontrado !== null;
  // 2. Si no, el bibliotecario lo busca (agente con búsqueda web + probar_pdf).
  //    Si ya se buscó antes y solo hubo guías públicas, no se vuelve a buscar (se releen esas guías).
  if (!encontrado && !esSoloGuia(registro)) {
    encontrado = await buscarManual({ marca: ficha.marca.valor, modelo, clase: tipoEquipo ?? ficha.clase }, { enviar, fetch: deps.fetch });
  }
  if (encontrado && !manualDeCache) {
    // Se guarda la ubicación apenas se encuentra: aunque la lectura falle, la próxima vez no se vuelve a buscar.
    await repo.guardar({
      marca: ficha.marca.valor ?? "",
      modelo,
      url: encontrado.url,
      titulo: encontrado.titulo,
      ...columnasVistas(SIN_VISTAS),
      verificado: false,
      fuente: encontrado.fuente,
    });
  }

  // 3. Extracto: solo las páginas que importan. Si no se puede armar, no se manda el PDF entero: guía pública.
  let manual: Manual | null = null;
  let extracto: Extracto | null = null;
  /** Manual publicado como páginas web (ej. Self Service Repair): secciones elegidas, leídas como texto. */
  let manualWeb: ManualWeb | null = null;
  if (encontrado?.formato === "web") {
    try {
      const secciones = await elegirSecciones(encontrado.indice, equipoDescrito, sintoma, deps.llamar);
      const armadoWeb = await armarManualWeb(encontrado.indice, secciones, deps.fetch);
      if (armadoWeb.secciones.length) {
        manualWeb = { ...armadoWeb, titulo: encontrado.titulo };
        eventos.push(
          evento(casoId, "bibliotecario", "secciones_elegidas", `Elegí ${armadoWeb.secciones.length} secciones del manual oficial para leer.`, {
            secciones: armadoWeb.secciones.map((x) => x.titulo),
          }),
        );
      }
    } catch (e) {
      if (e instanceof IAEnPausa) throw e;
      huboFalla = true;
      console.error("[knowledge] no pude armar el manual web:", (e as Error).message);
    }
  }
  if (encontrado?.formato === "pdf") {
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
  const fuenteManual = manual ?? manualWeb;
  eventos.push(
    fuenteManual
      ? evento(casoId, "bibliotecario", "manual_encontrado", `Tengo el manual: ${fuenteManual.titulo}.`, { url: fuenteManual.url })
      : evento(casoId, "bibliotecario", "manual_no_encontrado", "No encontré el manual oficial; uso guías públicas (NO VERIFICADO)."),
  );

  // 3. Lectura del pack. Las vistas que faltan se piden en la misma lectura (sin llamada extra).
  //    Nunca se reintenta la misma lectura: si el manual no da pasos, se cae en la guía pública.
  let lectura: Lectura | null = null;
  let contenido: Contenido | null = null;
  if (fuenteManual) {
    const leer = async (escalar?: { modelo: string; motivo: MotivoEscalada }): Promise<[Lectura, Contenido] | null> => {
      if (manual) {
        const l = await leerManual(manual, tareaPack(equipoDescrito, sintoma, true, ["explosionada", "interior"]), LIMITES.lectura.maxTokensPack, enviar, "bibliotecario: leer manual", escalar);
        return [l, aPaginasDelManual(parsearContenido(lineasConCitas(l.bloques), manual.titulo, undefined, tipoEquipo ?? ficha.clase), manual.paginas)];
      }
      if (manualWeb) {
        // Manual web: sin páginas (no hay vistas para el 3D); cada cita lleva la URL de su sección.
        const l = await leerManualWeb(manualWeb, tareaPack(equipoDescrito, sintoma, true, []), LIMITES.lectura.maxTokensPack, enviar, "bibliotecario: leer manual web", escalar);
        return [l, parsearContenido(lineasConCitas(l.bloques), manualWeb.titulo, manualWeb.secciones.map((x) => x.url), tipoEquipo ?? ficha.clase)];
      }
      return null;
    };
    try {
      [lectura, contenido] = (await leer()) ?? [null, null];
      // Escalada (una sola vez): si el modelo barato no sacó ningún paso del manual, lo relee el más capaz.
      if (contenido && contenido.pasos.length === 0 && puedeEscalar(MODELO_DE.lectura)) {
        eventos.push(evento(casoId, "bibliotecario", "lectura_escalada", "La primera lectura no dio pasos: la repito con un modelo más capaz."));
        [lectura, contenido] = (await leer({ modelo: ESCALADA.hacia, motivo: "sin_pasos" })) ?? [lectura, contenido];
      }
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
  const conManual = fuenteManual !== null && contenido !== null && contenido.pasos.length > 0;
  let fuentesPublicas: string[] = [];
  let fotosPasos: Record<string, string> = {};
  /** Fuentes del pack sin manual cuando el código las conoce (ej. la guía de iFixit, con su atribución). */
  let fuentesGuia: { doc: string; url: string }[] = [];
  // Lo que se leyó del manual oficial (sin pasos para el síntoma) va adjunto a la guía pública: así cada
  // paso que esté en el manual sale con su cita VERIFICADO y el resto queda como guía pública.
  const adjuntos: Anthropic.DocumentBlockParam[] = conManual ? [] : manual ? [bloqueManual(manual)] : manualWeb ? bloquesManualWeb(manualWeb) : [];
  const urlsAdjuntos = manualWeb && adjuntos.length ? manualWeb.secciones.map((x) => x.url) : adjuntos.map(() => "");
  const esAdjunto = (documento: number) => documento < adjuntos.length;
  const conPaginasDelManual = (c: Contenido) => (manual && adjuntos.length ? aPaginasDelManual(c, manual.paginas) : c);
  /** Guía de iFixit (gratis, sin IA para buscarla) leída con citas: cada cita lleva la URL de su paso. */
  const conIfixit = async (guia: GuiaIfixit): Promise<boolean> => {
    const web = manualWebDeIfixit(guia);
    const l = await leerDocumentos([...adjuntos, ...bloquesManualWeb(web)], tareaPack(equipoDescrito, sintoma, false, [], true, adjuntos.length > 0), LIMITES.lectura.maxTokensPack, enviar, "bibliotecario: guía de iFixit");
    const c = conPaginasDelManual(parsearContenido(lineasConCitas(l.bloques), guia.titulo, [...urlsAdjuntos, ...web.secciones.map((x) => x.url)], tipoEquipo ?? ficha.clase, esAdjunto));
    if (!c.pasos.length) return false;
    [lectura, contenido] = [l, c];
    fuentesPublicas = [guia.url];
    fuentesGuia = [{ doc: atribucion(guia), url: guia.url }];
    fotosPasos = fotosPorPaso(guia);
    eventos.push(evento(casoId, "bibliotecario", "guia_ifixit", `Armé la guía con la de iFixit "${guia.titulo}" (guía pública, NO VERIFICADO).`, { url: guia.url }));
    return true;
  };
  const idIfixit = registro && esSoloGuia(registro) ? idDeGuiaIfixit(registro.fuentes_publicas[0]) : null;
  if (!conManual && idIfixit !== null) {
    // Guía de iFixit ya conocida: se vuelve a pedir por su API (gratis), sin buscar en la web.
    try {
      const guia = await guiaIfixit(idIfixit, deps.fetch);
      if (guia && (await conIfixit(guia))) eventos.push(evento(casoId, "bibliotecario", "guia_publica_en_cache", "Ya tenía la guía de iFixit de este equipo: la releo sin buscar en la web (NO VERIFICADO)."));
    } catch (e) {
      if (e instanceof IAEnPausa) throw e;
      console.error("[knowledge] no pude releer la guía de iFixit:", (e as Error).message);
    }
  } else if (!conManual && esSoloGuia(registro)) {
    // Guía pública ya conocida: el código baja esas páginas (gratis) y se leen como texto, sin búsqueda web.
    try {
      const guardadas = registro!.fuentes_publicas;
      const paginas = await armarManualWeb(
        { url: guardadas[0], titulo: "Guías públicas", texto: "", enlaces: [] },
        guardadas.map((url) => ({ titulo: url, url })),
        deps.fetch,
      );
      if (paginas.secciones.length) {
        const l = await leerManualWeb(paginas, tareaPack(equipoDescrito, sintoma, false, [], true), LIMITES.lectura.maxTokensPack, enviar, "bibliotecario: guía pública guardada");
        const c = parsearContenido(lineasConCitas(l.bloques), "Guías públicas", paginas.secciones.map((x) => x.url), tipoEquipo ?? ficha.clase, false);
        if (c.pasos.length) {
          [lectura, contenido, fuentesPublicas] = [l, c, paginas.secciones.map((x) => x.url)];
          eventos.push(evento(casoId, "bibliotecario", "guia_publica_en_cache", "Ya tenía guías públicas de este equipo: las releo sin buscar en la web (NO VERIFICADO)."));
        }
      }
    } catch (e) {
      if (e instanceof IAEnPausa) throw e;
      console.error("[knowledge] no pude releer la guía pública guardada:", (e as Error).message);
    }
  }
  if (!conManual && fuentesPublicas.length === 0 && !esSoloGuia(registro)) {
    // iFixit antes que la búsqueda web: gratis, con pasos y fotos. Se guarda para no volver a buscar el manual.
    try {
      const guia = await buscarGuiaIfixit(nombreEquipo, sintoma, deps.fetch);
      if (guia && (await conIfixit(guia)) && !encontrado && !registro) {
        await repo.guardar({
          marca: ficha.marca.valor ?? "",
          modelo,
          url: guia.url,
          titulo: "Guías públicas",
          ...columnasVistas(SIN_VISTAS),
          verificado: false,
          fuente: "ifixit",
          fuentes_publicas: [guia.url],
        });
      }
    } catch (e) {
      if (e instanceof IAEnPausa) throw e;
      console.error("[knowledge] no pude usar la guía de iFixit:", (e as Error).message);
    }
  }
  if (!conManual && fuentesPublicas.length === 0) {
    try {
      lectura = await guiaPublica(equipoDescrito, sintoma, enviar, adjuntos);
      contenido = conPaginasDelManual(parsearContenido(lineasConCitas(lectura.bloques), "Fuente pública", urlsAdjuntos, tipoEquipo ?? ficha.clase, esAdjunto));
      fuentesPublicas = fuentesWeb(lectura.bloques).map((f) => f.url).slice(0, LIMITES.guiaPublica.maxFuentes);
      // Se guardan sus fuentes (si no hay un manual guardado), así la próxima no se paga la búsqueda web.
      if (contenido.pasos.length && fuentesPublicas.length && (!registro || esSoloGuia(registro)) && !encontrado) {
        await repo.guardar({
          marca: ficha.marca.valor ?? "",
          modelo,
          url: fuentesPublicas[0],
          titulo: "Guías públicas",
          ...columnasVistas(SIN_VISTAS),
          verificado: false,
          fuente: "otro",
          fuentes_publicas: fuentesPublicas,
        });
      }
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
  // El código confirma que cada vista tenga un dibujo en su página antes de usarla o guardarla.
  if (conManual && manual && encontrado?.formato === "pdf") {
    const [leidas, adivinadas] = await soloConDibujo(new Uint8Array(encontrado.pdf.datos), contenido.vistas, elegidas);
    vistas = combinar(combinar(vistas, leidas), adivinadas);
  } else {
    vistas = SIN_VISTAS;
  }

  const pack = KnowledgePack.parse({
    modelo: nombreEquipo,
    clase: ficha.clase,
    verificado: conManual && contenido.pasos.some((p) => p.cita?.estado === "VERIFICADO"),
    fuentes:
      conManual && fuenteManual
        ? [{ doc: fuenteManual.titulo, url: fuenteManual.url }]
        : [
            ...(fuentesGuia.length ? fuentesGuia : fuentesWeb(lectura.bloques).length ? fuentesWeb(lectura.bloques) : fuentesPublicas.map((url) => ({ doc: url, url }))),
            // Si algún paso salió del manual oficial adjunto, el manual también es fuente.
            ...(fuenteManual && contenido.pasos.some((p) => p.cita?.estado === "VERIFICADO") ? [{ doc: fuenteManual.titulo, url: fuenteManual.url }] : []),
          ],
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
          // Partes del procedimiento que la fuente no trae (líneas FALTA): el experto las busca si se las piden.
          ...(contenido.faltantes.length ? { faltantes: contenido.faltantes.map((f) => f.procedimiento) } : {}),
        })
      : evento(casoId, "bibliotecario", "guia_vacia", "No conseguí pasos para este equipo: te muestro el esquema genérico (NO VERIFICADO).", diagnostico(lectura, contenido)),
  );

  if (manualWeb && conManual) {
    await repo.guardar({
      marca: ficha.marca.valor ?? "",
      modelo,
      url: manualWeb.url,
      titulo: manualWeb.titulo,
      ...columnasVistas(SIN_VISTAS),
      verificado: (manualDeCache && registro?.verificado === true) || pack.verificado,
      fuente: encontrado?.fuente ?? "fabricante",
    });
  }

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

  const armado: Armado = { pack, manual: conManual ? manual : null, vistas, vistaInterior, imagenesPaginas, fotosPasos };
  // Solo se guarda una guía con pasos y sin fallas: un pack vacío no puede volver como "ya tenía la guía".
  if (!huboFalla && pack.pasos.length > 0) await cache.set(clave, armado);
  return { ...armado, desdeCache: false, eventos };
}

/** Id de una guía de iFixit por su URL (ej. https://www.ifixit.com/Guide/Algo/1234), o null. */
export function idDeGuiaIfixit(url: string | undefined): number | null {
  const m = url ? /^https:\/\/(?:www\.)?ifixit\.com\/Guide\/[^/]+\/(\d+)/i.exec(url) : null;
  return m ? Number(m[1]) : null;
}

/** Fuentes web citadas cuando no hubo manual (para mostrar de dónde salió la guía NO VERIFICADA). */
function fuentesWeb(bloques: Anthropic.TextBlock[]): { doc: string; url: string }[] {
  const vistas = new Map<string, string>();
  for (const b of bloques)
    for (const c of b.citations ?? []) if (c.type === "web_search_result_location") vistas.set(c.url, c.title ?? c.url);
  return [...vistas].map(([url, doc]) => ({ doc, url }));
}
