import type { Coreografia, Riesgo } from "../../shared";

/**
 * Seguridad — dueño: Juanma.
 * Tabla FIJA de riesgos. La IA propone un nivel de riesgo, pero el código decide:
 * la IA puede subir el riesgo, nunca bajarlo. Riesgo alto = bloqueo y derivación a técnico.
 * Las reglas y el mensaje dependen del tipo de equipo: en un celular el riesgo es la batería
 * de litio y el cargador, no los capacitores de una fuente de 220 V.
 */

export type ClaseRiesgo = {
  id: "refrigerante" | "electrico" | "bateria" | "gas";
  nombre: string;
  nivel: Riesgo;
  /** Se buscan sobre el texto normalizado (minúsculas, sin tildes). */
  patrones: RegExp[];
  /** Solo para equipos que van enchufados a la red (en un celular, "capacitor" o "placa de potencia" no son un riesgo). */
  patronesSoloRed?: RegExp[];
  derivacion: string;
  /** Mensaje para equipos a batería (celular, notebook, tablet…), si es distinto. */
  derivacionBateria?: string;
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
      // Nombrar el compresor no bloquea ("el compresor hace ruido"); actuar sobre él sí.
      // Verbo y compresor en la misma frase (sin cruzar un punto); "el compresor. No lo abras" no cuenta como pedido.
      /\b(abr|cambi|reemplaz|desarm|desmont|desconect|cort|sold|carg|recarg|sac|quit|repar|arregl|manipul)\w*\b[^.;!?:]{0,30}\bcompresor/,
      /\bcompresor\b(?:(?!\b(?:no|nunca|jamas)\b)[^.;!?:]){0,30}\b(abr|cambi|reemplaz|desarm|desmont|desconect|cort|sold|carg|recarg|sac|quit|repar|arregl)\w*/,
      // Caños de gas: igual que el compresor, bloquea la acción ("cortar los caños"), no la mención ("los caños tienen gas").
      /\b(cort|sold|abr|desconect|cambi|reemplaz|desarm|perfor|dobl)\w*\b[^.;!?:]{0,25}\b(cano|caneria|tuberia)s?\b/,
      /\b(cano|caneria|tuberia)s?\b(?:(?!\b(?:no|nunca|jamas)\b)[^.;!?:]){0,25}\b(cort|sold|abr|desconect|cambi|reemplaz|desarm|perfor|dobl)\w*/,
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
      /\b(abr|desarm)\w*\b.{0,25}\b(el )?(cargador|transformador)\b/,
      // Trabajar (abrir, tocar, medir, soldar) con el equipo enchufado o con corriente.
      /\b(enchufad[oa]|conectad[oa] a la (red|corriente)|con (la )?corriente)\b.{0,40}\b(abr|toc|med|desarm|trabaj|sold)\w*/,
      /\b(abr|toc|med|desarm|trabaj|sold|desold)\w*\b.{0,40}\b(enchufad[oa]|con (la )?corriente)\b/,
      // Probar una pieza enchufada o a 220 V con la tapa abierta; conectarla directo a la red.
      /\b(prob|prueb)\w*\b[^.;!?]{0,40}\b(enchufad[oa]|220)\b[^.;!?]{0,40}\b(tapa abierta|abiert[oa])/,
      /\b(conect|enchuf)\w*\b[^.;!?]{0,25}\bdirect\w*\b[^.;!?]{0,12}\b(a )?(la )?(red|220|toma|corriente|enchufe)\b/,
      // Puentes en la instalación o en el equipo.
      /\bpuentear\b/,
      /\b(hac|hag|pon)\w*\s+(un\s+)?puente\b/,
      /\bpuente\b[^.;!?]{0,25}\b(enchufe|220|fusible|termica|disyuntor|toma)\b/,
    ],
    patronesSoloRed: [
      /\bcapacitor|condensador(es)? (electrolitico|de arranque|de la fuente|de la placa)|\bdescargar\b.{0,20}\b(capacitor|condensador)/,
      /\b(abr|desarm)\w*\b.{0,25}\b(la )?fuente\b/,
      /\bplaca de potencia\b/,
    ],
    derivacion:
      "Esto implica trabajar con tensión de red (220 V) o con capacitores que pueden guardar carga aunque el equipo esté desenchufado. Es peligroso: derivalo a un técnico.",
    derivacionBateria:
      "Eso es trabajar con el equipo enchufado o tocar el cargador, que va a 220 V. Desenchufalo y apagalo antes de abrirlo; si hay que abrir o reparar el cargador, que lo haga un técnico.",
  },
  {
    id: "bateria",
    nombre: "Batería hinchada o abierta",
    nivel: "alto",
    patrones: [
      /\bbateria\b.{0,30}\b(hinch|infl|abomb|deform|perforad|pinchad|quemad|caliente|humo|pierde|chorrea)\w*/,
      /\b(hinch|infl|abomb)\w*\b.{0,20}\bbateria\b/,
      /\b(abr|desarm|perfor|pinch|cort|romp)\w*\b.{0,15}\b(la |las )?(bateria|celdas?)\b/,
      /\bceldas? (de (la )?)?(bateria|litio)\b/,
      /\b(soldar|cortocircuit|puentear)\w*\b.{0,20}\bbateria\b/,
    ],
    derivacion:
      "Una batería de litio hinchada, dañada o abierta puede incendiarse. No la abras ni la presiones: desconectá el equipo, dejalo en un lugar ventilado lejos de cosas que se quemen y llevalo a un técnico.",
    derivacionBateria:
      "Una batería de litio hinchada, pinchada, doblada o abierta puede prenderse fuego. No la presiones ni la saques haciendo palanca: apagá el equipo, dejalo en un lugar ventilado lejos de cosas que se quemen y llevalo a un técnico.",
  },
  {
    id: "gas",
    nombre: "Gas natural o envasado",
    nivel: "alto",
    patrones: [
      /\b(perdida|olor|fuga|escape) (de|a) gas\b/,
      /\bhuele a gas\b/,
      /\bsiento (olor a )?gas\b/,
      /\b(garrafa|gas natural|calefon|termotanque a gas|valvula de gas|llave de gas|quemador)\b/,
    ],
    derivacion:
      "Cualquier trabajo con gas lo tiene que hacer un gasista matriculado. Si hay olor a gas: no prendas luces ni fuego, ventilá, cerrá la llave de paso y llamá a la distribuidora.",
  },
];

