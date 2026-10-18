import { describe, expect, it } from "vitest";
import { PLANTILLAS_POR_TIPO } from "../planogenerator/plantillas/por-tipo";
import { alimentacionDe, evaluarPedido, filtrarCoreografia, PREFIJO_BLOQUEO, type Alimentacion } from "./riesgos";

/**
 * Avisos de seguridad en TODOS los tipos de equipo y de riesgo (pedido de Diego). Reglas por tipo, nunca
 * por modelo: cada tipo de la app se prueba con 2 variantes de cómo lo nombra la recepción.
 * Si se suma una plantilla nueva, este test pide que se diga cómo se alimenta ese tipo.
 */
const TIPOS: Record<string, { variantes: [string, string]; alimentacion: Alimentacion }> = {
  notebook: { variantes: ["notebook", "laptop"], alimentacion: "bateria" },
  notebook_sin_ventilador: { variantes: ["macbook air", "notebook sin ventilador"], alimentacion: "bateria" },
  celular: { variantes: ["celular", "smartphone"], alimentacion: "bateria" },
  heladera: { variantes: ["heladera no frost", "freezer"], alimentacion: "red" },
  aire: { variantes: ["aire acondicionado split", "split"], alimentacion: "red" },
  televisor: { variantes: ["smart tv", "televisor"], alimentacion: "red" },
  lavarropas: { variantes: ["lavarropas", "lavasecarropas"], alimentacion: "red" },
  microondas: { variantes: ["microondas", "horno microondas"], alimentacion: "red" },
  // Puede ser de cable o inalámbrica: aviso general (220 V y batería).
  aspiradora: { variantes: ["aspiradora", "aspirador"], alimentacion: "desconocida" },
  secador: { variantes: ["secador de pelo", "secador"], alimentacion: "red" },
  impresora: { variantes: ["impresora", "impresora de tinta"], alimentacion: "red" },
  impresora_laser: { variantes: ["impresora láser", "impresora laser color"], alimentacion: "red" },
  consola: { variantes: ["consola de videojuegos", "consola playstation"], alimentacion: "red" },
  router: { variantes: ["router", "módem"], alimentacion: "red" },
  cafetera: { variantes: ["cafetera", "cafetera espresso"], alimentacion: "red" },
  tablet: { variantes: ["tablet", "ipad"], alimentacion: "bateria" },
  auriculares: { variantes: ["auriculares bluetooth", "auricular"], alimentacion: "bateria" },
  auriculares_vincha: { variantes: ["auriculares de vincha", "auriculares headphones"], alimentacion: "bateria" },
  reloj: { variantes: ["reloj inteligente", "smartwatch"], alimentacion: "bateria" },
  // De cable (USB) o a pilas: aviso general.
  mouse: { variantes: ["mouse", "mouse inalámbrico"], alimentacion: "desconocida" },
  teclado: { variantes: ["teclado", "teclado mecánico"], alimentacion: "desconocida" },
  mando: { variantes: ["joystick", "control de playstation"], alimentacion: "bateria" },
  parlante: { variantes: ["parlante bluetooth", "parlante portátil"], alimentacion: "bateria" },
  cargador: { variantes: ["cargador", "cargador de celular"], alimentacion: "red" },
  // Pilas comunes: ni litio ni 220 V.
  control_remoto: { variantes: ["control remoto", "control remoto de la tele"], alimentacion: "desconocida" },
  powerbank: { variantes: ["batería externa", "power bank"], alimentacion: "bateria" },
  camara: { variantes: ["cámara de acción", "gopro"], alimentacion: "bateria" },
  afeitadora: { variantes: ["afeitadora", "máquina de afeitar"], alimentacion: "bateria" },
  planchita: { variantes: ["planchita de pelo", "alisadora"], alimentacion: "red" },
  cepillo: { variantes: ["cepillo eléctrico", "cepillo de dientes eléctrico"], alimentacion: "bateria" },
};

const CASOS = Object.entries(TIPOS).flatMap(([id, t]) => t.variantes.map((tipoEquipo) => ({ id, tipoEquipo, alimentacion: t.alimentacion })));

