import type { Ficha } from "../../shared";
import type { LlamarIA } from "../ia/claude";
import type { Fetch } from "../knowledge/descargar";
import { claveManual } from "../knowledge/manuales";
import { cachePlanosEnMemoria, cubrePack, type CachePlanos } from "./cache";
import { generarPlano, type EntradaGenerador, type ResultadoGenerador } from "./generador";
import { paginasRecorte, recortarManual } from "./recorte";

/**
 * Plano para un caso: si ya hay uno guardado para esa marca + modelo que cubre las piezas
 * del pack, se reusa; si no, lo genera el cartógrafo y se guarda (solo si salió de la IA:
 * la plantilla genérica nunca se cachea).
 * Para generarlo, si el bibliotecario encontró la vista interior, la IA lee solo esas páginas
 * (más la vista explosionada) en vez del manual entero. Si el recorte falla, lee el manual entero.
 */
export type EntradaObtener = EntradaGenerador & { ficha?: Ficha; manualUrl?: string | null };
export type ResultadoObtener = Omit<ResultadoGenerador, "propuesta"> & {
  desdeCache: boolean;
  /** Páginas del manual que leyó la IA si fue un recorte; null = manual entero, imágenes o caché. */
  paginasLeidas: number[] | null;
};

const memoria = cachePlanosEnMemoria();

export async function obtenerPlano(
  entrada: EntradaObtener,
  deps: { cache?: CachePlanos; llamar?: LlamarIA; descargar?: Fetch } = {},
): Promise<ResultadoObtener> {
  const cache = deps.cache ?? memoria;
  const marca = entrada.ficha?.marca.valor ?? null;
  const modelo = entrada.ficha?.modelo.valor ?? null;
  const clave = modelo ? claveManual(marca, modelo) : null;

  if (clave) {
    const guardado = await cache.get(clave);
    if (guardado && cubrePack(guardado, entrada.knowledgePack)) {
      return { plano: guardado.plano, avisos: guardado.avisos, origen: "ia", desdeCache: true, paginasLeidas: null };
    }
  }

  const paginas = paginasRecorte(entrada.manual?.paginaVistaInterior, entrada.manual?.paginasVistaExplosionada);
  const recorte = paginas && entrada.manualUrl ? await recortarManual(entrada.manualUrl, paginas, deps.descargar) : null;
  const { plano, avisos, origen } = await generarPlano(recorte ? { ...entrada, recorte } : entrada, deps.llamar);
  if (clave && modelo && origen === "ia") {
    await cache.set(clave, marca ?? "", modelo, {
      plano,
      avisos,
      manualUrl: entrada.manualUrl ?? null,
      piezasPedidas: entrada.knowledgePack.piezas.map((p) => p.id),
    });
  }
  return { plano, avisos, origen, desdeCache: false, paginasLeidas: recorte && origen === "ia" ? recorte.paginas : null };
}
