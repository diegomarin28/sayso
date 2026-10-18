import type { Ficha, KnowledgePack, PlanoDePiezas } from "../../shared";
import type { EnviarMensaje, LlamarIA } from "../ia/claude";
import type { Fetch } from "../knowledge/descargar";
import { claveManual } from "../knowledge/manuales";
import { cachePlanosEnMemoria, cubrePack, type CachePlanos, type PlanoGuardado } from "./cache";
import { ajustarPlanoAlTipo } from "./carcasa";
import { sumarDelManual } from "./completar";
import { elegirPlantilla } from "./plantillas/por-tipo";
import type { BuscarFotos } from "./fotos";
import { ES_ESTRUCTURA, terminarPlano, generarPlano, type EntradaGenerador, type ResultadoGenerador } from "./generador";
import { paginasRecorte, recortarManual } from "./recorte";

/**
 * Plano para un caso: si ya hay uno guardado para esa marca + modelo que cubre las piezas
 * del pack, se reusa; si no, lo genera el cartógrafo y se guarda (solo si salió de la IA:
 * la plantilla genérica nunca se cachea).
 * Si el guardado no cubre el pack (otro síntoma nombra otras piezas), no se regenera entero:
 * - sin manual, la IA solo podría estimar (y lo estimado sigue al esqueleto del tipo): las piezas
 *   nuevas se suman sin IA, como en `terminarPlano` (esqueleto del tipo o piezas sueltas);
 * - con manual, la IA ubica solo las que faltan y se suman las que vio en una página (`sumarDelManual`);
 *   el guardado crece con ellas.
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

/**
 * Un plano guardado antes de ajustar por tipo (ej. un TV acostado) se ajusta al leerlo; uno ya ajustado no cambia.
 * Y se termina igual que uno nuevo: esqueleto del tipo, medidas con sentido y piezas sueltas (`terminarPlano`).
 */
export function terminarGuardado(plano: PlanoDePiezas, kp: KnowledgePack, tipoEquipo?: string) {
  const tipo = elegirPlantilla(kp, tipoEquipo);
  return terminarPlano(tipo ? ajustarPlanoAlTipo(plano, tipo) : plano, kp, tipo);
}

