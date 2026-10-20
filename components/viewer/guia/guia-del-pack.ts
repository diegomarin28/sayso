import type { Accion, Coreografia, KnowledgePack, PlanoDePiezas } from "../../../shared";
import { conArticulo } from "./conversacion";

/**
 * Guía paso a paso armada con el knowledge pack, SIN IA: la usa la guía simulada (fixture, /lab y
 * "Mis casos" de prueba) para que el paso a paso se entienda sin gastar (#161). Con un pack real
 * (por ejemplo de "Mis casos") sigue sus pasos tal cual; con uno corto (el del fixture) suma lo que
 * explica cada paso:
 * - Antes de empezar: apagar y desconectar, si el primer paso ya trabaja sobre una pieza y no lo dice
 *   (si el pack arranca con pruebas con el equipo prendido, no). Las advertencias del pack NO se suman a
 *   los pasos: a veces son notas sobre las fuentes, y las que nombran riesgos ("los capacitores retienen
 *   carga") hacen que el filtro de seguridad del visor bloquee el paso entero.
 * - Después de un paso que saca una envoltura (tapa, carcasa, base): "adentro vas a ver…", con las piezas
 *   que vienen en la guía (o las del pack) resaltadas.
 * - Antes de un paso que trabaja sobre una pieza interna, "ubicá X": dónde está y qué es, con la pieza
 *   resaltada en el 3D. Las envolturas (tapa, carcasa, base) no se ubican: se sacan.
 * - Un paso de riesgo alto del pack frena la guía (como el servidor: no se explica cómo hacerlo).
 */

/** Zoom de la cámara al ir a una pieza (igual que la pieza nombrada). */
const ZOOM_PIEZA = 1.4;
/**
 * Tope de pasos de una respuesta, solo para lo que suma esta guía ("antes de empezar", "adentro vas a
 * ver", "ubicá"): los pasos del pack van siempre (un pack real trae hasta ~12).
 */
export const MAX_PASOS_GUIA = 12;
const ENVOLTURA = /^(base|tapa|carcasa|marco|puerta)/;
/** Apagar o cortar la corriente (no "desconectá el flex": eso es desarmar). */
const YA_DICE_APAGAR = /apag[aáu]|desenchuf|desconect\w*\s+(?:\w+\s+){0,2}(?:corriente|cargador|enchufe|pared|alimentaci)/i;
/** Cuántas piezas nombra "adentro vas a ver". */
const MAX_A_LA_VISTA = 3;

/** Texto con punto final y sin espacios de más. */
const frase = (t: string) => {
  const limpio = t.replace(/\s+/g, " ").trim();
  return /[.!?]$/.test(limpio) ? limpio : `${limpio}.`;
};
const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const normal = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const irA = (ids: string[]): Accion[] => (ids.length ? [{ t: "camara", objetivo: ids[0], zoom: ZOOM_PIEZA }, ...ids.map((pieza) => ({ t: "resaltar" as const, pieza }))] : [{ t: "restaurar" }]);

