import type { Ficha } from "../../shared";
import type { EnviarMensaje, LlamarIA } from "../ia/claude";
import type { Fetch } from "../knowledge/descargar";
import { claveManual } from "../knowledge/manuales";
import { cachePlanosEnMemoria, cubrePack, type CachePlanos } from "./cache";
import { ajustarPlanoAlTipo } from "./carcasa";
import { elegirPlantilla } from "./plantillas/por-tipo";
import { conSueltas, generarPlano, type EntradaGenerador, type ResultadoGenerador } from "./generador";
import { paginasRecorte, recortarManual } from "./recorte";

/**
 * Plano para un caso: si ya hay uno guardado para esa marca + modelo que cubre las piezas
 * del pack, se reusa; si no, lo genera el cartógrafo y se guarda (solo si salió de la IA:
 * la plantilla genérica nunca se cachea).
 * Para generarlo, si el bibliotecario encontró la vista interior, la IA lee solo esas páginas
 * (más la vista explosionada) en vez del manual entero. Si el recorte falla, lee el manual entero.
 */
export type EntradaObtener = EntradaGenerador & { ficha?: Ficha; manualUrl?: string | null };
export type ResultadoObtener = Omit<ResultadoGenerador, "propuesta" | "camino" | "modelo"> &
  Partial<Pick<ResultadoGenerador, "camino" | "modelo">> & {
  desdeCache: boolean;
  /** Páginas del manual que leyó la IA si fue un recorte; null = manual entero, imágenes o caché. */
  paginasLeidas: number[] | null;
};

const memoria = cachePlanosEnMemoria();

export async function obtenerPlano(
  entrada: EntradaObtener,
  deps: { cache?: CachePlanos; llamar?: LlamarIA; enviar?: EnviarMensaje; descargar?: Fetch } = {},
): Promise<ResultadoObtener> {
  const cache = deps.cache ?? memoria;
  const marca = entrada.ficha?.marca.valor ?? null;
  const modelo = entrada.ficha?.modelo.valor ?? null;
  const clave = modelo ? claveManual(marca, modelo) : null;

  if (clave) {
    const guardado = await cache.get(clave);
    if (guardado && cubrePack(guardado, entrada.knowledgePack)) {
      // Un plano guardado antes de ajustar por tipo (ej. un TV acostado) se ajusta al leerlo; uno ya ajustado no cambia.
      const tipo = elegirPlantilla(entrada.knowledgePack, entrada.tipoEquipo);
      // Y las piezas que quedaron sin lugar se suman sueltas (un plano viejo no las tenía).
      const { plano, avisos } = conSueltas(tipo ? ajustarPlanoAlTipo(guardado.plano, tipo) : guardado.plano, entrada.knowledgePack, tipo);
      return { plano, avisos: [...guardado.avisos, ...avisos], origen: "ia", desdeCache: true, paginasLeidas: null };
    }
  }

  const paginas = paginasRecorte(entrada.manual?.paginaVistaInterior, entrada.manual?.paginasVistaExplosionada);
  const recorte = paginas && entrada.manualUrl ? await recortarManual(entrada.manualUrl, paginas, deps.descargar) : null;
  // El título tiene que ser el mismo con que el bibliotecario leyó el manual (sale en las fuentes del pack):
  // es parte del prefijo de la caché de prompts.
  const titulo = entrada.manual?.titulo ?? entrada.knowledgePack.fuentes.find((f) => f.url && f.url === entrada.manualUrl)?.doc;
  const conTitulo = entrada.manual && titulo ? { ...entrada, manual: { ...entrada.manual, titulo } } : entrada;
  const { plano, avisos, origen, camino, modelo: modeloIA } = await generarPlano(recorte ? { ...conTitulo, recorte } : conTitulo, deps.llamar, deps.enviar);
  if (clave && modelo && origen === "ia") {
    await cache.set(clave, marca ?? "", modelo, {
      plano,
      avisos,
      manualUrl: entrada.manualUrl ?? null,
      piezasPedidas: entrada.knowledgePack.piezas.map((p) => p.id),
    });
  }
  return { plano, avisos, origen, camino, modelo: modeloIA, desdeCache: false, paginasLeidas: recorte && origen === "ia" ? recorte.paginas : null };
}
