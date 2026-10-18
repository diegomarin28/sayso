import { describe, expect, it } from "vitest";
import { chatComoTexto, puntosVisibles, type MensajeChat } from "./conversacion";

describe("#227: exportar la conversación como texto", () => {
  const mensajes: MensajeChat[] = [
    { rol: "persona", texto: "¿Dónde está el ventilador?", id: 1 },
    {
      rol: "experto",
      id: 2,
      c: {
        paso: 1,
        dice: "Ventilador: sobre el disipador, a la derecha del procesador.",
        cita: { doc: "Manual de mantenimiento", pagina: 54, estado: "VERIFICADO" },
        acciones: [],
        riesgo: "bajo",
      },
    },
    { rol: "experto", id: 3, c: { paso: 2, dice: "Aflojá los dos tornillos.", acciones: [], riesgo: "bajo" } },
  ];

  it("una línea por mensaje: «Vos:» y «Experto:», con la página citada", () => {
    expect(chatComoTexto(mensajes)).toBe(
      "Vos: ¿Dónde está el ventilador?\n\n" +
        "Experto: Ventilador: sobre el disipador, a la derecha del procesador. (Manual de mantenimiento, p. 54)\n\n" +
        "Experto: Aflojá los dos tornillos.",
    );
  });

  it("sin mensajes, texto vacío", () => {
    expect(chatComoTexto([])).toBe("");
  });
});

describe("puntos de paso en guías largas", () => {
  it("con pocos pasos están todos", () => {
    expect(puntosVisibles(5, 2)).toEqual([0, 1, 2, 3, 4]);
  });
  it("con 48 pasos hay 9 puntos y el actual queda adentro, en el medio", () => {
    expect(puntosVisibles(48, 20)).toEqual([16, 17, 18, 19, 20, 21, 22, 23, 24]);
  });
  it("en los extremos la ventana no se sale de la guía", () => {
    expect(puntosVisibles(48, 0)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(puntosVisibles(48, 47)).toEqual([39, 40, 41, 42, 43, 44, 45, 46, 47]);
  });
});
