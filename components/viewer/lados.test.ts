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
    // Se arma desde atrás: lo de adentro, del lado de la tapa (abierto por la pantalla, la carcasa se ve translúcida).
    expect(lados.adentro).toBe("arriba");
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
    expect(lados.adentro).toBe("arriba");
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

describe("notebook abierta, mirada por el teclado (#232)", () => {
  const sinVentilador = equipos.planoNotebookSinVentilador;
  it.each([
    ["notebook genérica (plantilla)", planoNotebookBase],
    ["notebook sin ventilador (plantilla)", sinVentilador],
  ])("%s: arranca por el teclado (abajo), con la tapa de pantalla abriéndose hacia afuera", (_, plano) => {
    const lados = ladosDelPlano(plano)!;
    expect(lados.inicial).toBe("abajo");
    // Bisagra atrás (-z), tapa abajo: +110° sobre x la lleva hacia abajo (afuera) y atrás.
    expect(lados.bisagra).toEqual({ pieza: "carcasa_pantalla", grados: 110 });
    expect(lados.piezas.carcasa_pantalla).toBe("abajo");
    expect(lados.piezas.tapa_inferior).toBe("arriba");
    // La tapa y su panel no cuentan como "lo de adentro": sigue del lado de la tapa inferior.
    expect(lados.adentro).toBe("arriba");
  });

  it.each([
    ["notebook", ["bateria", "ventilador"]],
    ["notebook", ["tecla_p", "teclado_notebook", "pantalla"]],
    ["macbook air", ["bateria", "tecla_p"]],
  ])("%s armada por el generador (%j): con la tapa de pantalla y arranca por el teclado", async (tipo, ids) => {
    const plano = await esqueleto(tipo, ids);
    const lados = ladosDelPlano(plano)!;
    expect(lados.inicial).toBe("abajo");
    expect(lados.bisagra?.pieza).toBe("carcasa_pantalla");
    // Una sola pantalla, adentro de la tapa (también la que nombra el pack), y la tapa pegada al teclado.
    expect(plano.piezas.filter((p) => p.pieza.startsWith("pantalla")).map((p) => [p.pieza, p.padre])).toEqual([["pantalla", "carcasa_pantalla"]]);
    const tapa = plano.piezas.find((p) => p.pieza === "carcasa_pantalla")!;
    const resto = plano.piezas.filter((p) => !["carcasa_pantalla", "pantalla"].includes(p.pieza));
    expect(tapa.pos[1] + tapa.dim[1] / 2).toBeLessThanOrEqual(Math.min(...resto.map((p) => p.pos[1] - p.dim[1] / 2)));
  });

  it("la tapa se abre mirándola por el teclado, se cierra al darla vuelta para sacar la tapa inferior y vuelve a abrirse", () => {
    const lados = ladosDelPlano(sinVentilador)!;
    const ids = sinVentilador.piezas.map((p) => p.pieza);
    const abierta = (Math.PI * 110) / 180;
    const inicio = estadoInicial(ids, { tapa_inferior: "tapa", carcasa_pantalla: "tapa" }, lados);
    expect(inicio.piezas.carcasa_pantalla.rot[0]).toBeCloseTo(abierta);
    const volteada = aplicarAccion(inicio, { t: "rotar", pieza: "tapa_inferior", eje: "x", grados: -100 }, ctx).estado;
    expect(volteada.lado).toBe("arriba");
    expect(volteada.piezas.carcasa_pantalla.rot[0]).toBe(0);
    const cerrada = cerrar(volteada);
    expect(cerrada.lado).toBe("abajo");
    expect(cerrada.piezas.carcasa_pantalla.rot[0]).toBeCloseTo(abierta);
    expect(cerrada.piezas.tapa_inferior.rot).toEqual([0, 0, 0]);
    // Despiezada se mira del lado de lo de adentro (la tapa inferior): la de pantalla se cierra; armada, se abre.
    const despiezada = aplicarAccion(inicio, { t: "despiezar", cantidad: 1 }, ctx).estado;
    expect(despiezada.lado).toBe("arriba");
    expect(despiezada.piezas.carcasa_pantalla.rot[0]).toBe(0);
    expect(aplicarAccion(despiezada, { t: "despiezar", cantidad: 0 }, ctx).estado.piezas.carcasa_pantalla.rot[0]).toBeCloseTo(abierta);
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

  it.each([
    ["celular", equipos.planoCelular],
    ["tablet", equipos.planoTablet],
  ])("%s: despiezado se mira del lado de lo de adentro (arriba); armado vuelve a la pantalla (#188)", (_, plano) => {
    const despiezado = aplicarAccion(conLados(plano), { t: "despiezar", cantidad: 1 }, ctx).estado;
    expect(despiezado.lado).toBe("arriba");
    expect(aplicarAccion(despiezado, { t: "despiezar", cantidad: 0 }, ctx).estado.lado).toBe("abajo");
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
