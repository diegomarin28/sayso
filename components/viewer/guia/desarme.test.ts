import { describe, expect, it } from "vitest";
import type { Accion, Coreografia, PlanoDePiezas } from "../../../shared";
import * as equipos from "../../../lib/planogenerator/plantillas/equipos";
import { planoNotebookBase } from "../../../lib/planogenerator/plantillas/notebook";
import { conDesarme } from "./desarme";

/** #233: el paso que saca una tapa (o la pantalla de una tablet) o sus tornillos desarma el mismo modelo. */
const paso = (dice: string, acciones: Accion[] = [], riesgo: Coreografia["riesgo"] = "bajo"): Coreografia => ({ paso: 1, dice, acciones, riesgo });
const movida = (c: Coreografia) => c.acciones.find((a) => a.t === "desplazar") as Extract<Accion, { t: "desplazar" }> | undefined;
const ocultas = (c: Coreografia) => c.acciones.flatMap((a) => (a.t === "ocultar" ? [a.pieza] : []));
const ancho = (plano: PlanoDePiezas) => Math.max(...plano.piezas.map((p) => p.pos[0] + p.dim[0] / 2)) - Math.min(...plano.piezas.map((p) => p.pos[0] - p.dim[0] / 2));

describe("conDesarme", () => {
  it.each([
    ["celular", equipos.planoCelular, "Sacá con cuidado la tapa trasera con la púa.", "tapa_trasera", 1],
    ["tablet", equipos.planoTablet, "Despegá la pantalla de a poco, empezando por un costado.", "pantalla", -1],
    ["notebook sin ventilador", equipos.planoNotebookSinVentilador, "Levantá la tapa inferior.", "tapa_inferior", 1],
    ["notebook genérica", planoNotebookBase, "Retirá la cubierta trasera.", "tapa_inferior", 1],
    ["reloj", equipos.planoReloj, "Abrí la tapa del reloj.", "tapa_reloj", -1],
  ])("%s: «%s» corre %s al costado y hacia afuera de su lado", (_, plano, dice, pieza, afuera) => {
    const r = movida(conDesarme(paso(dice, [{ t: "camara", objetivo: pieza, zoom: 1.4 }]), plano));
    expect(r?.pieza).toBe(pieza);
    expect(r!.vec[0]).toBeGreaterThan(ancho(plano));
    expect(Math.sign(r!.vec[1])).toBe(afuera);
  });

  it("los tornillos que se sacan se desvanecen: los que resalta el paso o, si no, todos", () => {
    const plano = planoNotebookBase;
    expect(ocultas(conDesarme(paso("Sacá los tornillos del ventilador.", [{ t: "resaltar", pieza: "tornillos_ventilador" }]), plano))).toEqual(["tornillos_ventilador"]);
    expect(ocultas(conDesarme(paso("Quitá los tornillos."), plano))).toEqual(["tornillos_ventilador"]);
  });

  it("nombrar la tapa sin sacarla, o sacar otra cosa de la tapa, no mueve nada", () => {
    for (const dice of ["Mirá la tapa trasera: tiene que estar entera.", "Sacá el tornillo de la tapa trasera.", "Desconectá la batería."]) {
      const c = paso(dice);
      expect(conDesarme(c, equipos.planoCelular).acciones.filter((a) => a.t === "desplazar"), dice).toEqual([]);
    }
  });

  it("si la guía ya mueve algo, o el paso está bloqueado, no se toca", () => {
    const ya = paso("Sacá la tapa trasera.", [{ t: "ocultar", pieza: "tapa_trasera" }]);
    expect(conDesarme(ya, equipos.planoCelular)).toBe(ya);
    const bloqueado = paso("Sacá la tapa trasera.", [], "alto");
    expect(conDesarme(bloqueado, equipos.planoCelular)).toBe(bloqueado);
  });

  it("un equipo parado (TV) no se desarma solo", () => {
    const c = paso("Sacá la tapa trasera.");
    expect(conDesarme(c, equipos.planoTelevisor)).toBe(c);
  });
});
