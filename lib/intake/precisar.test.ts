import { beforeEach, describe, expect, it } from "vitest";
import { Ficha, fichaEjemplo } from "../../shared";
import { ErrorIA, type LlamarIA } from "../ia/claude";
import { IAEnPausa } from "../ia/freno";
import { olvidarJuicios, precisadoValido, precisarModelo, tieneCodigo } from "./precisar";

/** Simula al modelo devolviendo, en orden, cada respuesta de la lista. */
function falso(...respuestas: unknown[]): LlamarIA & { llamadas: number; ultimo: string } {
  let i = 0;
  const f = Object.assign(
    async (p: Parameters<LlamarIA>[0]) => {
      f.llamadas++;
      f.ultimo = JSON.stringify(p.contenido);
      const r = respuestas[Math.min(i++, respuestas.length - 1)];
      if (r instanceof Error) throw r;
      return typeof r === "string" ? r : JSON.stringify(r);
    },
    { llamadas: 0, ultimo: "" },
  );
  return f;
}

const con = (modelo: string, estado: Ficha["modelo"]["estado"] = "confirmado"): Ficha => ({
  ...fichaEjemplo,
  marca: { valor: "Apple", estado: "confirmado", fuente: "chapa+usuario" },
  modelo: { valor: modelo, estado, fuente: "chapa+usuario" },
  confirmadaPorUsuario: true,
});

const familia = {
  especifico: false,
  pregunta: "¿De qué año es tu MacBook Air, o qué chip tiene?",
  dondeMirar: "En el menú Apple > Acerca de esta Mac.",
  modeloPrecisado: "",
};
const unica = { especifico: true, pregunta: "", dondeMirar: "", modeloPrecisado: "" };

beforeEach(() => olvidarJuicios());

describe("tieneCodigo", () => {
  it("un código de etiqueta ya es una versión", () => {
    for (const m of ["MacBook Air A2337", "SM-A546E", "20UT0016US", "15-dw1024la", "55C722"]) expect(tieneCodigo(m)).toBe(true);
  });
  it("un nombre comercial, una generación corta o un año solo, no", () => {
    for (const m of ["MacBook Air", "ThinkPad E14", "Galaxy S21", "MacBook Pro 2019", "iPhone 13"]) expect(tieneCodigo(m)).toBe(false);
  });
});

describe("precisadoValido", () => {
  it("acepta el modelo con lo que dijo la persona", () => {
    expect(precisadoValido("MacBook Air", "es la del 2020 con M1", "MacBook Air M1 2020")).toBe("MacBook Air M1 2020");
    expect(precisadoValido("ThinkPad E14", "gen 2", "ThinkPad E14 Gen 2")).toBe("ThinkPad E14 Gen 2");
  });
  it("rechaza lo que la persona no dijo (no se inventa una versión)", () => {
    expect(precisadoValido("MacBook Air", "es la del 2020", "MacBook Air M1 2020")).toBeNull();
    expect(precisadoValido("MacBook Air", "2020", "MacBook Air 13 pulgadas 2020")).toBeNull();
  });
  it("rechaza si pierde el modelo o no agrega nada", () => {
    expect(precisadoValido("MacBook Air", "M1", "M1")).toBeNull();
    expect(precisadoValido("MacBook Air", "no sé", "MacBook Air")).toBeNull();
    expect(precisadoValido("MacBook Air", "M1", "")).toBeNull();
  });
});

