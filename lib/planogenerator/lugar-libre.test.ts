import { describe, expect, it } from "vitest";
import { vistaEnImagen, type OrigenDato3D, type PiezaPlano, type PlanoDePiezas } from "../../shared";
import { sinPisarLoVisto } from "./lugar-libre";
import * as equipos from "./plantillas/equipos";
import { planoNotebookBase } from "./plantillas/notebook";

/**
 * #235: una pieza que no se vio (estimada o del esqueleto) no queda encima de una que se vio en el manual o en
 * una foto. Por tipo, con las plantillas: sin IA y sin marcas ni modelos.
 */
const conOrigen = (plano: PlanoDePiezas, origenes: Record<string, OrigenDato3D>, cambios: Record<string, Partial<PiezaPlano>> = {}): PlanoDePiezas => ({
  ...plano,
  piezas: plano.piezas.map((p) => ({ ...p, origen: origenes[p.pieza] ?? "plantilla", ...cambios[p.pieza] })),
});
const pieza = (plano: PlanoDePiezas, id: string) => plano.piezas.find((p) => p.pieza === id)!;
/** Se pisan en la planta (los ejes que se pasan). */
const pisan = (p: PiezaPlano, q: PiezaPlano, [a, b]: [number, number]) =>
  [a, b].every((e) => Math.min(p.pos[e] + p.dim[e] / 2, q.pos[e] + q.dim[e] / 2) - Math.max(p.pos[e] - p.dim[e] / 2, q.pos[e] - q.dim[e] / 2) > 0.05);
const adentro = (p: PiezaPlano, raiz: PiezaPlano, [a, b]: [number, number]) =>
  [a, b].every((e) => p.pos[e] - p.dim[e] / 2 >= raiz.pos[e] - raiz.dim[e] / 2 - 1e-6 && p.pos[e] + p.dim[e] / 2 <= raiz.pos[e] + raiz.dim[e] / 2 + 1e-6);
const PLANTA: [number, number] = [0, 2];

describe("sinPisarLoVisto", () => {
  it.each([
    // Tablet: la batería se vio en una foto, grande y corrida a la izquierda; la placa genérica quedaba encima.
    ["tablet", equipos.planoTablet, "bateria", { pos: [-2, 0.93, 1.5], dim: [12, 0.45, 15] }, "placa_madre"],
    // Celular: la batería se vio más abajo; la placa de carga del esqueleto quedaba encima.
    ["celular", equipos.planoCelular, "bateria", { pos: [0, 1.03, 4.5], dim: [5.6, 0.45, 8.6] }, "placa_carga"],
  ] as const)("%s: lo no visto que pisaba lo visto va al lugar libre más cercano, adentro del equipo", (_, base, vista, donde, pisada) => {
    const plano = conOrigen(base, { [vista]: "foto" }, { [vista]: donde as Partial<PiezaPlano> });
    expect(pisan(pieza(plano, pisada), pieza(plano, vista), PLANTA)).toBe(true);
    const r = sinPisarLoVisto(plano);
    const raiz = r.plano.piezas.find((p) => !p.padre)!;
    // Ninguna pieza no vista (fuera de la envoltura) pisa ya a la vista.
    for (const p of r.plano.piezas.filter((x) => x.padre && !vistaEnImagen(x.origen) && !/^(pantalla|tapa|marco)/.test(x.pieza))) {
      expect(pisan(p, pieza(r.plano, vista), PLANTA), p.pieza).toBe(false);
    }
    expect(adentro(pieza(r.plano, pisada), raiz, PLANTA)).toBe(true);
    // Lo visto no se movió; el espesor (y) de lo corrido tampoco.
    expect(pieza(r.plano, vista).pos).toEqual(pieza(plano, vista).pos);
    expect(pieza(r.plano, pisada).pos[1]).toBe(pieza(plano, pisada).pos[1]);
    expect(r.avisos.join(" ")).toMatch(new RegExp(`"${pisada}" no se ve.*se corre al lugar libre más cercano`));
  });

  it("televisor (parado): la planta es la cara grande (x-y); la profundidad no cambia", () => {
    const base = equipos.planoTelevisor;
    const fuente = pieza(base, "fuente");
    const placa = base.piezas.find((p) => p.padre && p.pieza.startsWith("placa"))!;
    // La placa se vio justo donde el esqueleto pone la fuente.
    const plano = conOrigen(base, { [placa.pieza]: "foto" }, { [placa.pieza]: { pos: [fuente.pos[0], fuente.pos[1], placa.pos[2]] } });
    const r = sinPisarLoVisto(plano);
    const caraTV: [number, number] = [0, 1];
    expect(pisan(pieza(r.plano, "fuente"), pieza(r.plano, placa.pieza), caraTV)).toBe(false);
    expect(pieza(r.plano, "fuente").pos[2]).toBe(fuente.pos[2]);
  });

  it("notebook: lo que va montado sobre una pieza vista se queda con ella; lo corrido se lleva lo suyo", () => {
    // El ventilador se vio; sus tornillos (hijos) se quedan encima. La placa no se vio pero tiene una vista encima: no se mueve.
    const plano = conOrigen(planoNotebookBase, { ventilador: "manual" });
    const r = sinPisarLoVisto(plano);
    expect(pieza(r.plano, "tornillos_ventilador").pos).toEqual(pieza(plano, "tornillos_ventilador").pos);
    expect(pieza(r.plano, "placa_madre").pos).toEqual(pieza(plano, "placa_madre").pos);
  });

  it("una pieza corrida se lleva a sus hijas", () => {
    const plano = conOrigen(planoNotebookBase, { bateria: "foto" }, { bateria: { pos: [1, 0.5, -4.5], dim: [10, 0.5, 6] } });
    const r = sinPisarLoVisto(plano);
    const antes = pieza(plano, "ventilador");
    const despues = pieza(r.plano, "ventilador");
    if (despues.pos[0] !== antes.pos[0] || despues.pos[2] !== antes.pos[2]) {
      const hija = pieza(r.plano, "tornillos_ventilador");
      const hijaAntes = pieza(plano, "tornillos_ventilador");
      expect(hija.pos[0] - hijaAntes.pos[0]).toBeCloseTo(despues.pos[0] - antes.pos[0]);
      expect(hija.pos[2] - hijaAntes.pos[2]).toBeCloseTo(despues.pos[2] - antes.pos[2]);
    }
  });

  it("sin nada visto, o con lo visto sin pisar, el plano queda igual", () => {
    const solo = conOrigen(equipos.planoTablet, {});
    expect(sinPisarLoVisto(solo).plano).toBe(solo);
    const visto = conOrigen(equipos.planoTablet, { camara_trasera: "foto" });
    expect(sinPisarLoVisto(visto).plano.piezas.map((p) => p.pos)).toEqual(visto.piezas.map((p) => p.pos));
  });

  it("una capa que ocupa medio equipo (o más) no se corre: no hay dónde", () => {
    const base = equipos.planoTelevisor;
    const capa = base.piezas.filter((p) => p.padre).sort((x, y) => y.dim[0] * y.dim[1] - x.dim[0] * x.dim[1])[0];
    const chica = base.piezas.find((p) => p.padre && p !== capa && !/^(pantalla|tapa|marco)/.test(p.pieza))!;
    const plano = conOrigen(base, { [chica.pieza]: "foto" }, { [chica.pieza]: { pos: [capa.pos[0], capa.pos[1], chica.pos[2]] } });
    expect(pieza(sinPisarLoVisto(plano).plano, capa.pieza).pos).toEqual(capa.pos);
  });
});
