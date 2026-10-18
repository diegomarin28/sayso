import { describe, expect, it } from "vitest";
import { evaluarPedido, filtrarCoreografia } from "./riesgos";

/**
 * Precauciones de la IA dentro de la guía ("si la batería está hinchada, no la uses"): se dicen y no cortan
 * la guía. Frases reales de las guías guardadas (pruebas reales del 17 y 18/10). Las acciones peligrosas,
 * aunque vengan con "si…" o "con cuidado", se siguen bloqueando, y los pedidos de la persona no cambian.
 */
const bloquea = (frase: string, tipoEquipo: string) =>
  filtrarCoreografia({ paso: 1, dice: frase, acciones: [], riesgo: "bajo" }, { tipoEquipo }).evaluacion.bloqueado;

describe("precauciones dentro de la guía", () => {
  it.each([
    ["notebook", "Si la batería está hinchada o dañada, reemplazala solo por una batería autorizada, porque otra batería podría incendiarse o explotar."],
    ["celular", "Si abrís el equipo, la batería pegada no se vuelve a usar."],
    ["tablet", "Si la batería está hinchada, tomá las precauciones adecuadas y no la uses si se ve deformada."],
    ["tablet", "Antes de desarmar, revisá si la batería está hinchada; si está hinchada, tomá precauciones especiales."],
  ])("%s: se dice y no corta la guía: %s", (tipo, frase) => {
    expect(bloquea(frase, tipo)).toBe(false);
  });

  it.each([
    ["televisor", "Ubicá la fuente cerca de la entrada de corriente y revisá si tiene capacitores hinchados, pérdida de líquido o un fusible quemado."],
    ["televisor", "Con el equipo apagado y desenchufado, mirá si algún capacitor tiene la tapa abultada; si lo ves, es el sospechoso."],
    ["microondas", "Si los microinterruptores y los fusibles están bien, la falla probable está en el magnetrón, el diodo o el capacitor de alta tensión."],
    ["celular", "Si la batería está hinchada, pinchala para desinflarla."],
    ["celular", "Si la batería está hinchada, abrila con cuidado."],
    ["celular", "Si la batería está hinchada, sacala haciendo palanca con un cuchillo, con cuidado."],
    ["celular", "La batería está hinchada: sacala con cuidado."],
    ["televisor", "Si ves capacitores hinchados, descargalos con un destornillador con cuidado."],
  ])("%s: se sigue bloqueando: %s", (tipo, frase) => {
    expect(bloquea(frase, tipo)).toBe(true);
  });

  it("lo que pide la persona se evalúa igual de estricto (sin excepción por 'si…')", () => {
    expect(evaluarPedido("Si la batería está hinchada, ¿la puedo seguir usando con cuidado?", { tipoEquipo: "celular" }).bloqueado).toBe(true);
  });
});
