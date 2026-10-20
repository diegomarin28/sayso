import path from "node:path";
import { z } from "zod";
import type { Resultado } from "./puntuar";

export const LINEA_BASE = path.join("scripts", "benchmark3d", "linea-base.json");

/**
 * Línea de base: los puntajes de cada caso con el plano sin IA, y el peso y los triángulos (con el presupuesto
 * de la doc los puntajes de rendimiento no se mueven por un GLB que crece: el peso sí).
 */
export const LineaBase = z.record(
  z.string(),
  z.object({
    puntajes: z.object({ geometria: z.number(), posicion: z.number().nullable(), certeza: z.number(), evidencia: z.number(), rendimiento: z.number() }),
    bytes: z.number(),
    triangulos: z.number(),
  }),
);
export type LineaBase = z.infer<typeof LineaBase>;

export const lineaBaseDe = (rs: Resultado[]): LineaBase =>
  Object.fromEntries(rs.map((r) => [r.tipo, { puntajes: r.puntajes, bytes: r.detalle.rendimiento.bytes, triangulos: r.detalle.rendimiento.triangulos }]));

/** Cuánto puede crecer el peso o los triángulos sin avisar. */
export const CRECIMIENTO_TOLERADO = 0.1;

const celda = (v: number | null) => (v === null ? "—" : String(v));

/** Los ejes con la forma errada más de un 25 % (ya sin la escala), ej. "y ×2.10" = el doble de grueso que lo real. */
function formaErrada(p: Resultado["detalle"]["proporciones"]): string[] {
  if (!p) return [];
  return (["x", "y", "z"] as const).flatMap((eje, i) => {
    const razon = p.plano[i] / p.escala / p.referencia[i];
    return Math.abs(Math.log(razon)) > Math.log(1.25) ? [`forma ${eje} ×${razon.toFixed(2)}`] : [];
  });
}

/** Tabla en markdown con un renglón por caso y lo que más resta de cada uno. */
export function tabla(rs: Resultado[]): string {
  const filas = rs.map((r) => {
    const p = r.puntajes;
    const d = r.detalle;
    const notas = [
      d.proporciones && `escala ×${d.proporciones.escala.toFixed(2)}`,
      ...formaErrada(d.proporciones),
      d.choques.length && `${d.choques.length} choques`,
      d.flotantes.length && `flotan: ${d.flotantes.join(", ")}`,
      d.faltantes.length && `faltan: ${d.faltantes.join(", ")}`,
      d.sinForma.length && `${d.sinForma.length} sin forma`,
      d.rendimiento.cerrado.cortado && "cerrado se corta",
      d.rendimiento.despiezado.cortado && "despiezado se corta",
      d.rendimiento.cerrado.chico && "cerrado chico",
      d.rendimiento.despiezado.chico && "despiezado chico",
      d.certeza.incoherencias.length && `${d.certeza.incoherencias.length} sin respaldo`,
    ].filter(Boolean);
    const espejo = d.posicionEspejada !== null && p.posicion !== null && d.posicionEspejada > p.posicion ? ` (espejado: ${d.posicionEspejada})` : "";
    return `| ${r.tipo}${r.modo === "guardado" ? " (caché)" : ""} | ${r.equipo} | ${p.geometria} | ${celda(p.posicion)}${espejo} | ${p.certeza} | ${p.evidencia} | ${p.rendimiento} | ${notas.join(" · ")} |`;
  });
  return [
    "| Tipo | Equipo de referencia | Geometría | Posición | Certeza | Evidencia | Rendimiento | Qué resta |",
    "|---|---|---|---|---|---|---|---|",
    ...filas,
  ].join("\n");
}

/**
 * Lo que empeoró respecto de la línea de base: un puntaje que bajó (con `tolerancia` puntos de margen) o un peso
 * o una cantidad de triángulos que creció más de `CRECIMIENTO_TOLERADO`. Un caso nuevo o que mejoró no cuenta.
 */
export function bajas(base: LineaBase, rs: Resultado[], tolerancia = 0): string[] {
  return rs.flatMap((r) => {
    const antes = base[r.tipo];
    if (!antes) return [];
    const puntajes = (Object.keys(antes.puntajes) as Array<keyof Resultado["puntajes"]>).flatMap((k) => {
      const [a, b] = [antes.puntajes[k], r.puntajes[k]];
      if (a === null) return [];
      if (b === null) return [`${r.tipo}: ${k} ya no se puede medir (era ${a})`];
      return b < a - tolerancia ? [`${r.tipo}: ${k} bajó de ${a} a ${b}`] : [];
    });
    const crece = (["bytes", "triangulos"] as const).flatMap((k) => {
      const [a, b] = [antes[k], r.detalle.rendimiento[k]];
      return b > a * (1 + CRECIMIENTO_TOLERADO) ? [`${r.tipo}: ${k} creció de ${a} a ${b}`] : [];
    });
    return [...puntajes, ...crece];
  });
}
