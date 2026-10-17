import type Anthropic from "@anthropic-ai/sdk";
import type { EstadoDato } from "../../shared";
import { COMPRAS } from "./config";
import { OpcionCompra, type Compatibilidad, type PedidoCompra, type Propuesta, type ResultadoCompras } from "./esquemas";

/**
 * El agente propone; el código verifica. Acá no se le cree nada al modelo:
 * - la URL tiene que haber salido de una búsqueda o lectura real (si no, es inventada);
 * - la compatibilidad se mira en el texto del aviso (título del resultado o página leída), no en lo que dice el modelo;
 * - el precio es "confirmado" solo si el número aparece en la página leída.
 */

type Pagina = { url: string; textos: string[]; leida: boolean };
export type Evidencia = Map<string, Pagina>;

/** Clave de una URL: host sin www + ruta, sin query ni #. null si no es http(s). */
export function claveUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

/** Minúsculas, sin tildes, solo letras y números: "5F10-S13875" y "5f10s13875" son lo mismo. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function agregar(ev: Evidencia, url: string, texto: string, leida: boolean) {
  const clave = claveUrl(url);
  if (!clave) return;
  const p = ev.get(clave) ?? { url, textos: [], leida: false };
  p.textos.push(texto.slice(0, COMPRAS.maxTextoEvidencia));
  p.leida ||= leida;
  ev.set(clave, p);
}

/** Junta lo que la API realmente devolvió: títulos de resultados de búsqueda y texto de las páginas leídas. */
export function recolectarEvidencia(bloques: Anthropic.ContentBlock[], ev: Evidencia = new Map()): Evidencia {
  for (const b of bloques) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) agregar(ev, r.url, r.title, false);
    } else if (b.type === "web_fetch_tool_result" && b.content.type === "web_fetch_result") {
      const doc = b.content.content;
      const texto = doc.source.type === "text" ? doc.source.data : "";
      agregar(ev, b.content.url, `${doc.title ?? ""}\n${texto}`, texto.length > 0);
    }
  }
  return ev;
}

function contiene(texto: string, aguja: string | null | undefined): boolean {
  const n = aguja ? normalizar(aguja) : "";
  return n.length >= COMPRAS.minCoincidencia && normalizar(texto).includes(n);
}

/** ¿Aparece el monto en el texto? Acepta "1.290", "1,290.00", "$ 1290". */
export function montoVisto(texto: string, monto: number): boolean {
  const entero = String(Math.trunc(monto));
  if (entero.length < 2) return false;
  const sinSeparadores = texto.replace(/(\d)[.,\s](?=\d{3}(?!\d))/g, "$1");
  return new RegExp(`(?<!\\d)${entero}(?!\\d)`).test(sinSeparadores);
}

const ORDEN: Record<Compatibilidad, number> = { numero_parte: 0, modelo: 1, no_verificado: 2 };

/** Verifica cada candidato, descarta los que no pasan y devuelve las mejores opciones. */
export function elegirOpciones(
  propuesta: Propuesta,
  ev: Evidencia,
  pedido: Pick<PedidoCompra, "numeroParte" | "modelo">,
): Omit<ResultadoCompras, "costo"> {
  const descartados: string[] = [];

  let cotizacion = propuesta.cotizacion;
  if (cotizacion) {
    const fuente = ev.get(claveUrl(cotizacion.url) ?? "");
    if (!fuente?.leida || !montoVisto(fuente.textos.join("\n"), cotizacion.uyuPorUsd)) {
      descartados.push(`cotización ${cotizacion.uyuPorUsd}: no aparece en la página citada`);
      cotizacion = null;
    } else {
      cotizacion = { ...cotizacion, url: fuente.url };
    }
  }

  const vistas = new Set<string>();
  const opciones: OpcionCompra[] = [];
  for (const c of propuesta.candidatos) {
    const clave = claveUrl(c.url);
    const pagina = clave ? ev.get(clave) : undefined;
    if (!clave || !pagina) {
      descartados.push(`${c.url}: no salió de ninguna búsqueda (URL inventada o inválida)`);
      continue;
    }
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    if (c.llegaAUruguay === false) {
      descartados.push(`${c.url}: no envía a Uruguay`);
      continue;
    }

    const texto = pagina.textos.join("\n");
    const compatibilidad: Compatibilidad = contiene(texto, pedido.numeroParte)
      ? "numero_parte"
      : contiene(texto, pedido.modelo)
        ? "modelo"
        : "no_verificado";
    const estadoMonto = (monto: number): EstadoDato =>
      pagina.leida && (monto === 0 ? /gratis|free shipping/i.test(texto) : montoVisto(texto, monto)) ? "confirmado" : "probable";

    const factor = c.moneda === "UYU" ? 1 : (cotizacion?.uyuPorUsd ?? null);
    const opcion = OpcionCompra.safeParse({
      url: pagina.url, // la URL que devolvió la API, no la que escribió el modelo
      titulo: c.titulo,
      tienda: c.tienda,
      compatibilidad,
      precio: { monto: c.precio, moneda: c.moneda, estado: estadoMonto(c.precio) },
      envio: c.envio === null ? { monto: null, estado: "desconocido" } : { monto: c.envio, estado: estadoMonto(c.envio) },
      totalUyu: factor === null ? null : Math.round((c.precio + (c.envio ?? 0)) * factor),
    });
    if (opcion.success) opciones.push(opcion.data);
    else descartados.push(`${c.url}: datos inválidos`);
  }

  // Primero lo compatible; después lo más barato con envío; sin total comparable, al final.
  const total = (o: OpcionCompra) => o.totalUyu ?? Number.MAX_SAFE_INTEGER;
  opciones.sort((a, b) => ORDEN[a.compatibilidad] - ORDEN[b.compatibilidad] || total(a) - total(b));
  return { opciones: opciones.slice(0, COMPRAS.opciones), cotizacion, descartados };
}
