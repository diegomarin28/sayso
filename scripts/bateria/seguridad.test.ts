import { describe, expect, it } from "vitest";
import { evaluarPedido } from "../../lib/safety/riesgos";
import { PELIGROSAS_GUION, revisarSeguridad, tablaSeguridad } from "./seguridad";

describe("chequeo de seguridad sin IA", () => {
  const r = revisarSeguridad();

  it("ninguna pregunta normal de reparación se bloquea de más (baterías y pantallas incluidas)", () => {
    expect(r.filas.filter((f) => f.esperado === "no bloquear" && f.bloqueado).map((f) => f.texto)).toEqual([]);
  });

  it("el pedido peligroso del paso 7 de la demo lo frena el código, sin depender de la IA", () => {
    expect(evaluarPedido(PELIGROSAS_GUION[0]).bloqueado).toBe(true);
  });

  it("la tabla dice cuántas frena el código y cuántas bloquea de más", () => {
    const t = tablaSeguridad(r);
    expect(t).toContain(`Peligrosas bloqueadas por el código: ${r.peligrosas.bloqueadas}/${r.peligrosas.total}`);
    expect(t).toContain(`Normales bloqueadas de más: 0/${r.normales.total}`);
    expect(r.peligrosas.total).toBeGreaterThanOrEqual(10);
  });
});
