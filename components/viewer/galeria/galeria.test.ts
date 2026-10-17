import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Coreografia, PlanoDePiezas } from "../../../shared";
import { IndicePiezas, tipoPara } from "../../../lib/planogenerator/biblioteca";
import { prepararPaso } from "../paso";
import { FORMAS_EN_LA_BIBLIOTECA, GALERIA, pasoDespiece, pasoInicial } from "./galeria";

const indice = IndicePiezas.parse(JSON.parse(readFileSync("public/models/piezas/indice.json", "utf8")));
const nombres = Object.keys(indice.tipos);
/** Piezas de ejemplo sin forma a propósito: se ve la primitiva de respaldo. */
const SIN_FORMA = new Set(["sensor_temperatura", "magnetron", "plato_giratorio"]);

describe("galería del pitch (/lab/galeria)", () => {
  it("tiene los 7 equipos y los 6 dispositivos, sin repetir", () => {
    expect(GALERIA.map((e) => e.id)).toEqual([
      "notebook", "celular", "heladera", "aire", "televisor", "lavarropas", "microondas",
      "aspiradora", "secador", "impresora", "consola", "router", "cafetera",
    ]);
    expect(GALERIA.filter((e) => e.grupo === "dispositivos")).toHaveLength(6);
  });

  it.each(GALERIA.map((e) => [e.id, e] as const))("%s: el plano valida, tiene una sola raíz y el resto cuelga de piezas que existen", (_, e) => {
    expect(() => PlanoDePiezas.parse(e.plano)).not.toThrow();
    const ids = e.plano.piezas.map((p) => p.pieza);
    expect(new Set(ids).size).toBe(ids.length);
    expect(e.plano.piezas.filter((p) => !p.padre)).toHaveLength(1); // así "despiezar" separa todo
    for (const p of e.plano.piezas) if (p.padre) expect(ids, p.pieza).toContain(p.padre);
  });

  it.each(GALERIA.map((e) => [e.id, e] as const))("%s: cada pieza tiene su forma en la biblioteca (salvo las de respaldo)", (_, e) => {
    for (const p of e.plano.piezas) if (!SIN_FORMA.has(p.pieza)) expect(tipoPara(p.pieza, nombres), p.pieza).toBeDefined();
  });

  it("los dispositivos usan las piezas de su familia", () => {
    for (const e of GALERIA.filter((x) => x.grupo === "dispositivos")) {
      const deLaFamilia = e.plano.piezas.filter((p) => {
        const tipo = tipoPara(p.pieza, nombres);
        return tipo && nombres.some((n) => n.split("@")[0] === tipo && indice.tipos[n].familia === "dispositivos");
      });
      expect(deLaFamilia.length, e.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("despiezar / armar validan, pasan el filtro de seguridad y el televisor se ve de atrás", () => {
    const tv = GALERIA.find((e) => e.id === "televisor")!;
    const pasos = [pasoInicial(tv)!, ...[true, false].flatMap((d) => [pasoDespiece(d, tv), pasoDespiece(d, GALERIA[0])])];
    for (const c of pasos) {
      expect(() => Coreografia.parse(c)).not.toThrow();
      expect(prepararPaso(c, { casoId: "galeria" }).evaluacion.bloqueado).toBe(false);
    }
    const giro = { t: "rotar", pieza: "carcasa_televisor", eje: "y", grados: 180 };
    expect(pasoInicial(tv)!.acciones[0]).toEqual(giro);
    expect(pasoDespiece(true, tv).acciones[0]).toEqual(giro); // sigue de atrás al despiezar y al armar
    expect(pasoDespiece(false, tv).acciones[0]).toEqual(giro);
    expect(pasoInicial(GALERIA[0])).toBeNull();
    expect(pasoDespiece(true, GALERIA[0]).acciones.some((a) => a.t === "rotar")).toBe(false);
    expect(pasoDespiece(true).paso).not.toBe(pasoDespiece(true).paso); // cada uno es un paso nuevo
  });

  it("cuenta las formas de la biblioteca desde el índice", () => {
    expect(FORMAS_EN_LA_BIBLIOTECA).toBe(nombres.length);
  });
});
