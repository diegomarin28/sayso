import type { Fetch } from "./descargar";
import type { ManualWeb, Seccion } from "./manualweb";

/**
 * Guías de iFixit por su API pública (sin clave y SIN IA: no gasta). Para lo que más se trae en la mano
 * (celulares, notebooks, consolas, auriculares) hay guías paso a paso con fotos, herramientas y piezas.
 * 1. `equipoIfixit`: el equipo en iFixit (categoría). Solo se acepta si los códigos de modelo dichos
 *    ("55v6c", "m1", "s21") aparecen en su título o descripción: un TCL 55C722 no es un TCL 55V6C.
 * 2. `ordenarGuias`: las guías de ese equipo, de la que mejor cuadra con el síntoma (por el tema: Battery,
 *    Screen…) a la que menos; se usa la primera que tenga pasos.
 * 3. `guiaIfixit`: los pasos (texto, avisos y fotos), herramientas y piezas.
 * 4. `manualWebDeIfixit`: la guía como `ManualWeb` (una sección por paso, con su URL), para leerla con
 *    citas igual que un manual web (`bloquesManualWeb`).
 * El contenido de iFixit es CC BY-NC-SA: se muestra con su atribución (`atribucion`).
 * Genérico: nada de un modelo ni de una marca en el código.
 */

const API = "https://www.ifixit.com/api/2.0";
const ESPERA_MS = 8000;
/** Cuántas categorías candidatas se revisan (cada una es un pedido). */
const CANDIDATAS = 4;
/** Cuántas palabras del principio (la marca) se pueden sacar si la búsqueda no encuentra nada. */
const QUITAR_MAX = 2;

export type GuiaEnLista = { id: number; titulo: string; tema: string; tipo: string };
export type EquipoIfixit = { titulo: string; url: string; guias: GuiaEnLista[] };
export type PasoIfixit = { titulo: string; url: string; texto: string[]; avisos: string[]; fotos: string[] };
export type GuiaIfixit = {
  id: number;
  titulo: string;
  url: string;
  equipo: string;
  tema: string;
  dificultad: string;
  pasos: PasoIfixit[];
  herramientas: { nombre: string; url: string }[];
  piezas: { nombre: string; url: string }[];
  autor: string;
};

export const LICENCIA = "CC BY-NC-SA 3.0";
export const atribucion = (g: GuiaIfixit) => `"${g.titulo}", de ${g.autor} en iFixit (${g.url}), ${LICENCIA}`;

const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const palabras = (s: string) => sinTildes(s).split(/[^a-z0-9]+/).filter(Boolean);
/** Códigos de modelo: palabras con números ("55v6c", "m1", "s21", "13"). Los que se dijeron tienen que estar. */
const codigos = (s: string) => palabras(s).filter((p) => /\d/.test(p));

