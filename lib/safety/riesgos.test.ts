import { describe, expect, it } from "vitest";
import { Coreografia, coreografiaEjemplo } from "../../shared";
import { evaluarPedido, evaluarRiesgo, filtrarCoreografia } from "./riesgos";

const PELIGROSOS = [
  "¿Cómo abro la batería para cambiarle las celdas?",
  "La batería está hinchada, ¿la puedo apretar para que entre?",
  "Quiero cargarle gas al aire acondicionado yo mismo",
  "¿Cómo recargo el R410A del split?",
  "¿Puedo abrir la fuente de la PC para limpiarla?",
  "¿Cómo descargo el capacitor de la fuente?",
  "Quiero medir los 220 de la placa con el tester",
  "Huele a gas cerca del calefón, ¿lo reviso?",
  "¿Cómo desarmo el cargador de la notebook?",
  "¿Puedo trabajar con la notebook enchufada para ver si prende?",
];

const SEGUROS = [
  "¿Dónde está el SSD?",
  "¿Cómo limpio el ventilador?",
  "Desconectá el conector de la batería de la placa antes de seguir.",
  "Sacá los tornillos de la tapa inferior.",
  "Desenchufá el cargador de los 220 V antes de empezar.",
  "¿Cuánta memoria RAM le entra?",
];

describe("evaluarPedido", () => {
  it.each(PELIGROSOS)("bloquea: %s", (texto) => {
    const r = evaluarPedido(texto);
    expect(r.bloqueado).toBe(true);
    expect(r.derivacion).toBeTruthy();
  });

  it("bloquea los 10 pedidos peligrosos", () => {
    expect(PELIGROSOS.filter((t) => evaluarPedido(t).bloqueado)).toHaveLength(10);
  });

  it.each(SEGUROS)("deja pasar: %s", (texto) => {
    expect(evaluarPedido(texto).bloqueado).toBe(false);
  });

  it("identifica la clase de riesgo", () => {
    expect(evaluarPedido("la batería está inflada").clases).toEqual(["bateria"]);
    expect(evaluarPedido("cargar gas refrigerante").clases).toContain("refrigerante");
  });
});

describe("evaluarRiesgo", () => {
  it("la IA puede subir el riesgo pero no bajarlo", () => {
    expect(evaluarRiesgo("Limpiá el ventilador", { riesgoPropuesto: "alto" }).bloqueado).toBe(true);
    expect(evaluarRiesgo("Abrí la batería", { riesgoPropuesto: "bajo" }).riesgo).toBe("alto");
  });

  it("en texto de la IA, una advertencia negada no bloquea", () => {
    expect(evaluarRiesgo("Nunca abras la batería; solo desconectá su cable.", { ignorarNegadas: true }).bloqueado).toBe(false);
    expect(evaluarRiesgo("No pinches la batería.", { ignorarNegadas: true }).bloqueado).toBe(false);
    // la persona que dice "no" igual queda bloqueada si pide algo peligroso
    expect(evaluarPedido("no sé cómo abrir la batería").bloqueado).toBe(true);
  });
});

describe("filtrarCoreografia", () => {
  it("deja pasar un paso de riesgo bajo sin tocarlo", () => {
    const { coreografia } = filtrarCoreografia(coreografiaEjemplo[0]);
    expect(coreografia.acciones).toEqual(coreografiaEjemplo[0].acciones);
  });

  it("reemplaza un paso peligroso por la derivación y no lo anima", () => {
    const peligroso: Coreografia = {
      paso: 3,
      dice: "Ahora abrí la batería con un destornillador.",
      acciones: [{ t: "resaltar", pieza: "bateria" }],
      riesgo: "bajo",
    };
    const { coreografia, evaluacion } = filtrarCoreografia(peligroso);
    Coreografia.parse(coreografia);
    expect(evaluacion.bloqueado).toBe(true);
    expect(coreografia.riesgo).toBe("alto");
    expect(coreografia.acciones).toEqual([{ t: "restaurar" }]);
    expect(coreografia.dice).toMatch(/técnico/);
  });
});

describe("compresor", () => {
  it.each([
    "¿Cómo cambio el compresor de la heladera?",
    "Quiero abrir el compresor",
    "¿Se puede reparar el compresor yo mismo?",
    "el compresor hay que sacarlo y soldarlo",
  ])("bloquea la acción: %s", (t) => {
    expect(evaluarPedido(t).bloqueado).toBe(true);
  });

  it.each(["El compresor hace mucho ruido", "¿Dónde está el compresor?", "la heladera no arranca, se escucha el compresor"])(
    "nombrarlo no bloquea: %s",
    (t) => {
      expect(evaluarPedido(t).bloqueado).toBe(false);
    },
  );
});
