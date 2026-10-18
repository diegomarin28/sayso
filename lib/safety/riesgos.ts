import type { Coreografia, Riesgo } from "../../shared";

/**
 * Seguridad — dueño: Juanma.
 * Tabla FIJA de riesgos. La IA propone un nivel de riesgo, pero el código decide:
 * la IA puede subir el riesgo, nunca bajarlo. Riesgo alto = bloqueo y derivación a técnico.
 *
 * El riesgo y el aviso dependen de cómo se alimenta el equipo (hallazgo A5), con reglas por TIPO
 * de equipo, nunca por modelo: un celular o una notebook desenchufados son riesgo de batería de
 * litio; los equipos que se enchufan, de 220 V y capacitores.
 */

/** Cómo se alimenta el equipo: decide qué patrones aplican y qué aviso se da. */
export type Alimentacion = "bateria" | "red" | "desconocida";

/**
 * Tipos que deciden aunque nombren otro equipo: el cargador "de celular" va a 220 V (y tiene capacitores);
 * el joystick "de PlayStation" y la consola portátil, a batería; el control remoto "de la tele", a pilas.
 */
const PRIMERO: [RegExp, Alimentacion][] = [
  [/\b(cargador|fuente de alimentacion|transformador|adaptador de corriente)\b/, "red"],
  [/\b(joystick|gamepad|dualsense|dualshock|joy-?con|(mando|control|joystick) de (la )?(play|playstation|xbox|consola|nintendo))\b/, "bateria"],
  [/\b(consola portatil|nintendo switch|steam deck)\b/, "bateria"],
  // Pilas comunes: ni batería de litio ni 220 V.
  [/\bcontrol remoto\b/, "desconocida"],
];
/** Tipos de equipo que funcionan a batería (la carga es por un cargador aparte). */
const A_BATERIA =
  /\b(celular|telefono|smartphone|iphone|android|tablet|tableta|ipad|notebook|laptop|portatil|macbook|chromebook|netbook|smartwatch|reloj inteligente|auricular(es)?|airpods|earbuds|parlante (bluetooth|portatil|inalambrico)|kindle|e-?reader|bateria externa|power ?bank|camara (de accion|deportiva)|gopro|afeitadora|maquina de afeitar|maquinita|rasuradora|trimmer|cepillo (de dientes )?electrico|aspiradora (robot|inalambrica)|robot aspirador[a]?)\b/;
/** Tipos de equipo que se enchufan a la red (220 V). */
const A_RED =
  /\b(heladera|freezer|refrigerador|nevera|lavarropas|lavarropa|lavasecarropas|lavadora|lavavajillas|secarropas|aire|split|acondicionado|microondas|horno|cocina electrica|tv|televisor|tele|smart tv|monitor|pc de escritorio|computadora de escritorio|impresora|cafetera|licuadora|ventilador de pie|estufa|caloventor|termotanque|calefon electrico|plancha|planchita|alisadora|buclera|secador|equipo de musica|router|modem|consola|playstation|xbox|freidora|air fryer|tostadora|pava electrica)\b/;

/**
 * Alimentación a partir del tipo de equipo de la recepción (ej. "heladera no frost") o, si no
 * vino, del propio texto ("la batería del celular se infló"). Si no se reconoce, "desconocida".
 */
export function alimentacionDe(equipo?: string | null, texto = ""): Alimentacion {
  for (const t of [equipo ?? "", texto]) {
    const n = normalizar(t);
    if (!n.trim()) continue;
    const primero = PRIMERO.find(([re]) => re.test(n));
    if (primero) return primero[1];
    const bateria = A_BATERIA.test(n);
    const red = A_RED.test(n);
    if (bateria !== red) return bateria ? "bateria" : "red";
  }
  return "desconocida";
}

