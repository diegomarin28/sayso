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
    tipo: /celular|tel[eé]fono|iphone|tablet|ipad/,
    donde: {
      lugares: [
        "iPhone: Ajustes > General > Información",
        "Android: Ajustes > Acerca del teléfono",
        "La caja o la factura",
      ],
      alternativas: ["La pantalla de Ajustes", "La caja o la factura"],
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

export function dondeBuscarModelo(tipoEquipo: string | null | undefined): DondeModelo {
  const tipo = (tipoEquipo ?? "").toLowerCase();
  return POR_EQUIPO.find((e) => e.tipo.test(tipo))?.donde ?? GENERAL;
}
