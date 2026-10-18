import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { fichaEjemplo } from "../../shared";
import type { EnviarMensaje, LlamarIA } from "../ia/claude";
import { formasDePantallaDe } from "../planogenerator/plantillas/por-tipo";
import { armarKnowledgePack, type CachePacks } from "./armar";
import { parsearContenido } from "./lineas";
import { repoEnMemoria } from "./manuales";

/**
 * #246: el pack trae `formaPantalla` (cuadrada o redonda) de la misma lectura, sin IA extra, solo para los
 * tipos que tienen más de una forma. Es un dato de lo que encontró del modelo: nada por marca ni modelo.
 */

const linea = (texto: string) => ({ texto, citas: [] });

describe("línea FORMA", () => {
  it("se entiende en sus variantes y queda la primera", () => {
    expect(parsearContenido([linea("FORMA|redonda")], "doc").formaPantalla).toBe("redonda");
    expect(parsearContenido([linea("**FORMA|Circular**")], "doc").formaPantalla).toBe("redonda");
    expect(parsearContenido([linea("FORMA|cuadrada")], "doc").formaPantalla).toBe("cuadrada");
    expect(parsearContenido([linea("FORMA|rectangular con bordes redondeados")], "doc").formaPantalla).toBe("cuadrada");
    expect(parsearContenido([linea("FORMA|cuadrada"), linea("FORMA|redonda")], "doc").formaPantalla).toBe("cuadrada");
  });

  it("una forma que no es ninguna de las dos no se inventa", () => {
    const c = parsearContenido([linea("FORMA|no se sabe"), linea("FORMA|")], "doc");
    expect(c.formaPantalla).toBeUndefined();
    expect(c.descartadas).toHaveLength(2);
  });
});

describe("qué tipos la piden", () => {
  it("el reloj tiene dos formas (2 variantes del tipo); los demás, una", () => {
    expect(formasDePantallaDe("reloj inteligente").sort()).toEqual(["cuadrada", "redonda"]);
    expect(formasDePantallaDe("smartwatch").sort()).toEqual(["cuadrada", "redonda"]);
    expect(formasDePantallaDe("notebook")).toEqual([]);
    expect(formasDePantallaDe("celular")).toEqual([]);
  });
});

const mensaje = (text: string) => ({ content: [{ type: "text", text }], stop_reason: "end_turn" }) as unknown as Anthropic.Message;
const sinCache: CachePacks = { get: async () => undefined, set: async () => {} };
const sinRed = (async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
const llamar: LlamarIA = async () => "{}";

/** Sin manual ni iFixit: la lectura de fuentes públicas devuelve `lectura` y se guarda el pedido. */
async function armar(tipoEquipo: string, lectura: string) {
  const pedidos: string[] = [];
  const enviar: EnviarMensaje = async (p) => {
    const texto = JSON.stringify(p.messages);
    pedidos.push(texto);
    if (String(p.system).includes("bibliotecario")) return mensaje('{"encontrado":false,"url":null,"titulo":null,"fuente":null,"formato":null}');
    return mensaje(lectura);
  };
  const ficha = { ...fichaEjemplo, clase: "otro" as const, marca: { ...fichaEjemplo.marca, valor: "Marca" }, modelo: { ...fichaEjemplo.modelo, valor: "W1" } };
  const r = await armarKnowledgePack({ ficha, sintoma: "no carga", tipoEquipo }, { enviar, llamar, fetch: sinRed, cache: sinCache, manuales: repoEnMemoria(), subir: async () => "f" });
  return { pack: r.pack, pidioForma: pedidos.some((t) => t.includes("FORMA|")) };
}

const PASOS = "PASO|1|Poné el reloj en la base de carga y mirá si se prende la pantalla.|bobina_carga|bajo";

describe("armado del pack", () => {
  it.each([["redonda"], ["cuadrada"]] as const)("reloj de pantalla %s: la lectura la trae y queda en el pack", async (forma) => {
    const { pack, pidioForma } = await armar("reloj inteligente", `${PASOS}\nFORMA|${forma}`);
    expect(pidioForma).toBe(true);
    expect(pack.formaPantalla).toBe(forma);
  });

  it("si la lectura no la sabe, el pack no la trae (el 3D usa la común, estimada)", async () => {
    const { pack } = await armar("reloj inteligente", PASOS);
    expect(pack.formaPantalla).toBeUndefined();
  });

  it("un tipo de una sola forma ni la pide", async () => {
    const { pack, pidioForma } = await armar("celular", "PASO|1|Mirá el puerto de carga con una linterna.|puerto_carga|bajo");
    expect(pidioForma).toBe(false);
    expect(pack.formaPantalla).toBeUndefined();
  });
});
