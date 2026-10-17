import type { Ficha } from "../../shared";
import type { LlamarIA } from "../ia/claude";
import { claveManual } from "../knowledge/manuales";
import { cachePlanosEnMemoria, cubrePack, type CachePlanos } from "./cache";
import { generarPlano, type EntradaGenerador, type ResultadoGenerador } from "./generador";

/**
 * Plano para un caso: si ya hay uno guardado para esa marca + modelo que cubre las piezas
 * del pack, se reusa; si no, lo genera el cartógrafo y se guarda (solo si salió de la IA:
 * la plantilla genérica nunca se cachea).
 */
export type EntradaObtener = EntradaGenerador & { ficha?: Ficha; manualUrl?: string | null };
export type ResultadoObtener = Omit<ResultadoGenerador, "propuesta"> & { desdeCache: boolean };

const memoria = cachePlanosEnMemoria();

export async function obtenerPlano(
  entrada: EntradaObtener,
  deps: { cache?: CachePlanos; llamar?: LlamarIA } = {},
): Promise<ResultadoObtener> {
  const cache = deps.cache ?? memoria;
  const marca = entrada.ficha?.marca.valor ?? null;
  const modelo = entrada.ficha?.modelo.valor ?? null;
  const clave = modelo ? claveManual(marca, modelo) : null;

  if (clave) {
    const guardado = await cache.get(clave);
    if (guardado && cubrePack(guardado, entrada.knowledgePack)) {
      return { plano: guardado.plano, avisos: guardado.avisos, origen: "ia", desdeCache: true };
    }
  }

  const { plano, avisos, origen } = await generarPlano(entrada, deps.llamar);
  if (clave && modelo && origen === "ia") {
    await cache.set(clave, marca ?? "", modelo, {
      plano,
      avisos,
      manualUrl: entrada.manualUrl ?? null,
      piezasPedidas: entrada.knowledgePack.piezas.map((p) => p.id),
    });
  }
  return { plano, avisos, origen, desdeCache: false };
}
