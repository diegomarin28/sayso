import { describe, expect, it } from "vitest";
import { instruccionDeToma } from "./instruccion-foto";

describe("#315: qué hay que sacar (y contra qué juzga el control de calidad)", () => {
  const pedido = "Sacale una foto a la parte de atrás del reloj, donde está grabado el modelo.";

  it("con una alternativa elegida, es la alternativa y no el pedido original (2 variantes)", () => {
    expect(instruccionDeToma(pedido, "La caja o la factura")).toBe("Sacale una foto a la caja o la factura, que se lea el modelo.");
    expect(instruccionDeToma(pedido, "El control remoto")).toBe("Sacale una foto al control remoto, que se lea el modelo.");
    expect(instruccionDeToma(pedido, "Elementos de la caja")).toBe("Sacale una foto a elementos de la caja, que se lea el modelo.");
    expect(instruccionDeToma(pedido, "La caja o la factura")).not.toContain("parte de atrás");
  });

  it("sin alternativa (o vacía), es el pedido tal cual", () => {
    expect(instruccionDeToma(pedido)).toBe(pedido);
    expect(instruccionDeToma(pedido, "")).toBe(pedido);
    expect(instruccionDeToma(pedido, "   ")).toBe(pedido);
  });
});
