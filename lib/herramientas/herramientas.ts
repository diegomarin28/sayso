/**
 * Herramientas de reparación que nombran los pasos (#230): qué es cada una, para qué sirve y cómo se usa,
 * en una línea para alguien que nunca la vio. Por TIPO de herramienta (los nombres con que aparece en los
 * manuales, las guías y el chat), nunca por equipo. Es conocimiento del oficio, como la tabla de seguridad:
 * no son resultados; dónde comprarla se busca (`busqueda`) en Mercado Libre o en un local.
 */

export type Herramienta = {
  id: string;
  /** Cómo se la nombra en la lista "Herramientas que necesitás". */
  nombre: string;
  /** Los nombres con que aparece en un paso (sin tildes, en minúsculas). */
  patron: RegExp;
  que: string;
  paraQue: string;
  como: string;
  /** Lo que se escribe para buscarla en una tienda. */
  busqueda: string;
};

export const HERRAMIENTAS: Herramienta[] = [
  {
    id: "iopener",
    nombre: "iOpener (bolsa térmica)",
    patron: /\biopener\b|\bbolsa (termica|de calor|de gel)\b/,
    que: "una bolsa con gel que se calienta en el microondas",
    paraQue: "ablandar el pegamento que sostiene la pantalla o la tapa",
    como: "Calentala unos 30 segundos y apoyala sobre el borde un par de minutos, sin que queme al tocarla",
    busqueda: "iopener bolsa termica reparacion celular",
  },
  {
    id: "pistola_calor",
    nombre: "Pistola de calor",
    // "secador" no: puede ser el equipo que se repara.
    patron: /\bpistola de calor\b|\bdecapador\b/,
    que: "un soplador de aire caliente",
    paraQue: "ablandar el pegamento de pantallas, tapas y baterías",
    como: "Pasala a 10 cm del borde, moviéndola siempre, hasta que el borde esté tibio, no caliente",
    busqueda: "pistola de calor electronica",
  },
  {
    id: "ventosa",
    nombre: "Ventosa",
    patron: /\bventosa\b/,
    que: "un disco de goma con manija que se pega por vacío",
    paraQue: "levantar un poco la pantalla o el vidrio para meter la púa",
    como: "Apoyala en una zona lisa, cerca del borde, apretá y tirá suave hacia arriba",
    busqueda: "ventosa reparacion pantalla celular",
  },
  {
    id: "pua",
    nombre: "Púa o espátula de plástico",
    patron: /\bpuas?\b|\bespatulas?\b|\bspudger\b|\bpalanca de plastico\b|\bherramienta de plastico\b|\btarjeta de plastico\b/,
    que: "una pieza fina de plástico, como una púa de guitarra o una espátula",
    paraQue: "abrir la separación entre piezas y soltar clips o pegamento sin rayar ni hacer contacto eléctrico",
    como: "Metela en la ranura que abrió la ventosa o el calor y deslizala por el borde, sin hacer palanca contra el vidrio",
    busqueda: "kit puas espatula plastico reparacion",
  },
  {
    id: "cinta",
    nombre: "Cinta adhesiva",
    patron: /\bcinta( adhesiva| de embalar| de papel| aislante| kapton)?\b|\btiras? adhesivas?\b/,
    que: "cinta común o de papel (o una tira adhesiva nueva, según el paso)",
    paraQue: "sujetar una pieza que se suelta, tapar una pantalla rota para no cortarte o volver a pegar",
    como: "Pegala firme y lisa; si es para levantar algo, dejá una punta doblada para tirar",
    busqueda: "cinta adhesiva doble faz reparacion",
  },
  {
    id: "destornillador_precision",
    nombre: "Destornilladores de precisión",
    patron: /\bdestornillador(es)?\b|\bphillips\b|\btorx\b|\bpentalobe\b|\btri-?wing\b|\bphillips? ?#?\d/,
    que: "destornilladores chicos con puntas intercambiables (Phillips, Torx, pentalobe)",
    paraQue: "sacar los tornillos chicos de celulares, notebooks y consolas",
    como: "Usá la punta que entra justa, apretá hacia abajo y girá despacio; separá los tornillos en orden",
    busqueda: "kit destornilladores precision torx pentalobe",
  },
  {
    id: "pinza",
    nombre: "Pinza de punta fina",
    patron: /\bpinzas?\b|\btweezers?\b/,
    que: "una pinza chica de punta fina",
    paraQue: "agarrar tornillos, cables planos y piezas chicas",
    como: "Agarrá la pieza sin apretar fuerte, sobre todo los cables planos",
    busqueda: "pinza punta fina electronica",
  },
  {
    id: "antiestatica",
    nombre: "Pulsera antiestática",
    patron: /\bantiestatic[oa]s?\b|\bpulsera\b.{0,15}\bestatic/,
    que: "una pulsera con cable que te conecta a tierra",
    paraQue: "que la electricidad estática de tu cuerpo no dañe las placas",
    como: "Ponétela en la muñeca y prendé el clip a una parte metálica sin pintura",
    busqueda: "pulsera antiestatica",
  },
  {
    id: "multimetro",
    nombre: "Multímetro (tester)",
    patron: /\bmultimetro\b|\btester\b/,
    que: "un aparato que mide tensión, corriente y continuidad",
    paraQue: "comprobar si llega corriente o si un cable o fusible está cortado",
    como: "Elegí la escala, tocá con las dos puntas los dos extremos y leé la pantalla; nunca en partes de 220 V si no sabés",
    busqueda: "multimetro digital tester",
  },
  {
    id: "alcohol_isopropilico",
    nombre: "Alcohol isopropílico",
    patron: /\balcohol isopropilico\b|\bisopropilico\b/,
    que: "un alcohol de limpieza que se evapora rápido y no deja agua",
    paraQue: "limpiar contactos, pegamento y pasta térmica vieja",
    como: "Mojá un hisopo o un paño, pasalo suave y esperá a que se seque antes de prender",
    busqueda: "alcohol isopropilico electronica",
  },
  {
    id: "pasta_termica",
    nombre: "Pasta térmica",
    patron: /\bpasta termica\b/,
    que: "una pasta gris que pasa el calor del procesador al disipador",
    paraQue: "que el procesador no se caliente de más después de abrir el disipador",
    como: "Limpiá la vieja, poné una gota del tamaño de un grano de arroz en el centro y cerrá el disipador encima",
    busqueda: "pasta termica procesador",
  },
  {
    id: "llave_allen",
    nombre: "Llave Allen",
    patron: /\bllaves? allen\b|\ballen\b|\bhexagonal\b/,
    que: "una llave en L de punta hexagonal",
    paraQue: "aflojar y apretar tornillos con cabeza hexagonal",
    como: "Metela entera en la cabeza del tornillo y girá con el lado largo para tener más fuerza",
    busqueda: "juego llaves allen",
  },
];

