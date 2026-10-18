import { MODELOS, medirCosto, totalUsd } from "../../lib/ia/claude";
import { cachePlanosEnMemoria } from "../../lib/planogenerator/cache";
import { coincidencia } from "../../lib/planogenerator/evaluacion/coincidencia";
import { obtenerPlano, type EntradaObtener, type ResultadoObtener } from "../../lib/planogenerator/obtener";
import { textoOrigen, type ComparacionPlano, type CorridaPlano, type EntradaPlano } from "./bateria";

/**
 * El plano del mismo equipo con Sonnet y con Haiku (IA real: gasta saldo). Corre en este proceso
 * (necesita la clave en .env.local), con la misma entrada que /api/plano y una caché vacía en cada
 * corrida para que ninguna reuse a la otra. El modelo de la app no cambia (`MODELO_DE.plano`).
 * Con el manual entero no se compara: ese camino usa siempre el modelo de lectura.
 */
export async function compararPlano(e: EntradaPlano): Promise<ComparacionPlano> {
  // La misma entrada que arma /api/plano.
  const entrada: EntradaObtener = {
    casoId: e.casoId,
    knowledgePack: e.knowledgePack,
    ficha: e.ficha,
    tipoEquipo: e.tipoEquipo,
    manualUrl: e.manualUrl,
    manual: e.manualFileId
      ? { fileId: e.manualFileId, paginasVistaExplosionada: e.paginasVistaExplosionada, paginaVistaInterior: e.paginaVistaInterior }
      : undefined,
  };
  const correr = async (modelo: string): Promise<{ r: ResultadoObtener; corrida: CorridaPlano }> => {
    const t0 = Date.now();
    const { resultado, usos } = await medirCosto(() => obtenerPlano({ ...entrada, modelo }, { cache: cachePlanosEnMemoria() }));
    return {
      r: resultado,
      corrida: { modelo: resultado.modelo ?? modelo, usd: totalUsd(usos), segundos: (Date.now() - t0) / 1000, origen3D: textoOrigen(resultado.origen, resultado.plano) },
    };
  };

  const sonnet = await correr(MODELOS.vision);
  const camino = sonnet.r.camino ?? "—";
  if (camino === "manual") {
    return { camino, sonnet: sonnet.corrida, haiku: null, coincidencia: null, nota: "con el manual entero el plano usa el modelo de lectura: no se compara" };
  }
  const haiku = await correr(MODELOS.corto);
  const c = coincidencia(sonnet.r.plano, haiku.r.plano);
  return { camino, sonnet: sonnet.corrida, haiku: haiku.corrida, coincidencia: { puntos: c.puntos, max: c.max, porcentaje: c.porcentaje } };
}