export type ClaseRiesgo = {
  id: "refrigerante" | "electrico" | "bateria" | "gas";
  nombre: string;
  nivel: Riesgo;
  /** Se buscan sobre el texto normalizado (minúsculas, sin tildes). */
  patrones: RegExp[];
  /** Solo para equipos que se enchufan (o si no se sabe): en uno a batería no son el peligro. */
  patronesDeRed?: RegExp[];
  /** El aviso; puede cambiar según cómo se alimenta el equipo. */
  derivacion: string;
  derivacionSegun?: Partial<Record<Alimentacion, string>>;
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
      // "desenchufá de los 220 V" es normal; tocar, medir o probar algo a 220 V no.
      /\b(toc|med|trabaj|empalm|pel|abr|prueb|prob)\w*\b.{0,30}\b220\b/,
      /\b220\s*v?\b.{0,30}\b(toc|med|trabaj|empalm)\w*/,
      // Conectar algo suelto "directo a 220 / a la red" (una bomba, una resistencia) para probarlo.
      /\bdirect\w* (a|al|en) (la |el )?(220|red|corriente|enchufe|toma(corriente)?)\b/,
      /\b(tension|corriente) de (red|linea)\b/,
      /\b(abr|desarm)\w*\b.{0,25}\b(la )?fuente\b/,
      /\b(abr|desarm)\w*\b.{0,25}\b(el )?(cargador|transformador)\b/,
      /\b(enchufad[oa]|conectad[oa] a la (red|corriente)|con (la )?corriente)\b.{0,40}\b(abr|toc|med|desarm|trabaj|sold|desmont)\w*/,
      /\b(abr|toc|med|desarm|trabaj|sold|desmont)\w*\b.{0,40}\b(enchufad[oa]|con (la )?corriente)\b/,
      // Enchufado y abierto a la vez ("enchufada a 220 V con la tapa abierta").
      /\benchufad[oa]\b.{0,40}\b(tapa abierta|abiert[oa]|destapad[oa]|sin (la )?tapa)\b/,
      /\b(tapa abierta|abiert[oa]|destapad[oa]|sin (la )?tapa)\b.{0,40}\benchufad[oa]\b/,
      /\bpuentear\b/,
      // "Hacer un puente" en la instalación (enchufe, tomacorriente, térmica, fusible).
      /\bpuente\b.{0,30}\b(enchufe|tomacorriente|toma|220|fusible|termica|disyuntor|llave)\b/,
    ],
    // En un celular o una notebook los capacitores de la placa no son el peligro (no van a 220 V).
    patronesDeRed: [
      /\bcapacitor|condensador(es)? (electrolitico|de arranque|de la fuente|de la placa)|\bdescargar\b.{0,20}\b(capacitor|condensador)/,
      /\bplaca de potencia\b/,
    ],
    derivacion:
      "Esto implica trabajar con tensión de red (220 V) o con capacitores que pueden guardar carga aunque el equipo esté desenchufado. Es peligroso: derivalo a un técnico.",
    derivacionSegun: {
      red: "Esto implica trabajar con tensión de red (220 V). Desenchufá el equipo antes de tocar nada, y ojo: los capacitores pueden guardar carga aunque esté desenchufado. Es peligroso: derivalo a un técnico.",
      bateria:
        "Lo que va a 220 V es el cargador o el enchufe, no el equipo: no abras el cargador ni trabajes con el equipo enchufado. Desenchufalo antes de abrirlo; si el problema es el cargador, derivalo a un técnico.",
    },
  },
  {
    id: "bateria",
    nombre: "Batería hinchada o abierta",
    nivel: "alto",
    patrones: [
      /\bbateria\b.{0,30}\b(hinchad|inflad|abombad|deformad|perforad|pinchad|quemad|caliente|humo|pierde|chorrea)/,
      /\b(hinchad|inflad|abombad)[oa]s?\b.{0,20}\bbateria\b/,
      // Verbo conjugado: "la batería se infló / se hinchó / se está inflando".
      /\bbateria\b.{0,30}\b(se )?(esta )?(hinch|infl|abomb)(o|aron|a|an|ando)\b/,
      /\b(abr|desarm|perfor|pinch|cort|romp)\w*\b.{0,15}\b(la |las )?(bateria|celdas?)\b/,
      /\bceldas? (de (la )?)?(bateria|litio)\b/,
      /\b(soldar|cortocircuit|puentear)\w*\b.{0,20}\bbateria\b/,
    ],
    derivacion:
      "Una batería de litio hinchada, dañada o abierta puede incendiarse. No la perfores, no la dobles, no la aprietes ni la calientes. Desconectá el equipo, dejalo en un lugar ventilado lejos de cosas que se quemen y llevalo a un técnico.",
  },
  {
    id: "gas",
    nombre: "Gas natural o envasado",
    nivel: "alto",
    patrones: [
      /\b(perdida|olor|fuga|escape) (de|a) gas\b/,
      /\bhuele a gas\b/,
      /\b(garrafa|gas natural|calefon|termotanque a gas|valvula de gas|llave de gas|quemador)\b/,
    ],
    derivacion:
      "Cualquier trabajo con gas lo tiene que hacer un gasista matriculado. Si hay olor a gas: no prendas luces ni fuego, ventilá, cerrá la llave de paso y llamá a la distribuidora.",
  },
];

const ORDEN: Record<Riesgo, number> = { bajo: 0, medio: 1, alto: 2 };

