import { describe, expect, it } from "vitest";
import { pedidosSimulados } from "./pedidos-simulados";

const tipos = (t: string | null, s: string) => pedidosSimulados(t, s).map((p) => p.tipo);

describe("fotos a pedir en fixture: según el equipo", () => {
  it("una heladera no pide puertos, y la etiqueta está adentro", () => {
    const p = pedidosSimulados("heladera", "no enfría");
    expect(p.map((x) => x.tipo)).toEqual(["frente", "etiqueta"]);
    expect(p[1].instruccion).toMatch(/adentro/);
  });

  it("siempre pide el equipo entero y la etiqueta", () => {
    for (const t of ["notebook", "celular", "lavarropas", "aire acondicionado split", "equipo", null])
      expect(tipos(t, "hace ruido").slice(0, 2)).toEqual(["frente", "etiqueta"]);
  });

  it("los puertos solo si el equipo los tiene y el síntoma habla de carga o conexión", () => {
    expect(tipos("celular", "no carga")).toContain("puertos");
    expect(tipos("notebook", "el ventilador hace ruido")).not.toContain("puertos");
    expect(tipos("lavarropas", "no carga agua")).not.toContain("puertos");
  });

  it("la notebook avisa que hay que apagarla antes de darla vuelta", () => {
    expect(pedidosSimulados("notebook", "se apaga")[1].advertencia).toMatch(/Apagala/);
  });
});
