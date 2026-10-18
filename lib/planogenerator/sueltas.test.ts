import { describe, expect, it } from "vitest";
import { fichaEjemplo, PlanoDePiezas, type KnowledgePack, type PiezaPlano } from "../../shared";
import type { LlamarIA } from "../ia/claude";
import { claveManual } from "../knowledge/manuales";
import { cachePlanosEnMemoria } from "./cache";
import { generarPlano } from "./generador";
import { obtenerPlano } from "./obtener";
import { planoCelular, planoTelevisor } from "./plantillas/equipos";
import { sumarSueltas } from "./sueltas";

const pack = (ids: string[]): KnowledgePack => ({
  modelo: "Modelo X1",
  clase: "otro",
  verificado: false,
  fuentes: [{ doc: "guía pública" }],
  piezas: ids.map((id) => ({ id, nombre: id.replace(/_/g, " "), descripcion: "", ubicacion: "" })),
  pasos: [],
  advertencias: [],
  repuestos: [],
});
/** La IA que no puede ubicar nada: devuelve basura dos veces. */
const iaQueFalla: LlamarIA = async () => "no es json";

const caja = (p: PiezaPlano) => ({ min: p.pos.map((v, i) => v - p.dim[i] / 2), max: p.pos.map((v, i) => v + p.dim[i] / 2) });
const solape = (a: PiezaPlano, b: PiezaPlano) => {
  const [x, y] = [caja(a), caja(b)];
  return [0, 1, 2].reduce((v, i) => v * Math.max(0, Math.min(x.max[i], y.max[i]) - Math.max(x.min[i], y.min[i])), 1);
};
/** Dentro del lugar que ocupa el resto del plano (con un pelo de tolerancia por el redondeo). */
const adentro = (p: PiezaPlano, resto: PiezaPlano[]) => {
  const c = caja(p);
  return [0, 1, 2].every(
    (i) => c.min[i] >= Math.min(...resto.map((q) => caja(q).min[i])) - 0.01 && c.max[i] <= Math.max(...resto.map((q) => caja(q).max[i])) + 0.01,
  );
};

describe("piezas sueltas: lo que la guía nombra siempre está en el 3D", () => {
  it("un TV sin IA: las piezas del pack que el esqueleto no tiene se suman adentro, sin encimarse", async () => {
    const r = await generarPlano({ casoId: "c", knowledgePack: pack(["placa_principal", "ventilador", "receptor_infrarrojo"]), tipoEquipo: "televisor" }, iaQueFalla);
    expect(() => PlanoDePiezas.parse(r.plano)).not.toThrow();
    const ids = r.plano.piezas.map((p) => p.pieza);
    expect(ids).toEqual(expect.arrayContaining(["placa_principal", "ventilador", "receptor_infrarrojo"]));
    const resto = r.plano.piezas.filter((p) => !["ventilador", "receptor_infrarrojo"].includes(p.pieza));
    for (const id of ["ventilador", "receptor_infrarrojo"]) {
      const p = r.plano.piezas.find((q) => q.pieza === id)!;
      expect(p.padre).toBe("carcasa_televisor"); // "despiezar" la separa como a las demás
      expect(p.origen).toBe("plantilla");
      expect(adentro(p, resto), id).toBe(true);
      for (const q of resto.filter((q) => q.padre)) expect(solape(p, q), `${id} con ${q.pieza}`).toBe(0);
    }
    expect(r.avisos.join(" ")).toMatch(/ventilador.*hueco libre/);
  });

  it("toma el tamaño de su forma en la biblioteca, la variante del equipo, y entra en el espesor", () => {
    const { plano } = sumarSueltas(planoCelular, ["sensor_proximidad", "flex_carga"], ["celular"]);
    const sensor = plano.piezas.find((p) => p.pieza === "sensor_proximidad")!;
    [0.285, 1.1, 1.45].forEach((v, i) => expect([...sensor.dim].sort((a, b) => a - b)[i]).toBeCloseTo(v, 1)); // medidas reales del sensor (cm)
    const flex = plano.piezas.find((p) => p.pieza === "flex_carga")!; // sin forma: una caja chica, proporcional al equipo
    expect(Math.max(...flex.dim)).toBeLessThan(15.8 * 0.36);
    for (const p of [sensor, flex]) {
      expect(p.dim[1], p.pieza).toBeLessThanOrEqual(0.8 * 1.5); // lo fino va al espesor del celular, no parado
      expect(adentro(p, planoCelular.piezas), p.pieza).toBe(true);
    }
  });

  it("una forma más grande que el equipo se achica parejo (no se deforma) hasta entrar", () => {
    const { plano } = sumarSueltas(planoCelular, ["bateria_auxiliar"], []); // sin equipo: la de notebook, 26,7 cm
    const b = plano.piezas.find((p) => p.pieza === "bateria_auxiliar")!;
    const [chica, , grande] = [...b.dim].sort((x, y) => x - y);
    expect(grande).toBeLessThanOrEqual(15.8 * 0.35 + 0.01);
    expect(grande / chica).toBeCloseTo(26.7 / 0.724, 0); // misma proporción
  });

  it("si no falta nada, el plano no cambia", () => {
    const r = sumarSueltas(planoTelevisor, ["fuente", "placa_control"]);
    expect(r.plano).toBe(planoTelevisor);
    expect(r.avisos).toEqual([]);
  });

  it("un plano de la caché que no tenía una pieza la recibe al leerlo", async () => {
    const cache = cachePlanosEnMemoria();
    const kp = pack(["fuente", "ventilador"]);
    const clave = claveManual(fichaEjemplo.marca.valor, fichaEjemplo.modelo.valor!);
    await cache.set(clave, "", "", { plano: planoTelevisor, avisos: [], manualUrl: null, piezasPedidas: ["fuente", "ventilador"] });
    const r = await obtenerPlano({ casoId: "c", knowledgePack: kp, ficha: fichaEjemplo, tipoEquipo: "televisor" }, { cache, llamar: iaQueFalla });
    expect(r.desdeCache).toBe(true);
    expect(r.plano.piezas.some((p) => p.pieza === "ventilador")).toBe(true);
  });
});