describe("precisarModelo", () => {
  it("una familia devuelve la pregunta y no toca la ficha", async () => {
    const llamar = falso(familia);
    const r = await precisarModelo({ ficha: con("MacBook Air"), tipoEquipo: "notebook" }, llamar);
    expect(r.precisar).toEqual({ pregunta: familia.pregunta, dondeMirar: familia.dondeMirar });
    expect(r.ficha.modelo.valor).toBe("MacBook Air");
    expect(llamar.ultimo).toContain("<tipo_equipo>notebook</tipo_equipo>");
    expect(llamar.ultimo).not.toContain("respuesta_persona");
  });

  it("un modelo único sigue sin pregunta", async () => {
    const r = await precisarModelo({ ficha: con("iPhone 13") }, falso(unica));
    expect(r.precisar).toBeUndefined();
  });

  it("con código de etiqueta no llama a la IA", async () => {
    const llamar = falso(familia);
    const r = await precisarModelo({ ficha: con("MacBook Air A2337") }, llamar);
    expect(r.precisar).toBeUndefined();
    expect(llamar.llamadas).toBe(0);
  });

  it("sin modelo confirmado no pregunta nada", async () => {
    const llamar = falso(familia);
    expect((await precisarModelo({ ficha: con("MacBook Air", "probable") }, llamar)).precisar).toBeUndefined();
    expect(llamar.llamadas).toBe(0);
  });

  it("el mismo modelo no vuelve a pagar", async () => {
    const llamar = falso(familia);
    await precisarModelo({ ficha: con("MacBook Air") }, llamar);
    const r = await precisarModelo({ ficha: con("Macbook  air") }, llamar);
    expect(r.precisar?.pregunta).toBe(familia.pregunta);
    expect(llamar.llamadas).toBe(1);
  });

  it("con la respuesta, el modelo pasa a ser el preciso, de la persona", async () => {
    const llamar = falso({ ...unica, modeloPrecisado: "MacBook Air M1 2020" });
    const r = await precisarModelo({ ficha: con("MacBook Air"), respuesta: "la del 2020 con chip M1" }, llamar);
    expect(r.ficha.modelo).toEqual({ valor: "MacBook Air M1 2020", estado: "confirmado", fuente: "usuario" });
    expect(r.precisado).toEqual({ antes: "MacBook Air", despues: "MacBook Air M1 2020" });
    expect(r.precisar).toBeUndefined();
    expect(llamar.ultimo).toContain("<respuesta_persona>la del 2020 con chip M1</respuesta_persona>");
  });

  it("si la IA agrega algo que la persona no dijo, no cambia el modelo y vuelve a preguntar", async () => {
    const llamar = falso({ ...unica, modeloPrecisado: "MacBook Air M1 2020" });
    const r = await precisarModelo({ ficha: con("MacBook Air"), respuesta: "es de 2020" }, llamar);
    expect(r.ficha.modelo.valor).toBe("MacBook Air");
    expect(r.precisado).toBeUndefined();
    expect(r.precisar?.pregunta).toBeTruthy();
  });

  it("precisado pero todavía ambiguo: cambia el modelo y repregunta", async () => {
    const r = await precisarModelo(
      { ficha: con("MacBook Pro"), respuesta: "2019" },
      falso({ especifico: false, pregunta: "¿Es de 13 o de 16 pulgadas?", dondeMirar: "", modeloPrecisado: "MacBook Pro 2019" }),
    );
    expect(r.ficha.modelo.valor).toBe("MacBook Pro 2019");
    expect(r.precisar?.pregunta).toBe("¿Es de 13 o de 16 pulgadas?");
  });

  it('"no sé" (respuesta vacía) sigue sin preguntar ni llamar a la IA', async () => {
    const llamar = falso(familia);
    const r = await precisarModelo({ ficha: con("MacBook Air"), respuesta: "  " }, llamar);
    expect(r.precisar).toBeUndefined();
    expect(llamar.llamadas).toBe(0);
  });

  it("si la IA falla o está en pausa, sigue sin pregunta", async () => {
    const pausa = await precisarModelo({ ficha: con("MacBook Air") }, falso(new IAEnPausa("apagada")));
    expect(pausa).toEqual({ ficha: con("MacBook Air"), sinRevisar: true });
    const roto = await precisarModelo({ ficha: con("ThinkPad E14") }, falso(new ErrorIA("caída")));
    expect(roto.sinRevisar).toBe(true);
    expect(roto.precisar).toBeUndefined();
  });
});