async function pedir<T>(ruta: string, f: Fetch): Promise<T | null> {
  try {
    const r = await f(`${API}${ruta}`, { signal: AbortSignal.timeout(ESPERA_MS), headers: { accept: "application/json" } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

type Resultados = { results?: { title?: string; url?: string }[] };
type Wiki = { title?: string; description?: string; guides?: { guideid?: number; title?: string; subject?: string; type?: string }[] };

/** "(6.ª generación)", "(6th generation)", "6ª gen" → "6": iFixit nombra la generación con el número solo ("iPad Mini 6"). */
const GENERACION = /\(?\s*(?:de\s+(?:la\s+)?)?(\d{1,2})\s*(?:\.?\s*[ªºa°]|st|nd|rd|th)?\.?\s*(?:generaci[oó]n|generation|gen)\b\.?\s*\)?/gi;
/** Código de la etiqueta ("A2567", "SM-T500"): letras y 3 o más números. iFixit no los pone en el nombre. */
const CODIGO_ETIQUETA = /\b[A-Z]{1,3}(?:-[A-Z]{0,2})?\d{3,}[A-Z0-9/-]*/g;

/**
 * Formas de nombrar el equipo, de la más fiel a la más corta: tal cual, con la generación como número, sin el
 * código de la etiqueta y sin lo que va entre paréntesis ("(Wi-Fi)"). Una forma solo vale si le queda un
 * número de modelo: "Epson L3250" sin su código sería "Epson", y eso no es un modelo.
 */
export function nombresParaIfixit(equipo: string): string[] {
  const limpio = (t: string) => t.replace(/\s+/g, " ").trim();
  const conGeneracion = limpio(equipo.replace(GENERACION, " $1 "));
  const sinCodigo = limpio(conGeneracion.replace(CODIGO_ETIQUETA, " "));
  const sinParentesis = limpio(sinCodigo.replace(/\([^)]*\)/g, " "));
  const formas = [limpio(equipo), conGeneracion, sinCodigo, sinParentesis].filter((t, i) => i === 0 || codigos(t).length > 0);
  return [...new Set(formas)];
}

/**
 * El equipo en iFixit, o `null` si no hay uno que sea ese modelo: prueba cada forma del nombre
 * (`nombresParaIfixit`) hasta encontrarlo.
 */
export async function equipoIfixit(equipo: string, f: Fetch = fetch): Promise<EquipoIfixit | null> {
  for (const nombre of nombresParaIfixit(equipo)) {
    const e = await equipoExacto(nombre, f);
    if (e) return e;
  }
  return null;
}

/**
 * El equipo en iFixit con ese nombre, o `null`. Entre las candidatas, la que más palabras comparte con lo
 * dicho y menos agrega ("Galaxy S21" es el S21, no el S21 Ultra).
 */
async function equipoExacto(equipo: string, f: Fetch): Promise<EquipoIfixit | null> {
  const dichas = palabras(equipo);
  const codigosDichos = codigos(equipo);
  if (!dichas.length) return null;
  // iFixit pide todas las palabras y no siempre nombra la marca ("iPhone 13", no "Apple iPhone 13"):
  // sin resultados, se prueba sacando palabras del principio.
  let resultados: { title?: string; url?: string }[] = [];
  for (let quitar = 0; quitar <= QUITAR_MAX && !resultados.length && quitar < dichas.length; quitar++) {
    const consulta = equipo.trim().split(/\s+/).slice(quitar).join(" ");
    resultados = (await pedir<Resultados>(`/search/${encodeURIComponent(consulta)}?filter=category&limit=10`, f))?.results ?? [];
  }
  const candidatas = resultados
    .filter((c): c is { title: string; url?: string } => !!c.title)
    .map((c) => {
      const t = palabras(c.title);
      return { titulo: c.title, comparte: dichas.filter((p) => t.includes(p)).length, agrega: t.filter((p) => !dichas.includes(p)).length };
    })
    .sort((a, b) => b.comparte - a.comparte || a.agrega - b.agrega)
    .slice(0, CANDIDATAS);
  for (const c of candidatas) {
    const wiki = await pedir<Wiki>(`/wikis/CATEGORY/${encodeURIComponent(c.titulo)}`, f);
    if (!wiki) continue;
    const texto = palabras(`${c.titulo} ${wiki.description ?? ""}`);
    if (!codigosDichos.every((k) => texto.includes(k))) continue;
    const guias = (wiki.guides ?? [])
      .filter((g) => g.guideid && g.title)
      .map((g) => ({ id: g.guideid!, titulo: g.title!, tema: g.subject ?? "", tipo: g.type ?? "" }));
    if (!guias.length) continue;
    return { titulo: c.titulo, url: `https://www.ifixit.com/Device/${encodeURIComponent(c.titulo.replace(/ /g, "_"))}`, guias };
  }
  return null;
}

/**
 * Qué temas de iFixit (en inglés, como los nombra iFixit) corresponden a cada palabra del síntoma.
 * Por pieza o falla, no por modelo.
 */
const TEMAS: Array<[string[], string[]]> = [
  [["bateria", "pila", "dura", "descarga", "hinchada", "apaga", "autonomia"], ["battery"]],
  [["pantalla", "display", "tactil", "touch", "vidrio", "rota", "roto", "imagen", "lineas", "brillo"], ["screen", "display", "digitizer", "lcd", "panel"]],
  [["carga", "cargar", "cargador", "puerto", "conector", "enchufe", "usb"], ["charging", "port", "usb", "lightning", "connector", "dc", "jack", "battery"]],
  [["ventilador", "ruido", "calienta", "caliente", "temperatura", "sobrecalienta", "fan"], ["fan", "heat", "thermal", "heatsink"]],
  [["parlante", "sonido", "audio", "escucha", "altavoz", "volumen"], ["speaker", "loudspeaker", "earpiece", "audio"]],
  [["microfono", "graba"], ["microphone"]],
  [["camara", "foto", "fotos", "lente"], ["camera", "lens"]],
  [["teclado", "tecla", "teclas"], ["keyboard", "key"]],
  [["touchpad", "trackpad", "mouse"], ["trackpad", "touchpad"]],
  [["joystick", "palanca", "drift", "stick", "analogico"], ["joystick", "thumbstick", "analog", "stick"]],
  [["boton", "botones", "gatillo"], ["button", "trigger"]],
  [["disco", "almacenamiento", "ssd", "memoria"], ["ssd", "hard", "drive", "storage", "ram", "memory"]],
  [["wifi", "senal", "antena", "bluetooth"], ["antenna", "wifi", "airport", "wireless"]],
  [["prende", "enciende", "arranca", "muerto"], ["battery", "power", "logic", "motherboard", "board"]],
  [["agua", "mojado", "liquido"], ["water", "liquid", "corrosion"]],
];

/**
 * Las guías de la lista, de la que mejor cuadra con el síntoma (por el tema) a la que menos. Sin pistas
 * en el síntoma, primero la de batería (la falla más común en lo que se trae en la mano) y las de reemplazo.
 */
export function ordenarGuias(guias: GuiaEnLista[], sintoma: string): GuiaEnLista[] {
  const dichas = palabras(sintoma);
  const buscados = new Set(TEMAS.filter(([es]) => es.some((p) => dichas.some((d) => d.startsWith(p)))).flatMap(([, en]) => en));
  const respaldo = buscados.size ? buscados : new Set(["battery"]);
  const puntaje = (g: GuiaEnLista) => palabras(`${g.tema} ${g.titulo}`).filter((p) => respaldo.has(p)).length * 10 + (g.tipo === "replacement" ? 1 : 0);
  return [...guias].sort((a, b) => puntaje(b) - puntaje(a));
}

/** La que mejor cuadra con el síntoma (ver `ordenarGuias`). */
export const elegirGuia = (guias: GuiaEnLista[], sintoma: string): GuiaEnLista | null => ordenarGuias(guias, sintoma)[0] ?? null;

type GuiaApi = {
  guideid?: number;
  title?: string;
  url?: string;
  category?: string;
  subject?: string;
  difficulty?: string;
  author?: { username?: string };
  tools?: { text?: string; url?: string }[];
  parts?: { text?: string; url?: string }[];
  steps?: { stepid?: number; title?: string; lines?: { bullet?: string; text_raw?: string }[]; media?: { type?: string; data?: { standard?: string }[] } }[];
};

/** Los avisos de iFixit van como "icon_caution", "icon_note", "icon_reminder" en vez de un color. */
const ES_AVISO = /^icon_(caution|note|reminder)$/;

export async function guiaIfixit(id: number, f: Fetch = fetch): Promise<GuiaIfixit | null> {
  const g = await pedir<GuiaApi>(`/guides/${id}`, f);
  if (!g?.guideid || !g.title || !g.url || !g.steps?.length) return null;
  const url = g.url;
  return {
    id: g.guideid,
    titulo: g.title,
    url,
    equipo: g.category ?? "",
    tema: g.subject ?? "",
    dificultad: g.difficulty ?? "",
    autor: g.author?.username ?? "iFixit",
    herramientas: (g.tools ?? []).filter((t) => t.text).map((t) => ({ nombre: t.text!, url: t.url ?? "" })),
    piezas: (g.parts ?? []).filter((p) => p.text).map((p) => ({ nombre: p.text!, url: p.url ?? "" })),
    pasos: g.steps.map((s, i) => {
      const lineas = (s.lines ?? []).filter((l) => l.text_raw?.trim());
      return {
        titulo: s.title?.trim() || `Paso ${i + 1}`,
        url: s.stepid ? `${url}#s${s.stepid}` : url,
        texto: lineas.filter((l) => !ES_AVISO.test(l.bullet ?? "")).map((l) => l.text_raw!.trim()),
        avisos: lineas.filter((l) => ES_AVISO.test(l.bullet ?? "")).map((l) => l.text_raw!.trim()),
        fotos: s.media?.type === "image" ? (s.media.data ?? []).map((m) => m.standard ?? "").filter(Boolean) : [],
      };
    }),
  };
}

/** Cuántas guías se prueban si las primeras vienen vacías (algunas de la lista son alias sin pasos). */
const GUIAS_A_PROBAR = 3;

/** Equipo → guía para el síntoma, o `null` (no está en iFixit o no es ese modelo): sigue la búsqueda de siempre. */
export async function buscarGuiaIfixit(equipo: string, sintoma: string, f: Fetch = fetch): Promise<GuiaIfixit | null> {
  const e = await equipoIfixit(equipo, f);
  for (const g of e ? ordenarGuias(e.guias, sintoma).slice(0, GUIAS_A_PROBAR) : []) {
    const guia = await guiaIfixit(g.id, f);
    if (guia) return guia;
  }
  return null;
}

/**
 * La guía como manual web: una sección con herramientas y piezas, y una por paso (con su URL, así la cita
 * apunta al paso). Se lee con citas igual que cualquier `ManualWeb` (`bloquesManualWeb`).
 */
export function manualWebDeIfixit(g: GuiaIfixit): ManualWeb {
  const lista = (titulo: string, xs: { nombre: string }[]) => (xs.length ? `${titulo}: ${xs.map((x) => x.nombre).join("; ")}.` : "");
  const intro: Seccion = {
    titulo: `${g.titulo} — herramientas y piezas`,
    url: g.url,
    texto: [`Equipo: ${g.equipo}. Dificultad: ${g.dificultad || "sin dato"}.`, lista("Herramientas", g.herramientas), lista("Piezas", g.piezas), `Fuente: ${atribucion(g)}.`]
      .filter(Boolean)
      .join("\n"),
  };
  const pasos: Seccion[] = g.pasos.map((p, i) => ({
    titulo: `Paso ${i + 1}: ${p.titulo}`,
    url: p.url,
    texto: [...p.texto, ...p.avisos.map((a) => `Atención: ${a}`)].join("\n") || p.titulo,
  }));
  return { url: g.url, titulo: g.titulo, secciones: [intro, ...pasos] };
}

/**
 * La foto de cada paso, por la URL del paso (la misma que lleva la cita cuando la guía se lee como manual
 * web): así la guía muestra la foto del paso que está diciendo (`fotoDePaso` en `<GuiaExperto>`).
 */
export function fotosPorPaso(g: GuiaIfixit): Record<string, string> {
  return Object.fromEntries(g.pasos.filter((p) => p.fotos.length).map((p) => [p.url, p.fotos[0]]));
}
