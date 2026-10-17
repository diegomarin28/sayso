import type { Coreografia, Riesgo } from "../../shared";

/**
 * Seguridad — dueño: Juanma.
 * Tabla FIJA de riesgos. La IA propone un nivel de riesgo, pero el código decide:
 * la IA puede subir el riesgo, nunca bajarlo. Riesgo alto = bloqueo y derivación a técnico.
 */

export type ClaseRiesgo = {
  id: "refrigerante" | "electrico" | "bateria" | "gas";
  nombre: string;
  nivel: Riesgo;
  /** Se buscan sobre el texto normalizado (minúsculas, sin tildes). */
  patrones: RegExp[];
  derivacion: string;
};

export const TABLA_RIESGOS: readonly ClaseRiesgo[] = [
  {
    id: "refrigerante",
    nombre: "Gas refrigerante",
    nivel: "alto",
    patrones: [
      /\brefrigerante/,
      /\b(carg|recarg|purg|solt|liber|vaci)\w*\b.{0,20}\bgas\b/,
      /\br-?(22|32|134a?|290|410a?|600a?)\b/,
      /\bcompresor/,
      /\b(cano|canos|caneria|tuberia)s?\b.{0,25}\b(cobre|gas|soldar|cortar|abrir)/,
      /\bsoldar\b.{0,25}\b(cano|caneria|tuberia)/,
    ],
    derivacion:
      "Esto toca el circuito de gas refrigerante: está a presión y manipularlo requiere un técnico matriculado. Te recomiendo llamar a un técnico de refrigeración.",
  },
  {
    id: "electrico",
    nombre: "220 V, capacitores y fuente",
    nivel: "alto",
    patrones: [
      // "desenchufá de los 220 V" es normal; tocar o medir 220 V no.
      /\b(toc|med|trabaj|empalm|pel|abr)\w*\b.{0,30}\b220\b/,
      /\b220\s*v?\b.{0,30}\b(toc|med|trabaj|empalm)\w*/,
      /\b(tension|corriente) de (red|linea)\b/,
      /\bcapacitor|condensador(es)? (electrolitico|de arranque|de la fuente|de la placa)|\bdescargar\b.{0,20}\b(capacitor|condensador)/,
      /\b(abr|desarm)\w*\b.{0,25}\b(la )?fuente\b/,
      /\b(abr|desarm)\w*\b.{0,25}\b(el )?(cargador|transformador)\b/,
      /\bplaca de potencia\b/,
      /\b(enchufad[oa]|conectad[oa] a la (red|corriente)|con (la )?corriente)\b.{0,40}\b(abr|toc|med|desarm|trabaj)\w*/,
      /\b(abr|toc|med|desarm|trabaj)\w*\b.{0,40}\b(enchufad[oa]|con (la )?corriente)\b/,
      /\bpuentear\b/,
    ],
    derivacion:
      "Esto implica trabajar con tensión de red (220 V) o con capacitores que pueden guardar carga aunque el equipo esté desenchufado. Es peligroso: derivalo a un técnico.",
  },
  {
    id: "bateria",
    nombre: "Batería hinchada o abierta",
    nivel: "alto",
    patrones: [
      /\bbateria\b.{0,30}\b(hinchad|inflad|abombad|deformad|perforad|pinchad|quemad|caliente|humo|pierde|chorrea)/,
      /\b(hinchad|inflad|abombad)[oa]s?\b.{0,20}\bbateria\b/,
      /\b(abr|desarm|perfor|pinch|cort|romp)\w*\b.{0,15}\b(la |las )?(bateria|celdas?)\b/,
      /\bceldas? (de (la )?)?(bateria|litio)\b/,
      /\b(soldar|cortocircuit|puentear)\w*\b.{0,20}\bbateria\b/,
    ],
    derivacion:
      "Una batería de litio hinchada, dañada o abierta puede incendiarse. No la abras ni la presiones: desconectá el equipo, dejalo en un lugar ventilado lejos de cosas que se quemen y llevalo a un técnico.",
  },
  {
    id: "gas",
    nombre: "Gas natural o envasado",
    nivel: "alto",
    patrones: [
      /\b(perdida|olor|fuga|escape) de gas\b/,
      /\bhuele a gas\b/,
      /\b(garrafa|gas natural|calefon|termotanque a gas|valvula de gas|llave de gas|quemador)\b/,
    ],
    derivacion:
      "Cualquier trabajo con gas lo tiene que hacer un gasista matriculado. Si hay olor a gas: no prendas luces ni fuego, ventilá, cerrá la llave de paso y llamá a la distribuidora.",
  },
];

