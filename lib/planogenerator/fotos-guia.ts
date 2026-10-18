import type { KnowledgePack } from "../../shared";
import type { ImagenEntrada } from "../ia/claude";
import type { Fetch } from "../knowledge/descargar";
import { ES_TAPA } from "./cubiertas";
import type { FotosInterior } from "./fotos";

/**
 * Fotos de la guía para el 3D (#235): cuando no hay manual con vistas, el cartógrafo ubica las piezas
 * mirando fotos del equipo abierto de la guía que encontró el bibliotecario (hoy, los pasos de iFixit:
 * `fotosPasos` de /api/knowledge, foto por URL del paso). Sin IA para elegirlas: van las de los pasos que
 * tocan más piezas internas, que son los que muestran el equipo abierto. Por tipo y nunca por modelo.
 * Va antes que la búsqueda web de fotos (`fotos.ts`): estas ya las tenemos y no cuestan nada.
 */

/** Cuántas fotos se le pasan al cartógrafo (cada una son ~1.500 tokens de entrada). */
export const MAX_FOTOS_GUIA = 3;
/** Una foto más grande que esto no se usa (la API acepta hasta 5 MB). */
const MAX_BYTES_FOTO = 4_000_000;
const ESPERA_MS = 8_000;
const TIPOS = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * La envoltura del equipo (carcasa, marco, pantalla, tapas): en una foto con el equipo abierto se ve corrida o
 * a medio sacar, así que no se ubica con fotos; la pone el esqueleto del tipo, en su cara.
 */
export const ENVOLTURA_EN_FOTOS = /^(base|marco|carcasa|pantalla|display|tapa|cubierta)/;

/** Lo que no es "interno": la carcasa, las tapas, la pantalla que se despega y los tornillos. */
const ENVOLTURA = /^(base|marco|carcasa|pantalla|display|tornillo)/;

/**
 * Las fotos de los pasos que tocan más piezas internas, en el orden de la guía, sin repetir. Un paso sin
 * piezas internas (calentar el borde, despegar la pantalla) muestra el equipo cerrado: no sirve para ubicar.
 * Si ningún paso nombra piezas internas (la lectura de la guía no siempre las anota), van las fotos de la
 * segunda mitad de la guía, repartidas: en una guía de desarme, ahí el equipo ya está abierto.
 */
export function fotosDelInterior(pack: KnowledgePack, fotosPasos: Record<string, string>, max = MAX_FOTOS_GUIA): { paso: string; foto: string }[] {
  const internas = (ids: string[]) => ids.filter((id) => !ENVOLTURA.test(id) && !ES_TAPA.test(id)).length;
  const conFoto = pack.pasos
    .map((p) => ({ orden: p.orden, paso: p.cita?.url ?? "", foto: p.cita?.url ? fotosPasos[p.cita.url] : undefined, internas: internas(p.piezas) }))
    .filter((c): c is { orden: number; paso: string; foto: string; internas: number } => !!c.foto)
    .sort((a, b) => a.orden - b.orden);
  let candidatos = conFoto.filter((c) => c.internas > 0);
  if (!candidatos.length && conFoto.length) {
    const segunda = conFoto.slice(Math.floor(conFoto.length / 2));
    const paso = Math.max(1, Math.floor(segunda.length / max));
    candidatos = segunda.filter((_, i) => i % paso === 0).map((c) => ({ ...c, internas: 1 }));
  }
  const elegidas: typeof candidatos = [];
  for (const c of [...candidatos].sort((a, b) => b.internas - a.internas || a.orden - b.orden)) {
    if (elegidas.length >= max) break;
    if (!elegidas.some((e) => e.foto === c.foto)) elegidas.push(c);
  }
  return elegidas.sort((a, b) => a.orden - b.orden).map(({ paso, foto }) => ({ paso, foto }));
}

/** "guide-images.cdn.ifixit.com" → "ifixit.com" (los dos últimos nombres del dominio). */
const dominio = (url: string) => {
  try {
    return new URL(url).hostname.split(".").slice(-2).join(".");
  } catch {
    return null;
  }
};

/**
 * Las fotos elegidas, bajadas para el cartógrafo, con la URL del paso de cada una (la cita de lo que se vea en
 * ella). Solo HTTPS y del mismo sitio que una fuente del pack (la guía citada): las URL llegan del navegador y el
 * servidor no baja cualquier cosa. Una foto que falla se saltea; sin ninguna, null (sigue la búsqueda web).
 */
export async function fotosDeLaGuia(pack: KnowledgePack, fotosPasos: Record<string, string>, f: Fetch = fetch): Promise<FotosInterior | null> {
  const permitidos = new Set(pack.fuentes.map((x) => (x.url ? dominio(x.url) : null)).filter(Boolean));
  const imagenes: ImagenEntrada[] = [];
  const urls: string[] = [];
  for (const { paso, foto } of fotosDelInterior(pack, fotosPasos)) {
    if (!foto.startsWith("https://") || !permitidos.has(dominio(foto))) continue;
    try {
      const r = await f(foto, { signal: AbortSignal.timeout(ESPERA_MS) });
      const tipo = r.headers.get("content-type")?.split(";")[0].trim() ?? "";
      if (!r.ok || !TIPOS.has(tipo)) continue;
      const datos = Buffer.from(await r.arrayBuffer());
      if (!datos.length || datos.length > MAX_BYTES_FOTO) continue;
      imagenes.push({ base64: datos.toString("base64"), mediaType: tipo as ImagenEntrada["mediaType"] });
      urls.push(paso);
    } catch {
      // sin la foto, el cartógrafo usa las que haya
    }
  }
  if (!imagenes.length) return null;
  const sitio = new URL(urls[0]).hostname.replace(/^www\./, "");
  return { imagenes, fuente: { doc: `Fotos de la guía (${sitio})`, urls } };
}
