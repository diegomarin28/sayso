import { describe, expect, it } from "vitest";
import { conArticulo } from "./conversacion";

describe("sugerencias: artículo y número", () => {
  it("singular y plural, masculino y femenino", () => {
    expect(conArticulo("Ventilador")).toEqual({ texto: "el ventilador", plural: false });
    expect(conArticulo("Batería")).toEqual({ texto: "la batería", plural: false });
    expect(conArticulo("Tornillos del ventilador")).toEqual({ texto: "los tornillos del ventilador", plural: true });
    expect(conArticulo("Baterías")).toEqual({ texto: "las baterías", plural: true });
    expect(conArticulo("Parlantes")).toEqual({ texto: "los parlantes", plural: true });
    expect(conArticulo("Conexiones")).toEqual({ texto: "las conexiones", plural: true });
  });

  it("no confunde palabras que terminan en s con plurales", () => {
    expect(conArticulo("Gas refrigerante").plural).toBe(false);
    expect(conArticulo("Disco SSD")).toEqual({ texto: "el disco SSD", plural: false });
    expect(conArticulo("Mouse").plural).toBe(false);
  });

  it("femeninos que terminan en e (fuente, llave, base)", () => {
    expect(conArticulo("Fuente de alimentación")).toEqual({ texto: "la fuente de alimentación", plural: false });
    expect(conArticulo("Fuentes")).toEqual({ texto: "las fuentes", plural: true });
    expect(conArticulo("Llave térmica").texto).toBe("la llave térmica");
    expect(conArticulo("Motor").texto).toBe("el motor");
  });
});