export function guiaDelPack(pack: KnowledgePack, plano: PlanoDePiezas): Coreografia[] {
  const enPlano = new Set(plano.piezas.map((p) => p.pieza));
  const piezas = new Map(pack.piezas.map((p) => [p.id, p]));
  const pasos = [...pack.pasos].sort((a, b) => a.orden - b.orden);
  const salida: Omit<Coreografia, "paso">[] = [];

  if (!pasos.length) return [];
  const arrancaTocando = pasos[0].piezas.some((id) => enPlano.has(id));
  if (arrancaTocando && !YA_DICE_APAGAR.test(pasos[0].texto)) {
    salida.push({
      dice: "Antes de empezar: apagalo y desconectalo de la corriente (cable o cargador).",
      acciones: [{ t: "restaurar" }],
      riesgo: "bajo",
    });
  }

  const ubicadas = new Set<string>();
  let abierto = false;
  /** Cuántos pasos se pueden sumar sin pasar el tope (los del pack no cuentan como sumados). */
  let lugar = MAX_PASOS_GUIA - pasos.length - salida.length;
  for (const [i, p] of pasos.entries()) {
    const ids = p.piezas.filter((id) => enPlano.has(id));
    if (p.riesgo === "alto") {
      salida.push({ dice: `Acá frenamos: ${p.texto} Esto lo tiene que hacer un técnico.`, acciones: [{ t: "restaurar" }], riesgo: "alto" });
      break;
    }
    const apaga = YA_DICE_APAGAR.test(p.texto);
    // Antes de apagar o desconectar no se mira nada: la seguridad va primero.
    const interna = apaga ? undefined : ids.find((id) => !ENVOLTURA.test(id) && !ubicadas.has(id) && piezas.has(id));
    if (interna && lugar > 0) {
      lugar--;
      const pieza = piezas.get(interna)!;
      const { texto } = conArticulo(pieza.nombre);
      // "el ventilador" → "te lo marco"; "la batería" → "te la marco"; "los tornillos" → "te los marco".
      const pronombre = texto.split(" ")[0] === "el" ? "lo" : texto.split(" ")[0];
      // La descripción solo si agrega algo (a veces repite el nombre).
      const descripcion = normal(pieza.descripcion) && normal(pieza.descripcion) !== normal(pieza.nombre) ? ` ${frase(pieza.descripcion)}` : "";
      salida.push({
        dice: `Ubicá ${texto}: ${frase(minuscula(pieza.ubicacion))}${descripcion} Te ${pronombre} marco en el 3D.`,
        acciones: irA([interna]),
        riesgo: "bajo",
      });
      ubicadas.add(interna);
    }
    salida.push({ dice: p.texto, ...(p.cita ? { cita: p.cita } : {}), acciones: irA(ids), riesgo: p.riesgo });
    if (!abierto && lugar > 0 && ids.some((id) => ENVOLTURA.test(id))) {
      abierto = true;
      // Primero las piezas que usan los pasos que siguen, después las otras del pack.
      const siguientes = pasos.slice(i + 1).flatMap((q) => q.piezas);
      const adentro = [...new Set([...siguientes, ...pack.piezas.map((x) => x.id)])]
        .filter((id) => enPlano.has(id) && piezas.has(id) && !ENVOLTURA.test(id) && !id.startsWith("tornillo"))
        .slice(0, MAX_A_LA_VISTA);
      if (adentro.length) {
        lugar--;
        const nombres = adentro.map((id) => conArticulo(piezas.get(id)!.nombre).texto);
        const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}` : nombres[0];
        salida.push({ dice: `Adentro vas a ver ${lista}. Te las marco en el 3D.`, acciones: irA(adentro), riesgo: "bajo" });
      }
    }
  }

  return numerar(salida);
}

/**
 * Los pasos guardados del pack, tal cual (sin sumar nada): para "Seguir con la guía" al abrir un caso
 * desde "Mis casos" sin volver a preguntar (#219, sin IA). Cada paso con su cita (el sello de siempre:
 * "Manual ✓ p. N" o "Guía pública"), la cámara y el resaltado de sus piezas del plano. Un paso de riesgo
 * alto frena la guía, como en `guiaDelPack`.
 */
export function pasosDelPack(pack: KnowledgePack, plano: PlanoDePiezas): Coreografia[] {
  const enPlano = new Set(plano.piezas.map((p) => p.pieza));
  const salida: Omit<Coreografia, "paso">[] = [];
  for (const p of [...pack.pasos].sort((a, b) => a.orden - b.orden)) {
    if (p.riesgo === "alto") {
      salida.push({ dice: `Acá frenamos: ${p.texto} Esto lo tiene que hacer un técnico.`, acciones: [{ t: "restaurar" }], riesgo: "alto" });
      break;
    }
    salida.push({ dice: p.texto, ...(p.cita ? { cita: p.cita } : {}), acciones: irA(p.piezas.filter((id) => enPlano.has(id))), riesgo: p.riesgo });
  }
  return numerar(salida);
}

/**
 * Numera los pasos. Las herramientas no se explican acá: el paso las nombra con qué son dentro de la misma frase
 * (lo pide la lectura del manual), y el detalle está en "Herramientas que necesitás" (#230).
 */
function numerar(salida: Omit<Coreografia, "paso">[]): Coreografia[] {
  return salida.map((c, i) => ({ paso: i + 1, ...c }));
}
