import { describe, expect, it } from "vitest";
import { dondeBuscarModelo } from "./donde-modelo";
import { instruccionDeFoto } from "./instruccion-foto";

const etiqueta = { instruccion: "Dá vuelta el reloj y sacá una foto de cerca a la parte de atrás." };

describe("instrucción que recibe el control de calidad (#315)", () => {
  it("sin alternativa: la del pedido", () => {
    expect(instruccionDeFoto(etiqueta, {})).toBe(etiqueta.instruccion);
  });

  it("al elegir «La caja o la factura»: la de la caja, aunque la toma todavía no la tenga", () => {
    expect(instruccionDeFoto(etiqueta, {}, "La caja o la factura")).toBe(
      "Sacale una foto a la caja o la factura, que se lea el modelo.",
    );
  });

  it("al reintentar: la alternativa guardada en la toma", () => {
    expect(instruccionDeFoto(etiqueta, { alternativa: "La caja o la factura" })).toBe(
      "Sacale una foto a la caja o la factura, que se lea el modelo.",
    );
  });

  it("si se elige otra alternativa, gana la que se acaba de elegir", () => {
    expect(instruccionDeFoto(etiqueta, { alternativa: "La caja o la factura" }, "El control remoto")).toBe(
      "Sacale una foto al control remoto, que se lea el modelo.",
    );
  });

  it.each([
    ["reloj inteligente", "no prende"],
    ["celular", "se le rompió la pantalla"],
    ["aire acondicionado split", "no enfría"],
    ["notebook", "no carga"],
    ["microondas", "no calienta"],
    [null, undefined],
  ])("%s: cada alternativa se juzga contra sí misma, nunca contra la etiqueta", (tipo, sintoma) => {
    for (const a of dondeBuscarModelo(tipo, sintoma).alternativas) {
      const primera = instruccionDeFoto(etiqueta, {}, a);
      const reintento = instruccionDeFoto(etiqueta, { alternativa: a });
      expect(primera).toBe(reintento);
      expect(primera).not.toBe(etiqueta.instruccion);
      expect(primera.toLowerCase()).toContain(a.toLowerCase().replace(/^el /, ""));
    }
  });
});
