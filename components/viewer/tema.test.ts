import { describe, expect, it } from "vitest";
import { ACTIVO_RESPALDO, colorActivoDesde } from "./tema";

const leerDe = (vars: Record<string, string>) => (v: string) => vars[v] ?? "";

describe("colorActivoDesde (resaltado del 3D desde las variables CSS)", () => {
  it("con --dato (estilo Sayso) resalta en cian", () => {
    expect(colorActivoDesde(leerDe({ "--dato": " #4fd1e0 ", "--acento": "#ffb020" }))).toBe("#4fd1e0");
  });

  it("sin --dato resalta con el acento; sin variables, el naranja de antes", () => {
    expect(colorActivoDesde(leerDe({ "--acento": "#ff6a2b" }))).toBe("#ff6a2b");
    expect(colorActivoDesde(leerDe({}))).toBe(ACTIVO_RESPALDO);
  });
});
