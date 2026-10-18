import { describe, expect, it } from "vitest";
import { Coreografia, coreografiaEjemplo } from "../../shared";
import { alimentacionDe, evaluarPedido, evaluarRiesgo, filtrarCoreografia } from "./riesgos";

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
    "¿Cómo desconecto el compresor?",
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

describe("compresor en lo que dice el experto", () => {
  it("mostrarlo y advertir no corta la respuesta (paso 3 de la heladera en /lab/visor)", () => {
    const paso = "Abajo, atrás, está el compresor. No lo abras ni toques los caños: tienen gas a presión.";
    expect(evaluarRiesgo(paso, { ignorarNegadas: true }).bloqueado).toBe(false);
    expect(evaluarRiesgo("Cambiá el filtro. Atrás está el compresor.", { ignorarNegadas: true }).bloqueado).toBe(false);
  });

  it("indicar una acción sobre el compresor sí bloquea", () => {
    expect(evaluarRiesgo("Ahora desconectá el compresor y sacalo.", { ignorarNegadas: true }).bloqueado).toBe(true);
  });
});

describe("caños de gas", () => {
  it.each(["¿Puedo cortar los caños de cobre del split?", "Hay que soldar la cañería", "los caños hay que abrirlos para purgar"])(
    "bloquea la acción: %s",
    (t) => {
      expect(evaluarPedido(t).bloqueado).toBe(true);
    },
  );

  it("nombrarlos no bloquea", () => {
    expect(evaluarPedido("¿Por dónde pasan los caños?").bloqueado).toBe(false);
  });
});

describe("A9: el código frena sin IA los pedidos que antes se escapaban", () => {
  it.each([
    ["Quiero soldar la ficha de carga con la notebook enchufada", "electrico"],
    ["Siento olor a gas, ¿qué desarmo?", "gas"],
    ["¿Cómo hago un puente en el enchufe de 220?", "electrico"],
    ["¿Cómo pruebo la bomba conectándola directo a 220 V?", "electrico"],
    ["¿Cómo pruebo la resistencia enchufada a 220 V con la tapa abierta?", "electrico"],
    ["La batería se infló y levantó el vidrio, ¿cómo la saco y la cambio yo?", "bateria"],
  ])("%s", (texto, clase) => {
    const e = evaluarPedido(texto);
    expect(e.bloqueado).toBe(true);
    expect(e.clases).toContain(clase);
  });

  it.each([
    "Desenchufalo de los 220 V antes de abrirlo",
    "¿Cómo pruebo si la notebook carga?",
    "Probalo enchufado cuando termines, con la tapa cerrada",
    "Hacé un puente con la mano para sostener la placa",
    "¿Cómo cambio la batería del celular?",
    "¿El olor a quemado es del ventilador?",
  ])("no bloquea de más: %s", (texto) => {
    expect(evaluarPedido(texto).bloqueado).toBe(false);
  });
});

describe("A5: el aviso depende de cómo se alimenta el equipo (reglas por tipo, no por modelo)", () => {
  it.each([
    ["celular", "bateria"],
    ["iPhone 13", "bateria"],
    ["notebook", "bateria"],
    ["tablet", "bateria"],
    ["smart tv", "red"],
    ["televisor", "red"],
    ["heladera no frost", "red"],
    ["lavarropas", "red"],
    ["aire acondicionado split", "red"],
    ["equipo", "desconocida"],
    [null, "desconocida"],
  ])("%s → %s", (tipo, alimentacion) => {
    expect(alimentacionDe(tipo)).toBe(alimentacion);
  });

  it("sin tipo de la recepción, lo deduce del propio texto", () => {
    expect(alimentacionDe(null, "La batería del celular se infló")).toBe("bateria");
    expect(alimentacionDe(undefined, "El televisor hace un zumbido")).toBe("red");
  });

  it("celular con la batería inflada: aviso de batería de litio, sin 220 V ni capacitores", () => {
    const e = evaluarPedido("La batería se infló, ¿cómo la saco?", { tipoEquipo: "celular" });
    expect(e.bloqueado).toBe(true);
    expect(e.derivacion).toMatch(/litio/);
    expect(e.derivacion).toMatch(/no la perfores, no la dobles/i);
    expect(e.derivacion).not.toMatch(/220|capacitor/);
  });

  it("en un celular nombrar un capacitor de la placa no bloquea; en un TV sí", () => {
    const texto = "Despegá el flex que está al lado del capacitor";
    expect(evaluarPedido(texto, { tipoEquipo: "celular" }).bloqueado).toBe(false);
    const tv = evaluarPedido(texto, { tipoEquipo: "smart tv" });
    expect(tv.bloqueado).toBe(true);
    expect(tv.derivacion).toMatch(/desenchuf/i);
    expect(tv.derivacion).toMatch(/capacitores/);
  });

  it("notebook enchufada: el aviso dice que lo de 220 V es el cargador o el enchufe", () => {
    const e = evaluarPedido("Quiero soldar la ficha de carga con la notebook enchufada", { tipoEquipo: "notebook" });
    expect(e.bloqueado).toBe(true);
    expect(e.derivacion).toMatch(/cargador/);
    expect(e.derivacion).not.toMatch(/capacitores pueden guardar carga/);
  });

  it("si la IA marca alto sin clase, el aviso general sigue el tipo de equipo", () => {
    const paso = Coreografia.parse({ paso: 1, dice: "Calentá la parte de atrás para despegarla.", acciones: [], riesgo: "alto" });
    const celular = filtrarCoreografia(paso, { tipoEquipo: "celular" }).coreografia.dice;
    const tv = filtrarCoreografia(paso, { tipoEquipo: "televisor" }).coreografia.dice;
    expect(celular).toMatch(/batería de litio/);
    expect(tv).toMatch(/220 V/);
  });

  it("sin tipo conocido se comporta como antes (compatibilidad)", () => {
    const e = evaluarPedido("¿Cómo descargo los capacitores de la fuente?");
    expect(e.alimentacion).toBe("desconocida");
    expect(e.bloqueado).toBe(true);
  });
});

describe("un bloqueo que vuelve a pasar por el filtro conserva su aviso", () => {
  it("el visor re-filtra el paso bloqueado: el aviso del TV no se cambia por el general", () => {
    const pedido = evaluarPedido("¿Cómo pruebo la placa del televisor enchufado con la tapa abierta?");
    const bloqueo = Coreografia.parse({
      paso: 1,
      dice: `Acá frenamos. ${pedido.derivacion}`,
      acciones: [{ t: "restaurar" }],
      riesgo: "alto",
    });
    const r = filtrarCoreografia(bloqueo);
    expect(r.coreografia.dice).toBe(bloqueo.dice);
    expect(r.coreografia.dice).toMatch(/Desenchufá el equipo antes de tocar nada/);
    expect(r.evaluacion.bloqueado).toBe(true);
  });

  it("un paso normal de la IA que dice «Acá frenamos» pero no es riesgo alto se evalúa igual", () => {
    const paso = Coreografia.parse({
      paso: 1,
      dice: "Acá frenamos un momento. Abrí la batería con un destornillador.",
      acciones: [],
      riesgo: "bajo",
    });
    expect(filtrarCoreografia(paso).evaluacion.bloqueado).toBe(true);
  });
});
