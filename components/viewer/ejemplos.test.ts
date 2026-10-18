import { describe, expect, it } from "vitest";
import { Coreografia, PlanoDePiezas } from "../../shared";
import { EJEMPLOS, coreografiaHeladera, coreografiaImpresoraLaser, planoHeladera } from "./ejemplos";
import { prepararEscena } from "./escena";
import { conDesarme } from "./guia/desarme";
import { prepararPaso } from "./paso";
import { OBJETIVO_GENERAL, aplicarCoreografia, estadoInicial } from "./reproductor";

const ctx = { casoId: "lab" };

describe("ejemplos del lab", () => {
  it("planos y coreografías validan con los contratos y solo nombran piezas del plano", () => {
    for (const [nombre, e] of Object.entries(EJEMPLOS)) {
      expect(() => PlanoDePiezas.parse(e.plano), nombre).not.toThrow();
      const ids = new Set(e.plano.piezas.map((p) => p.pieza));
      for (const c of e.coreografia ?? []) {
        expect(() => Coreografia.parse(c)).not.toThrow();
        for (const a of c.acciones) {
          const id = "pieza" in a ? a.pieza : a.t === "camara" ? a.objetivo : null;
          if (id && id !== OBJETIVO_GENERAL) expect(ids.has(id), `${nombre} paso ${c.paso}: ${id}`).toBe(true);
        }
      }
    }
  });

  it("heladera: oculta las dos puertas, gira la heladera entera y termina con la cámara en el compresor", () => {
    let estado = estadoInicial(planoHeladera.piezas.map((p) => p.pieza));
    for (const c of coreografiaHeladera) {
      const r = aplicarCoreografia(estado, c, ctx);
      expect(r.eventos).toEqual([]);
      estado = r.estado;
    }
    expect(estado.piezas.puerta_freezer.visible).toBe(false);
    expect(estado.piezas.puerta_heladera.visible).toBe(false);
    expect(estado.piezas.carcasa_heladera.rot[1]).toBeCloseTo(Math.PI);
    // Las demás piezas cuelgan de la carcasa: giran con ella.
    expect(planoHeladera.piezas.filter((p) => p.pieza !== "carcasa_heladera").every((p) => p.padre === "carcasa_heladera")).toBe(true);
    expect(estado.camara).toEqual({ objetivo: "compresor", zoom: 1.2 });
    expect(estado.piezas.compresor.resaltada).toBe(true);
  });

  it("impresora láser: abre la tapa de adelante, saca el tóner hacia el frente y termina en la unidad fusora", () => {
    const { plano } = EJEMPLOS.impresora_laser;
    let estado = estadoInicial(plano.piezas.map((p) => p.pieza), { carcasa_impresora: "raiz", puerta_frontal: "tapa" });
    for (const c of coreografiaImpresoraLaser) {
      const r = aplicarCoreografia(estado, c, ctx);
      expect(r.eventos).toEqual([]);
      estado = r.estado;
    }
    expect(estado.piezas.puerta_frontal.visible).toBe(false);
    expect(estado.abierto).toBe(true);
    // El cartucho sale por el frente (z), más allá de la carcasa.
    const carcasa = plano.piezas.find((p) => p.pieza === "carcasa_impresora")!;
    const cartucho = plano.piezas.find((p) => p.pieza === "cartucho_toner")!;
    expect(cartucho.pos[2] + estado.piezas.cartucho_toner.desp[2] - cartucho.dim[2] / 2).toBeGreaterThan(carcasa.dim[2] / 2);
    expect(estado.camara).toEqual({ objetivo: "unidad_fusora", zoom: 1.2 });
    expect(estado.piezas.unidad_fusora.resaltada).toBe(true);
    for (const c of coreografiaImpresoraLaser) expect(prepararPaso(c, ctx).evaluacion.bloqueado, `paso ${c.paso}`).toBe(false);
  });

  it("cada coreografía de ejemplo abre el equipo, pasa la seguridad con su tipo y termina con la pieza resaltada", () => {
    const conCoreografia = Object.entries(EJEMPLOS).filter(([, e]) => e.coreografia);
    expect(conCoreografia.map(([n]) => n).sort()).toEqual(["celular", "celular_por_pantalla", "heladera", "impresora_laser", "notebook", "tablet", "televisor"]);
    for (const [nombre, e] of conCoreografia) {
      const escena = prepararEscena(e.plano, undefined, e.tipoEquipo);
      let estado = estadoInicial(escena.nodos.keys(), escena.cubiertas, escena.lados);
      let ultima: Coreografia | undefined;
      // Como el lab y la guía: un paso que saca una tapa (o despega la pantalla) desarma el modelo (#233).
      for (const c of e.coreografia!.map((x) => conDesarme(x, e.plano))) {
        const preparado = prepararPaso(c, { ...ctx, tipoEquipo: e.tipoEquipo });
        // La heladera nombra el compresor a propósito: la tabla lo bloquea (ver coreografiaHeladera).
        if (!(nombre === "heladera" && c.paso === 3)) expect(preparado.evaluacion.bloqueado, `${nombre} paso ${c.paso}`).toBe(false);
        const r = aplicarCoreografia(estado, c, ctx);
        expect(r.eventos, `${nombre} paso ${c.paso}`).toEqual([]);
        estado = r.estado;
        ultima = c;
      }
      expect(estado.abierto, nombre).toBe(true);
      const resaltada = ultima!.acciones.find((a) => a.t === "resaltar");
      expect(resaltada && estado.piezas[resaltada.pieza].resaltada, nombre).toBe(true);
    }
  });

  it("los pasos que no nombran el compresor pasan el filtro de seguridad", () => {
    for (const c of coreografiaHeladera.slice(0, 2)) expect(prepararPaso(c, ctx).evaluacion.bloqueado, `paso ${c.paso}`).toBe(false);
  });
});