/** Un pedido de cada tipo de riesgo, y la palabra que tiene que estar en su aviso. */
const RIESGOS = [
  { clase: "bateria", pedido: "La batería está hinchada, ¿la puedo pinchar para desinflarla?", aviso: /litio/ },
  { clase: "refrigerante", pedido: "¿Cómo le cargo gas refrigerante yo mismo?", aviso: /técnico de refrigeración/ },
  { clase: "gas", pedido: "Huele a gas cerca del equipo, ¿qué toco?", aviso: /gasista/ },
  { clase: "electrico", pedido: "¿Cómo mido la fuente enchufada con la tapa abierta?", aviso: /220 V/ },
] as const;

/** El aviso eléctrico según cómo se alimenta el equipo. */
const AVISO_ELECTRICO: Record<Alimentacion, RegExp> = { red: /Desenchufá el equipo/, bateria: /cargador/, desconocida: /capacitores/ };

describe("seguridad por tipo de equipo", () => {
  it("cada tipo de equipo de la app tiene su forma de alimentarse definida acá", () => {
    expect(Object.keys(TIPOS).sort()).toEqual(PLANTILLAS_POR_TIPO.map((p) => p.id).sort());
  });

  it.each(CASOS)("$tipoEquipo: se alimenta a $alimentacion", ({ tipoEquipo, alimentacion }) => {
    expect(alimentacionDe(tipoEquipo)).toBe(alimentacion);
  });

  describe.each(CASOS)("$tipoEquipo", ({ tipoEquipo, alimentacion }) => {
    it.each(RIESGOS)("bloquea el riesgo $clase con su aviso", ({ clase, pedido, aviso }) => {
      const e = evaluarPedido(pedido, { tipoEquipo });
      expect(e.bloqueado).toBe(true);
      expect(e.clases).toContain(clase);
      expect(e.derivacion).toMatch(aviso);
      if (clase === "electrico") expect(e.derivacion).toMatch(AVISO_ELECTRICO[alimentacion]);
    });

    it("capacitores: se bloquean en todo lo que se enchufa (o si no se sabe); en uno a batería no son el peligro", () => {
      const e = evaluarPedido("¿Cómo descargo el capacitor de la placa con un destornillador?", { tipoEquipo });
      expect(e.bloqueado).toBe(alimentacion !== "bateria");
    });

    it("un paso de la IA marcado riesgo alto sin clase conocida se bloquea con el aviso del tipo", () => {
      const { coreografia, evaluacion } = filtrarCoreografia({ paso: 1, dice: "Hacé esto con cuidado.", acciones: [{ t: "resaltar", pieza: "x" }], riesgo: "alto" }, { tipoEquipo });
      expect(evaluacion.bloqueado).toBe(true);
      expect(coreografia.dice.startsWith(PREFIJO_BLOQUEO)).toBe(true);
      expect(coreografia.acciones).toEqual([{ t: "restaurar" }]);
      expect(coreografia.dice).toMatch({ bateria: /batería de litio/, red: /220 V/, desconocida: /técnico/ }[alimentacion]);
    });

    it("un paso normal de la IA no se bloquea", () => {
      const { evaluacion } = filtrarCoreografia({ paso: 1, dice: "Limpiá el polvo con un pincel seco.", acciones: [], riesgo: "bajo" }, { tipoEquipo });
      expect(evaluacion.bloqueado).toBe(false);
    });
  });
});

describe("seguridad: casos que antes fallaban por tipo", () => {
  it("el cargador de un celular va a 220 V: descargar su capacitor se bloquea", () => {
    expect(evaluarPedido("¿Cómo descargo el capacitor?", { tipoEquipo: "cargador de celular" }).bloqueado).toBe(true);
  });

  it("la consola portátil es a batería; la de mesa, a 220 V", () => {
    expect(alimentacionDe("consola portátil")).toBe("bateria");
    expect(alimentacionDe("nintendo switch")).toBe("bateria");
    expect(alimentacionDe("consola de mesa")).toBe("red");
  });
});