/**
 * Familia de equipo para la seguridad: a batería (el riesgo es la batería de litio y el cargador)
 * o enchufado a la red (220 V, capacitores, fuente). Tabla fija, como el resto de la seguridad.
 */
export type FamiliaEquipo = "bateria" | "red" | "desconocida";

const A_BATERIA =
  /\b(celular|telefono|iphone|smartphone|galaxy|tablet|ipad|notebook|laptop|macbook|netbook|chromebook|reloj|smartwatch|auricular|parlante portatil|consola portatil|camara digital|drone)/;
const A_RED =
  /\b(heladera|freezer|lavarropas|lavasecarropas|secarropas|lavavajillas|aire|split|microondas|horno|cocina|televisor|tv|monitor|pc de escritorio|aspiradora|cafetera|calefon|termotanque|estufa)/;

export function familiaDe(tipoEquipo?: string | null): FamiliaEquipo {
  const t = normalizar(tipoEquipo ?? "");
  if (A_BATERIA.test(t)) return "bateria";
  if (A_RED.test(t)) return "red";
  return "desconocida";
}

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
 * `tipoEquipo`: el de la recepción (ej. "celular"); cambia qué reglas aplican y el mensaje.
 */
export function evaluarRiesgo(
  texto: string,
  opciones: { riesgoPropuesto?: Riesgo; ignorarNegadas?: boolean; tipoEquipo?: string | null } = {},
): Evaluacion {
  const t = normalizar(texto);
  const familia = familiaDe(opciones.tipoEquipo);
  const negadas = opciones.ignorarNegadas ?? false;
  const encontradas = TABLA_RIESGOS.filter(
    (c) =>
      c.patrones.some((p) => coincide(t, p, negadas)) ||
      (familia !== "bateria" && (c.patronesSoloRed ?? []).some((p) => coincide(t, p, negadas))),
  );

  let riesgo: Riesgo = opciones.riesgoPropuesto ?? "bajo";
  for (const c of encontradas) if (ORDEN[c.nivel] > ORDEN[riesgo]) riesgo = c.nivel;

  const bloqueado = riesgo === "alto";
  const derivacion = bloqueado
    ? encontradas.map((c) => (familia === "bateria" && c.derivacionBateria) || c.derivacion).join(" ") ||
      "Este paso es peligroso para hacerlo en casa. Te recomiendo derivarlo a un técnico."
    : undefined;

  return { riesgo, bloqueado, clases: encontradas.map((c) => c.id), ...(derivacion ? { derivacion } : {}) };
}

/** Pedido de la persona (voz o texto), antes de mandarlo a la IA. */
export function evaluarPedido(texto: string, tipoEquipo?: string | null): Evaluacion {
  return evaluarRiesgo(texto, { ignorarNegadas: false, tipoEquipo });
}

/**
 * Filtro final de una coreografía que propuso la IA. Si es de riesgo alto, se
 * reemplaza por la derivación y se sacan las acciones (no se anima el paso).
 */
export function filtrarCoreografia(c: Coreografia, tipoEquipo?: string | null): { coreografia: Coreografia; evaluacion: Evaluacion } {
  const evaluacion = evaluarRiesgo(c.dice, { riesgoPropuesto: c.riesgo, ignorarNegadas: true, tipoEquipo });
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
