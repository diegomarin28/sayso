import { describe, expect, it } from "vitest";
import type { KnowledgePack, PlanoDePiezas } from "../../shared";
import type { LlamarIA } from "../../lib/ia/claude";
import { generarPlano } from "../../lib/planogenerator/generador";
import * as equipos from "../../lib/planogenerator/plantillas/equipos";
import { planoNotebookBase } from "../../lib/planogenerator/plantillas/notebook";
import { ladosDelPlano } from "./lados";
import { aplicarAccion, cerrar, estadoInicial } from "./reproductor";

/**
 * #233: los equipos acostados arrancan mirados por su cara de uso (como se los ve en la mano) y la cámara
 * va al lado de la tapa que se saca. Por TIPO, con dos variantes de cada uno (la plantilla y el esqueleto
 * que arma el generador sin IA).
 */
const iaQueFalla: LlamarIA = async () => "no es json";
const pack = (ids: string[]): KnowledgePack => ({
  modelo: "Equipo X",
  clase: "otro",
  verificado: false,
  fuentes: [{ doc: "guía pública" }],
  piezas: ids.map((id) => ({ id, nombre: id, descripcion: "", ubicacion: "" })),
  pasos: [],
  advertencias: [],
  repuestos: [],
});
const esqueleto = async (tipoEquipo: string, ids: string[]) => (await generarPlano({ casoId: "c", knowledgePack: pack(ids), tipoEquipo }, iaQueFalla)).plano;
const ctx = { casoId: "c" };

describe("ladosDelPlano (por tipo)", () => {
  it.each([
    ["celular (plantilla)", equipos.planoCelular],
    ["tablet (plantilla)", equipos.planoTablet],
  ])("%s: arranca por la pantalla (abajo) y la tapa de atrás está arriba", (_, plano) => {
    const lados = ladosDelPlano(plano)!;
    expect(lados.inicial).toBe("abajo");
    const tapa = Object.keys(lados.piezas).find((id) => id.startsWith("tapa"))!;
    expect(lados.piezas[tapa]).toBe("arriba");
  });

  it.each([
    ["celular", ["bateria", "placa_madre"]],
    ["celular", ["pantalla", "bateria", "camara_trasera"]],
    ["tablet", ["bateria", "placa_madre"]],
    ["tablet", ["pantalla", "bateria", "conector_carga"]],
  ])("%s armado por el generador (%j): arranca por la pantalla (abajo)", async (tipo, ids) => {
    const lados = ladosDelPlano(await esqueleto(tipo, ids))!;
    expect(lados.inicial).toBe("abajo");
    expect(Object.entries(lados.piezas).find(([id]) => id.startsWith("tapa"))?.[1]).toBe("arriba");
  });

  it.each([
    ["reloj cuadrado", equipos.planoReloj],
    ["reloj redondo", equipos.planoRelojRedondo],
  ])("%s: la pantalla arriba (como siempre) y el dorso abajo", (_, plano) => {
    const lados = ladosDelPlano(plano)!;
    expect(lados.inicial).toBe("arriba");
    expect(lados.piezas.tapa_reloj).toBe("abajo");
  });

  it.each([
    ["notebook genérica, sin teclado en el plano", planoNotebookBase],
    ["notebook sin ventilador (el teclado queda adentro de la base cerrada, #232)", equipos.planoNotebookSinVentilador],
    ["teclado suelto", equipos.planoTeclado],
    ["consola (tapa que envuelve todo)", equipos.planoConsola],
    ["batería externa", equipos.planoPowerBank],
    ["mouse", equipos.planoMouse],
  ])("%s: se sigue mirando desde arriba", (_, plano) => {
    expect(ladosDelPlano(plano)?.inicial ?? "arriba").toBe("arriba");
  });

  it.each([
    ["televisor", equipos.planoTelevisor],
    ["heladera", equipos.planoHeladera],
  ])("%s (parado): sin lados, se mira de frente", (_, plano) => {
    expect(ladosDelPlano(plano)).toBeUndefined();
  });
});

describe("el reproductor lleva la cámara al lado de la tapa", () => {
  const conLados = (plano: PlanoDePiezas) => estadoInicial(plano.piezas.map((p) => p.pieza), {}, ladosDelPlano(plano));

  it.each([
    ["celular", equipos.planoCelular],
    ["tablet", equipos.planoTablet],
  ])("%s: arranca abajo; sacar la tapa trasera la lleva arriba y mira el equipo entero; cerrar vuelve abajo", (_, plano) => {
    const inicio = conLados(plano);
    expect(inicio.lado).toBe("abajo");
    const conCamara = aplicarAccion(inicio, { t: "camara", objetivo: "tapa_trasera", zoom: 1.4 }, ctx).estado;
    const abierto = aplicarAccion(conCamara, { t: "ocultar", pieza: "tapa_trasera" }, ctx).estado;
    expect(abierto.lado).toBe("arriba");
    expect(abierto.camara).toEqual({ objetivo: "general", zoom: 1 });
    expect(cerrar(abierto).lado).toBe("abajo");
    expect(aplicarAccion(abierto, { t: "restaurar" }, ctx).estado.lado).toBe("abajo");
  });

  it("tablet: despegar la pantalla (se abre por adelante) deja la cámara abajo, del lado de la pantalla", () => {
    const r = aplicarAccion(conLados(equipos.planoTablet), { t: "desplazar", pieza: "pantalla", vec: [20, -1, 0] }, ctx).estado;
    expect(r.lado).toBe("abajo");
  });

  it("reloj: sacar el dorso lleva la cámara abajo", () => {
    const r = aplicarAccion(conLados(equipos.planoReloj), { t: "ocultar", pieza: "tapa_reloj" }, ctx).estado;
    expect(r.lado).toBe("abajo");
  });

  it("mover una pieza interna no gira la cámara", () => {
    const inicio = conLados(equipos.planoCelular);
    const r = aplicarAccion(inicio, { t: "desplazar", pieza: "bateria", vec: [0, 2, 0] }, ctx).estado;
    expect(r.lado).toBe("abajo");
    expect(r.camara).toEqual(inicio.camara);
  });
});

describe("mover la tapa que se está mirando", () => {
  it("tablet: despegar la pantalla que mira la cámara la lleva al equipo entero (del mismo lado)", () => {
    const plano = equipos.planoTablet;
    const inicio = estadoInicial(plano.piezas.map((p) => p.pieza), {}, ladosDelPlano(plano));
    const mirando = aplicarAccion(inicio, { t: "camara", objetivo: "pantalla", zoom: 1.1 }, ctx).estado;
    const r = aplicarAccion(mirando, { t: "desplazar", pieza: "pantalla", vec: [20, -1, 0] }, ctx).estado;
    expect(r.camara).toEqual({ objetivo: "general", zoom: 1 });
    expect(r.lado).toBe("abajo");
    expect(r.abierto).toBe(true);
  });
});
