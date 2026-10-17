import { z } from "zod";
import { EstadoDato } from "../../shared";
import { COMPRAS } from "./config";

/** Contratos de /api/compras — dueño: Diego. Viven acá (no en shared/) porque solo los usa este módulo y la pantalla 6. */

export const PedidoCompra = z.object({
  /** Id de la pieza del knowledge pack, ej. "ventilador". */
  pieza: z.string().min(1).max(80),
  /** FRU del knowledge pack. Sin él solo se puede verificar por modelo. */
  numeroParte: z.string().max(60).nullable().optional(),
  modelo: z.string().min(1).max(120),
  marca: z.string().max(60).nullable().optional(),
  casoId: z.string().min(1).optional(),
});
export type PedidoCompra = z.infer<typeof PedidoCompra>;

export const Moneda = z.enum(["UYU", "USD"]);

/** Lo que propone el agente. Nada de esto se cree sin pasar por verificar.ts. */
export const Propuesta = z.object({
  cotizacion: z.object({ uyuPorUsd: z.number().positive(), url: z.string() }).nullable(),
  candidatos: z
    .array(
      z.object({
        url: z.string(),
        titulo: z.string(),
        tienda: z.string(),
        precio: z.number().positive(),
        moneda: Moneda,
        /** null = no se sabe; 0 = gratis. */
        envio: z.number().min(0).nullable(),
        /** false = la publicación dice que no envía a Uruguay. */
        llegaAUruguay: z.boolean().nullable(),
      }),
    )
    .max(COMPRAS.candidatosMax),
});
export type Propuesta = z.infer<typeof Propuesta>;

/** Cómo se verificó la compatibilidad. "no_verificado" = ni el número de parte ni el modelo aparecen en el aviso. */
export const Compatibilidad = z.enum(["numero_parte", "modelo", "no_verificado"]);
export type Compatibilidad = z.infer<typeof Compatibilidad>;

export const OpcionCompra = z.object({
  url: z.url({ protocol: /^https?$/ }),
  titulo: z.string(),
  tienda: z.string(),
  compatibilidad: Compatibilidad,
  precio: z.object({ monto: z.number().positive(), moneda: Moneda, estado: EstadoDato }),
  envio: z.object({ monto: z.number().min(0).nullable(), estado: EstadoDato }),
  /** Precio + envío en pesos uruguayos; null si está en dólares y no hay cotización. */
  totalUyu: z.number().positive().nullable(),
});
export type OpcionCompra = z.infer<typeof OpcionCompra>;

export const Costo = z.object({
  modelo: z.string(),
  tokensEntrada: z.number().int().min(0),
  tokensSalida: z.number().int().min(0),
  busquedas: z.number().int().min(0),
  usd: z.number().min(0),
});
export type Costo = z.infer<typeof Costo>;

export const ResultadoCompras = z.object({
  opciones: z.array(OpcionCompra).max(COMPRAS.opciones),
  cotizacion: z.object({ uyuPorUsd: z.number().positive(), url: z.string() }).nullable(),
  /** Por qué se descartó cada candidato (para el feed y para depurar). */
  descartados: z.array(z.string()),
  costo: Costo,
});
export type ResultadoCompras = z.infer<typeof ResultadoCompras>;