const ORDEN: Record<Riesgo, number> = { bajo: 0, medio: 1, alto: 2 };

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

/** "no abras la batería" o "nunca pinches la batería" es una advertencia, no un pedido. */
const NEGACION = /\b(no|nunca|jamas|evita|evitar|sin)\b[^.;,]{0,12}$/;

function coincide(texto: string, patron: RegExp, ignorarNegadas: boolean): boolean {
  const re = new RegExp(patron.source, patron.flags.includes("g") ? patron.flags : patron.flags + "g");
  for (const m of texto.matchAll(re)) {
    if (!ignorarNegadas) return true;
    const antes = texto.slice(Math.max(0, m.index - 20), m.index);
    if (!NEGACION.test(antes)) return true;
  }
  return false;
}

export type Evaluacion = {
  riesgo: Riesgo;
  bloqueado: boolean;
  clases: ClaseRiesgo["id"][];
  /** Mensaje para la persona cuando está bloqueado. */
  derivacion?: string;
};

/**
 * Evalúa un texto (pedido de la persona o paso propuesto por la IA).
 * `riesgoPropuesto` es lo que dijo la IA: se usa solo si es MAYOR que el de la tabla.
 * `ignorarNegadas`: para texto de la IA, "no abras la batería" no bloquea.
 */
export function evaluarRiesgo(
  texto: string,
  opciones: { riesgoPropuesto?: Riesgo; ignorarNegadas?: boolean } = {},
): Evaluacion {
  const t = normalizar(texto);
  const encontradas = TABLA_RIESGOS.filter((c) => c.patrones.some((p) => coincide(t, p, opciones.ignorarNegadas ?? false)));

  let riesgo: Riesgo = opciones.riesgoPropuesto ?? "bajo";
  for (const c of encontradas) if (ORDEN[c.nivel] > ORDEN[riesgo]) riesgo = c.nivel;

  const bloqueado = riesgo === "alto";
  const derivacion = bloqueado
    ? encontradas.map((c) => c.derivacion).join(" ") ||
      "Este paso es peligroso para hacerlo en casa. Te recomiendo derivarlo a un técnico."
    : undefined;

  return { riesgo, bloqueado, clases: encontradas.map((c) => c.id), ...(derivacion ? { derivacion } : {}) };
}

/** Pedido de la persona (voz o texto), antes de mandarlo a la IA. */
export function evaluarPedido(texto: string): Evaluacion {
  return evaluarRiesgo(texto, { ignorarNegadas: false });
}

/**
 * Filtro final de una coreografía que propuso la IA. Si es de riesgo alto, se
 * reemplaza por la derivación y se sacan las acciones (no se anima el paso).
 */
export function filtrarCoreografia(c: Coreografia): { coreografia: Coreografia; evaluacion: Evaluacion } {
  const evaluacion = evaluarRiesgo(c.dice, { riesgoPropuesto: c.riesgo, ignorarNegadas: true });
  if (!evaluacion.bloqueado) {
    return { coreografia: { ...c, riesgo: evaluacion.riesgo }, evaluacion };
  }
  return {
    coreografia: {
      paso: c.paso,
      dice: `Acá frenamos. ${evaluacion.derivacion}`,
      acciones: [{ t: "restaurar" }],
      riesgo: "alto",
    },
    evaluacion,
  };
}
