import type { PedidoDeFoto } from "../../../shared";

/**
 * Fotos a pedir en el modo fixture (sin IA), con las mismas reglas que la recepción real
 * (lib/intake/pedidos.ts): siempre la etiqueta, diciendo dónde suele estar en ESE equipo, y el
 * equipo entero. Los puertos, solo en equipos que tienen y si el síntoma habla de carga o conexión.
 */

const DONDE_ETIQUETA: { tipo: RegExp; donde: string; advertencia?: string }[] = [
  {
    tipo: /notebook|laptop|macbook/,
    donde: "Dala vuelta y sacale una foto de cerca a la etiqueta de abajo. Que se lean las letras.",
    advertencia: "Apagala y desenchufala antes de darla vuelta.",
  },
  {
    tipo: /celular|tel[eé]fono|iphone|tablet/,
    donde: "Sacale una captura o una foto a Ajustes > Acerca del teléfono, donde dice el modelo.",
  },
  { tipo: /heladera|freezer/, donde: "Abrí la puerta y sacale una foto a la etiqueta de la pared de adentro, al costado." },
  { tipo: /lavarropas|lavadora/, donde: "Buscá la etiqueta en el marco de la puerta o atrás y sacale una foto de cerca." },
  { tipo: /aire|split/, donde: "Sacale una foto de cerca a la etiqueta del costado de la unidad de adentro." },
  { tipo: /tele|tv|monitor/, donde: "Sacale una foto a la etiqueta de atrás, donde dice el modelo." },
  { tipo: /impresora/, donde: "Buscá la etiqueta atrás o adentro de la tapa y sacale una foto de cerca." },
];

/** Equipos que tienen puertos o conector de carga. */
const CON_PUERTOS = /notebook|laptop|macbook|celular|tel[eé]fono|iphone|tablet|tele|tv|monitor|consola/;
/** Síntomas en los que mirar los puertos ayuda. */
const SINTOMA_PUERTOS = /carg|usb|puerto|conect|enchuf|cable|hdmi/;

export function pedidosSimulados(tipoEquipo: string | null | undefined, sintoma: string): PedidoDeFoto[] {
  const tipo = (tipoEquipo ?? "").toLowerCase();
  const etiqueta = DONDE_ETIQUETA.find((e) => e.tipo.test(tipo));
  const pedidos: PedidoDeFoto[] = [
    {
      tipo: "frente",
      // Sin adjetivos que concuerden con el equipo ("entero/entera"): sirve para cualquiera.
      instruccion: `Sacá una foto de frente ${tipo && tipo !== "equipo" ? `a tu ${tipo}` : "al equipo"}, con todo el equipo a la vista.`,
    },
    {
      tipo: "etiqueta",
      instruccion: etiqueta?.donde ?? "Buscá la etiqueta con la marca y el modelo y sacale una foto de cerca.",
      ...(etiqueta?.advertencia ? { advertencia: etiqueta.advertencia } : {}),
    },
  ];
  if (CON_PUERTOS.test(tipo) && SINTOMA_PUERTOS.test(sintoma.toLowerCase()))
    pedidos.push({ tipo: "puertos", instruccion: "Ahora una foto de cerca del conector de carga o de los puertos." });
  return pedidos;
}