const sinTildes = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Las herramientas que nombra un texto, en el orden del catálogo y sin repetir. */
export function herramientasEn(texto: string): Herramienta[] {
  const t = sinTildes(texto);
  return HERRAMIENTAS.filter((h) => h.patron.test(t));
}

/** Qué es, para qué sirve y cómo se usa (sin el nombre: para debajo de su título). */
export function describir(h: Herramienta): string {
  return `Es ${h.que}; sirve para ${h.paraQue}. ${h.como}.`;
}

/** Una línea para quien nunca la vio, con el nombre adelante (para sumarla al texto de un paso). */
export function explicar(h: Herramienta): string {
  return `${h.nombre}: ${describir(h).replace(/^Es/, "es")}`;
}

/**
 * El texto del paso con la explicación de cada herramienta que nombra y que todavía no se explicó en esta
 * guía (`explicadas` se actualiza): así no se repite en cada paso.
 */
export function conExplicacion(texto: string, explicadas: Set<string>): string {
  const nuevas = herramientasEn(texto).filter((h) => !explicadas.has(h.id));
  for (const h of nuevas) explicadas.add(h.id);
  return nuevas.length ? `${texto} ${nuevas.map(explicar).join(" ")}` : texto;
}

/** Las herramientas que nombran los pasos de un caso (para "Herramientas que necesitás"). */
export function herramientasDePasos(pasos: ReadonlyArray<{ texto: string }>): Herramienta[] {
  const ids = new Set(pasos.flatMap((p) => herramientasEn(p.texto).map((h) => h.id)));
  return HERRAMIENTAS.filter((h) => ids.has(h.id));
}
