import { noPrende } from "../../../lib/intake/sintoma";
/**
 * Dónde más encontrar el modelo cuando el equipo no tiene etiqueta (o no se encuentra), según el
 * tipo de equipo. `alternativas` son cosas a las que se les puede sacar una foto para leer el
 * modelo como si fuera la etiqueta. Si no tiene ninguna, la persona sigue y lo escribe en la ficha.
 */

export type DondeModelo = { lugares: string[]; alternativas: string[] };

const CAJA = "La caja, la factura o el manual de usuario";

const POR_EQUIPO: { tipo: RegExp; donde: DondeModelo }[] = [
  {
    tipo: /aire|split/,
    donde: {
      lugares: [
        "La etiqueta de la unidad de afuera, al costado",
        "Adentro de la tapa del frente de la unidad de adentro",
        "El control remoto: atrás o adentro de la tapa de las pilas",
        CAJA,
      ],
      alternativas: ["La unidad de afuera", "El control remoto", "La caja o la factura"],
    },
  },
  {
    // Antes que el celular: "reloj inteligente" o "smartwatch" no son un teléfono.
    tipo: /reloj|smartwatch|\bwatch\b/,
    donde: {
      lugares: [
        "Atrás, grabado en letra chica en la caja del reloj, alrededor del sensor",
        "En la app del celular con que lo usás (por ejemplo Watch o Galaxy Wearable), en la información del reloj",
        "La caja o la factura",
      ],
      alternativas: ["La parte de atrás del reloj", "La app del reloj en el celular", "La caja o la factura"],
    },
  },
  {
    tipo: /celular|tel[eé]fono|iphone|tablet|ipad/,
    donde: {
      lugares: [
        "Atrás, grabado en letra chica (en un iPhone o un iPad dice «Model A…»)",
        "iPhone o iPad: Ajustes > General > Información",
        "Android: Ajustes > Acerca del teléfono (o de la tablet)",
        "La caja o la factura",
      ],
      alternativas: ["La parte de atrás", "La pantalla de Ajustes", "La caja o la factura"],
    },
  },
  {
    tipo: /notebook|laptop|macbook/,
    donde: {
      lugares: [
        "Windows: Configuración > Sistema > Acerca de",
        "Mac: menú Apple > Acerca de esta Mac",
        "Debajo de la batería, si se puede sacar sin herramientas",
        CAJA,
      ],
      alternativas: ["La pantalla de «Acerca de»", "La caja o la factura"],
    },
  },
  {
    tipo: /heladera|freezer/,
    donde: {
      lugares: ["La pared de adentro, al costado o detrás del cajón de las verduras", "Atrás, abajo", CAJA],
      alternativas: ["La etiqueta de atrás", "La caja o la factura"],
    },
  },
  {
    tipo: /lavarropas|lavadora|secarropas/,
    donde: {
      lugares: ["El marco de la puerta", "Detrás de la tapita del filtro, abajo adelante", "Atrás", CAJA],
      alternativas: ["La etiqueta de atrás", "La caja o la factura"],
    },
  },
  {
    tipo: /tele|tv|monitor/,
    donde: {
      lugares: ["Atrás, cerca de las entradas", "En el menú: Configuración > Información o Acerca de", CAJA],
      alternativas: ["La pantalla del menú «Información»", "La caja o la factura"],
    },
  },
];

const GENERAL: DondeModelo = {
  lugares: ["Atrás o abajo del equipo", "Adentro de alguna tapa o puerta", CAJA],
  alternativas: ["La caja o la factura"],
};

/** Lo que solo se ve con el equipo prendido (menús, Ajustes, la pantalla de Información). */
const CON_EL_EQUIPO_PRENDIDO = /ajustes|configuraci[oó]n|men[uú]|acerca de|pantalla de|pantalla del/i;

/**
 * Dónde más buscar el modelo, por tipo de equipo. Si el síntoma es que no prende, nada que necesite el
 * equipo prendido (#229, #255): un iPad que no enciende no puede mostrar Ajustes > Información.
 */
export function dondeBuscarModelo(tipoEquipo: string | null | undefined, sintoma?: string | null): DondeModelo {
  const tipo = (tipoEquipo ?? "").toLowerCase();
  const donde = POR_EQUIPO.find((e) => e.tipo.test(tipo))?.donde ?? GENERAL;
  if (!noPrende(sintoma)) return donde;
  return {
    lugares: donde.lugares.filter((l) => !CON_EL_EQUIPO_PRENDIDO.test(l)),
    alternativas: donde.alternativas.filter((a) => !CON_EL_EQUIPO_PRENDIDO.test(a)),
  };
}