export async function obtenerPlano(
  entrada: EntradaObtener,
  deps: { cache?: CachePlanos; llamar?: LlamarIA; enviar?: EnviarMensaje; descargar?: Fetch; buscarFotos?: BuscarFotos } = {},
): Promise<ResultadoObtener> {
  const cache = deps.cache ?? memoria;
  const marca = entrada.ficha?.marca.valor ?? null;
  const modelo = entrada.ficha?.modelo.valor ?? null;
  const clave = modelo ? claveManual(marca, modelo) : null;

  const kp = entrada.knowledgePack;
  const tipo = elegirPlantilla(kp, entrada.tipoEquipo);
  const terminar = (plano: PlanoDePiezas) => terminarGuardado(plano, kp, entrada.tipoEquipo);

  let guardado: PlanoGuardado | null = null;
  if (clave) {
    guardado = await cache.get(clave);
    if (guardado && cubrePack(guardado, kp)) {
      const { plano, avisos } = terminar(guardado.plano);
      return { plano, avisos: [...guardado.avisos, ...avisos], origen: "ia", desdeCache: true, paginasLeidas: null };
    }
  }
  const pedidas = new Set(guardado?.piezasPedidas ?? []);
  const faltan = kp.piezas.filter((p) => !pedidas.has(p.id));
  const conManual = Boolean(entrada.manual || entrada.imagenes?.length);
  // La base y la tapa no se ubican: si solo faltan esas, tampoco hace falta la IA.
  if (guardado && (!conManual || faltan.every((p) => ES_ESTRUCTURA.has(p.id)))) {
    const { plano, avisos } = terminar(guardado.plano);
    const donde = tipo ? `según el esqueleto de ${tipo.nombre}` : "en el lugar libre más cercano";
    const aviso = `Plano guardado de este modelo: ${faltan.map((p) => `"${p.id}"`).join(", ")} se suma(n) ${donde}, sin IA.`;
    return { plano, avisos: [...guardado.avisos, aviso, ...avisos], origen: "ia", desdeCache: true, paginasLeidas: null };
  }

  // Con un plano guardado y el manual, la IA ubica solo lo que falta.
  const aGenerar: EntradaObtener = guardado ? { ...entrada, knowledgePack: { ...kp, piezas: faltan } } : entrada;
  const paginas = paginasRecorte(entrada.manual?.paginaVistaInterior, entrada.manual?.paginasVistaExplosionada);
  const recorte = paginas && entrada.manualUrl ? await recortarManual(entrada.manualUrl, paginas, deps.descargar) : null;
  // El título tiene que ser el mismo con que el bibliotecario leyó el manual (sale en las fuentes del pack):
  // es parte del prefijo de la caché de prompts.
  const titulo = entrada.manual?.titulo ?? kp.fuentes.find((f) => f.url && f.url === entrada.manualUrl)?.doc;
  const conTitulo = aGenerar.manual && titulo ? { ...aGenerar, manual: { ...aGenerar.manual, titulo } } : aGenerar;
  const generado =
    (!guardado && !recorte && !conManual && modelo ? await conFotos(conTitulo, { marca, modelo, clase: kp.clase }, deps) : null) ??
    (await generarPlano(recorte ? { ...conTitulo, recorte } : conTitulo, deps.llamar, deps.enviar));
  const { camino, modelo: modeloIA } = generado;
  const paginasLeidas = recorte && generado.origen === "ia" ? recorte.paginas : null;

  if (guardado) {
    const { plano: sumado, sumadas } = generado.origen === "ia" ? sumarDelManual(guardado.plano, generado.plano, faltan.map((p) => p.id)) : { plano: guardado.plano, sumadas: [] };
    const { plano, avisos: terminado } = terminar(sumado);
    const aviso = sumadas.length
      ? `Plano guardado de este modelo: la IA ubicó en el manual solo lo que faltaba (${sumadas.join(", ")}).`
      : "Plano guardado de este modelo: lo que faltaba no está en una página del manual, se suma según el esqueleto.";
    const avisos = [...guardado.avisos, aviso, ...terminado];
    if (clave && modelo && generado.origen === "ia") {
      await cache.set(clave, marca ?? "", modelo, {
        plano,
        avisos: [...guardado.avisos, ...(sumadas.length ? [aviso] : [])],
        manualUrl: entrada.manualUrl ?? guardado.manualUrl,
        piezasPedidas: [...new Set([...guardado.piezasPedidas, ...faltan.map((p) => p.id)])],
      });
    }
    return { plano, avisos, origen: "ia", camino, modelo: modeloIA, desdeCache: false, paginasLeidas: sumadas.length ? paginasLeidas : null };
  }

  const { plano, avisos, origen } = generado;
  if (clave && modelo && origen === "ia") {
    await cache.set(clave, marca ?? "", modelo, {
      plano,
      avisos,
      manualUrl: entrada.manualUrl ?? null,
      piezasPedidas: kp.piezas.map((p) => p.id),
    });
  }
  return { plano, avisos, origen, camino, modelo: modeloIA, desdeCache: false, paginasLeidas };
}

/**
 * Sin manual (ni recorte ni imágenes), antes de estimar: fotos públicas del interior de ese modelo (#235). Lo que
 * la IA ve en ellas queda con origen "foto". Si no hay fotos, o falla cualquier cosa, o la IA no pudo con ellas,
 * null: el plano se arma como siempre (estimado), nunca un error.
 */
async function conFotos(
  entrada: EntradaObtener,
  equipo: Parameters<BuscarFotos>[0],
  deps: { llamar?: LlamarIA; enviar?: EnviarMensaje; buscarFotos?: BuscarFotos },
): Promise<ResultadoGenerador | null> {
  if (!deps.buscarFotos) return null;
  try {
    const fotos = await deps.buscarFotos(equipo);
    if (!fotos?.imagenes.length) return null;
    const r = await generarPlano({ ...entrada, imagenes: fotos.imagenes, paginas: undefined, fotos: fotos.fuente }, deps.llamar, deps.enviar);
    return r.origen === "ia" ? { ...r, avisos: [`Sin vistas del manual: ubiqué las piezas con ${fotos.imagenes.length} fotos del interior (${fotos.fuente.doc}).`, ...r.avisos] } : null;
  } catch {
    return null;
  }
}
