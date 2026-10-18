import { describe, expect, it } from "vitest";
import { chatComoTexto, type MensajeChat } from "./conversacion";

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