export function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
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
  /** Cómo se alimenta el equipo según el tipo (o el texto): decide los patrones y el aviso. */
  alimentacion: Alimentacion;
  /** Mensaje para la persona cuando está bloqueado. */
  derivacion?: string;
};

/** Aviso cuando la IA marcó riesgo alto pero ninguna clase de la tabla coincide. */
const DERIVACION_GENERAL: Record<Alimentacion, string> = {
  bateria:
    "Este paso puede dañar la batería de litio: perforarla, doblarla o calentarla puede incendiarla. Derivalo a un técnico.",
  red: "Este paso es peligroso: el equipo trabaja con 220 V y sus capacitores pueden guardar carga aunque esté desenchufado. Desenchufalo y derivalo a un técnico.",
  desconocida: "Este paso es peligroso para hacerlo en casa. Te recomiendo derivarlo a un técnico.",
};

/** Opciones comunes: el tipo de equipo de la recepción (texto libre, ej. "celular", "smart tv"). */
export type ConEquipo = { tipoEquipo?: string | null };

/**
 * Evalúa un texto (pedido de la persona o paso propuesto por la IA).
 * `riesgoPropuesto` es lo que dijo la IA: se usa solo si es MAYOR que el de la tabla.
 * `ignorarNegadas`: para texto de la IA, "no abras la batería" no bloquea.
 */
export function evaluarRiesgo(
  texto: string,
  opciones: { riesgoPropuesto?: Riesgo; ignorarNegadas?: boolean } & ConEquipo = {},
): Evaluacion {
  const t = normalizar(texto);
  const alimentacion = alimentacionDe(opciones.tipoEquipo, texto);
  const negadas = opciones.ignorarNegadas ?? false;
  const encontradas = TABLA_RIESGOS.filter(
    (c) =>
      c.patrones.some((p) => coincide(t, p, negadas)) ||
      (alimentacion !== "bateria" && (c.patronesDeRed ?? []).some((p) => coincide(t, p, negadas))),
  );

  let riesgo: Riesgo = opciones.riesgoPropuesto ?? "bajo";
  for (const c of encontradas) if (ORDEN[c.nivel] > ORDEN[riesgo]) riesgo = c.nivel;

  const bloqueado = riesgo === "alto";
  const derivacion = bloqueado
    ? encontradas.map((c) => c.derivacionSegun?.[alimentacion] ?? c.derivacion).join(" ") || DERIVACION_GENERAL[alimentacion]
    : undefined;

  return { riesgo, bloqueado, clases: encontradas.map((c) => c.id), alimentacion, ...(derivacion ? { derivacion } : {}) };
}

/** Pedido de la persona (voz o texto), antes de mandarlo a la IA. */
export function evaluarPedido(texto: string, opciones: ConEquipo = {}): Evaluacion {
  return evaluarRiesgo(texto, { ignorarNegadas: false, tipoEquipo: opciones.tipoEquipo });
}

/** Así empieza el texto de un paso bloqueado (lo usan también el chat y la guía simulada). */
export const PREFIJO_BLOQUEO = "Acá frenamos.";

/**
 * Filtro final de una coreografía que propuso la IA. Si es de riesgo alto, se
 * reemplaza por la derivación y se sacan las acciones (no se anima el paso).
 */
export function filtrarCoreografia(
  c: Coreografia,
  opciones: ConEquipo = {},
): { coreografia: Coreografia; evaluacion: Evaluacion } {
  const evaluacion = evaluarRiesgo(c.dice, {
    riesgoPropuesto: c.riesgo,
    ignorarNegadas: true,
    tipoEquipo: opciones.tipoEquipo,
  });
  // Un paso que ya es un bloqueo (lo armó la tabla antes) no se reescribe: si se volviera a derivar
  // desde su propio texto se perdería el aviso según el tipo de equipo (ese texto ya no nombra al equipo).
  if (c.riesgo === "alto" && c.dice.startsWith(PREFIJO_BLOQUEO)) {
    return {
      coreografia: { ...c, acciones: [{ t: "restaurar" }] },
      evaluacion: { ...evaluacion, riesgo: "alto", bloqueado: true },
    };
  }
  if (!evaluacion.bloqueado) {
    return { coreografia: { ...c, riesgo: evaluacion.riesgo }, evaluacion };
  }
  return {
    coreografia: {
      paso: c.paso,
      dice: `${PREFIJO_BLOQUEO} ${evaluacion.derivacion}`,
      acciones: [{ t: "restaurar" }],
      riesgo: "alto",
    },
    evaluacion,
  };
}
