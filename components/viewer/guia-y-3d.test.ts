import { describe, expect, it } from "vitest";
import type { KnowledgePack } from "../../shared";
import type { LlamarIA } from "../../lib/ia/claude";
import { generarPlano } from "../../lib/planogenerator/generador";
import { prepararEscena } from "./escena";
import { aplicarAccion, estadoInicial, resolverPieza } from "./reproductor";

/**
 * Que la guía y el 3D hablen de lo mismo con guías reales (escritas por la IA): la pieza puede venir
 * nombrada de otra forma que en el plano, y la tapa con el nombre que le da el manual. Sin IA.
 */
const ctx = { casoId: "c" };

describe("resolverPieza: la pieza del plano aunque la guía la nombre de otra forma", () => {
  const ids = ["marco", "bateria_x21", "placa_madre", "conector_carga", "conector_bateria", "tapa_trasera"];
  it.each([
    ["bateria_x21", "bateria_x21"], // exacto
    ["Batería_X21", "bateria_x21"], // mayúsculas y tildes
    ["bateria", "bateria_x21"], // la única que empieza así
    ["placa_madre_x21", "placa_madre"], // lo nombrado empieza con una del plano
    ["placa madre", "placa_madre"], // con espacios
  ])("%s → %s", (nombrada, id) => {
    expect(resolverPieza(nombrada, ids)).toBe(id);
  });

  it("una tapa con el nombre del manual es la tapa del plano (si hay una sola)", () => {
    expect(resolverPieza("cubierta_trasera", ids)).toBe("tapa_trasera");
    expect(resolverPieza("carcasa_inferior", ids)).toBe("tapa_trasera");
    expect(resolverPieza("cubierta_trasera", [...ids, "tapa_bateria"])).toBeUndefined();
  });

  it("con dudas, ninguna: \"conector\" puede ser el de carga o el de la batería", () => {
    expect(resolverPieza("conector", ids)).toBeUndefined();
    expect(resolverPieza("ventilador", ids)).toBeUndefined();
  });

  it("aplicarAccion resalta y encuadra la pieza del plano, sin evento de pieza desconocida", () => {
    const e = estadoInicial(ids);
    const r = aplicarAccion(e, { t: "resaltar", pieza: "bateria" }, ctx);
    expect(r.evento).toBeUndefined();
    expect(r.estado.piezas.bateria_x21.resaltada).toBe(true);
    const c = aplicarAccion(e, { t: "camara", objetivo: "Batería", zoom: 2 }, ctx);
    expect(c.estado.camara.objetivo).toBe("bateria_x21");
    expect(aplicarAccion(e, { t: "resaltar", pieza: "conector" }, ctx).evento?.tipo).toBe("pieza_desconocida");
  });
});

const pack = (modelo: string, ids: string[]): KnowledgePack => ({
  modelo,
  clase: "otro",
  verificado: false,
  fuentes: [{ doc: "guía pública" }],
  piezas: ids.map((id) => ({ id, nombre: id.replace(/_/g, " "), descripcion: "", ubicacion: "" })),
  pasos: [],
  advertencias: [],
  repuestos: [],
});
const iaQueFalla: LlamarIA = async () => "no es json";

describe("abrir: la tapa con el nombre del manual abre el equipo (y no queda otra tapa cerrada)", () => {
  const TAPA = { celular: "tapa_trasera", notebook: "tapa_inferior" } as const;
  // Dos variantes por tipo; la tapa nombrada como la nombra cada manual.
  it.each([
    ["celular Samsung", "celular", "cubierta_trasera"],
    ["celular Motorola", "celular", "tapa_posterior"],
    ["notebook Lenovo", "notebook", "carcasa_inferior"],
    ["notebook HP", "notebook", "cubierta_inferior"],
  ])("%s: \"%s\" con \"%s\"", async (modelo, tipoEquipo, tapa) => {
    const r = await generarPlano({ casoId: "c", knowledgePack: pack(modelo, ["bateria", "placa_madre", tapa]), tipoEquipo }, iaQueFalla);
    // Una sola tapa, la del esqueleto (con su forma de la biblioteca): ni suelta ni repetida.
    const tapas = r.plano.piezas.filter((p) => p.padre && /^(tapa|cubierta)|^carcasa_inferior/.test(p.pieza));
    expect(tapas.map((p) => p.pieza)).toEqual([TAPA[tipoEquipo as keyof typeof TAPA]]);
    const escena = prepararEscena(r.plano);
    const inicio = estadoInicial(escena.nodos.keys(), escena.cubiertas);
    expect(inicio.abierto).toBe(false); // arranca cerrado
    // La guía la nombra como el manual y abre igual.
    const r2 = aplicarAccion(inicio, { t: "ocultar", pieza: tapa }, ctx);
    expect(r2.evento).toBeUndefined();
    expect(r2.estado.abierto).toBe(true);
  });
});
