import { z } from "zod";
import { Ficha, type Campo } from "../../shared";

/**
 * Confirmación y corrección de la ficha por la persona. Solo código, sin IA:
 * lo que la persona confirma o escribe pasa a "confirmado" con fuente "usuario".
 */

export const CAMPOS = ["marca", "modelo", "serie", "anio"] as const;
export const NombreCampo = z.enum(CAMPOS);
export type NombreCampo = z.infer<typeof NombreCampo>;

export const EntradaFicha = z.object({
  ficha: Ficha,
  /** Campos que la persona miró y dice que están bien tal cual. */
  confirmados: z.array(NombreCampo).default([]),
  /** Campos que la persona corrigió. Texto vacío o null = "no sé". */
  correcciones: z.partialRecord(NombreCampo, z.string().max(120).nullable()).default({}),
});
export type EntradaFicha = z.input<typeof EntradaFicha>;

function corregido(valor: string | null): Campo {
  const v = valor?.trim() || null;
  return v ? { valor: v, estado: "confirmado", fuente: "usuario" } : { valor: null, estado: "desconocido", fuente: "usuario" };
}

function confirmado(c: Campo): Campo {
  // No se puede confirmar un dato que no tenemos.
  if (c.valor === null) return c;
  return { ...c, estado: "confirmado", fuente: c.fuente === "usuario" ? "usuario" : `${c.fuente ?? "deducido"}+usuario` };
}

export type ResultadoFicha = {
  ficha: Ficha;
  /** Hay modelo confirmado: se puede buscar el manual. */
  listaParaPreparar: boolean;
  /** Campos que la persona cambió (para el feed). */
  cambiados: NombreCampo[];
};

export function aplicarConfirmacion(entrada: EntradaFicha): ResultadoFicha {
  const { ficha, confirmados, correcciones } = EntradaFicha.parse(entrada);
  const nueva = { ...ficha };
  const cambiados: NombreCampo[] = [];

  for (const nombre of CAMPOS) {
    if (nombre in correcciones) {
      const antes = ficha[nombre];
      nueva[nombre] = corregido(correcciones[nombre] ?? null);
      if (nueva[nombre].valor !== antes.valor) cambiados.push(nombre);
    } else if (confirmados.includes(nombre)) {
      nueva[nombre] = confirmado(ficha[nombre]);
    }
  }
  nueva.confirmadaPorUsuario = true;

  const final = Ficha.parse(nueva);
  return { ficha: final, listaParaPreparar: final.modelo.estado === "confirmado", cambiados };
}
