import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { Coreografia, knowledgePackEjemplo } from "../../shared";
import type { EnviarMensaje, StreamIA } from "../ia/claude";
import { leerManual } from "../knowledge/lector";
import { conversar, type EventoChat } from "./conversar";
import { parsearMarca, Segmentador } from "./segmentos";

const PIEZAS = new Set(["ssd", "ventilador", "bateria"]);

describe("parsearMarca", () => {
  it("convierte marcas válidas en acciones", () => {
    expect(parsearMarca("camara:ssd|1,6", PIEZAS)).toEqual({ t: "camara", objetivo: "ssd", zoom: 1.6 });
    expect(parsearMarca("camara:general", PIEZAS)).toEqual({ t: "camara", objetivo: "general" });
    expect(parsearMarca("rotar:ventilador|y|180", PIEZAS)).toEqual({ t: "rotar", pieza: "ventilador", eje: "y", grados: 180 });
    expect(parsearMarca("desplazar:ssd|0,3,0", PIEZAS)).toEqual({ t: "desplazar", pieza: "ssd", vec: [0, 3, 0] });
    expect(parsearMarca("despiezar:2", PIEZAS)).toEqual({ t: "despiezar", cantidad: 1 });
    expect(parsearMarca("restaurar", PIEZAS)).toEqual({ t: "restaurar" });
  });

  it("descarta piezas que no existen y marcas mal formadas", () => {
    expect(parsearMarca("resaltar:capacitor", PIEZAS)).toBeNull();
    expect(parsearMarca("rotar:ssd|w|90", PIEZAS)).toBeNull();
    expect(parsearMarca("volar:ssd", PIEZAS)).toBeNull();
  });
});

describe("Segmentador", () => {
  it("corta en frases aunque el texto llegue partido, y no corta dentro de marcas", () => {
    const s = new Segmentador(PIEZAS);
    const out = [
      ...s.texto("[[camara:ssd|1."),
      ...s.texto("6]] [[resaltar:ssd]] El SSD está abajo"),
      ...s.texto(" a la izquierda. Sacá"),
      ...s.texto(" un tornillo."),
      ...s.cerrar(),
    ];
    expect(out.map((x) => x.texto)).toEqual(["El SSD está abajo a la izquierda.", "Sacá un tornillo."]);
    expect(out[0].acciones).toEqual([
      { t: "camara", objetivo: "ssd", zoom: 1.6 },
      { t: "resaltar", pieza: "ssd" },
    ]);
    expect(out[1].acciones).toEqual([]);
  });

  it("marcas solas en un renglón van con la frase siguiente", () => {
    const s = new Segmentador(PIEZAS);
    const out = [...s.texto("[[resaltar:bateria]]\nEsta es la batería. "), ...s.cerrar()];
    expect(out).toHaveLength(1);
    expect(out[0].acciones).toEqual([{ t: "resaltar", pieza: "bateria" }]);
  });
});

/** Simula el stream de Claude con pedazos de texto y citas. */
function streamFalso(partes: (string | Anthropic.TextCitation)[]): StreamIA & { llamadas: number } {
  const f = Object.assign(
    async function* () {
      f.llamadas++;
      for (const p of partes) {
        yield {
          type: "content_block_delta",
          index: 0,
          delta: typeof p === "string" ? { type: "text_delta", text: p } : { type: "citations_delta", citation: p },
        } as Anthropic.RawMessageStreamEvent;
      }
    },
    { llamadas: 0 },
  );
  return f;
}

const citaP54: Anthropic.TextCitation = {
  type: "page_location",
  cited_text: "Remove the solid-state drive from the system board",
  document_index: 0,
  document_title: "HMM",
  start_page_number: 54,
  end_page_number: 55,
  file_id: null,
};

async function todos(gen: AsyncGenerator<EventoChat>) {
  const r: EventoChat[] = [];
  for await (const e of gen) r.push(e);
  return r;
}

const base = { casoId: "c1", pack: knowledgePackEjemplo, manualFileId: "file_1" };

describe("conversar", () => {
  it("emite una Coreografia válida por frase, con cita de página", async () => {
    const stream = streamFalso([citaP54, "[[resaltar:ssd]] El SSD está ", "abajo a la izquierda. ", "Tiene un tornillo."]);
    const ev = await todos(conversar({ ...base, pregunta: "¿Dónde está el SSD?" }, stream));
    const pasos = ev.filter((e) => e.tipo === "paso");
    expect(pasos).toHaveLength(2);
    for (const p of pasos) Coreografia.parse(p.coreografia);
    expect(pasos[0].coreografia.cita).toEqual({ doc: "HMM", pagina: 54, estado: "VERIFICADO" });
    // la segunda frase no tiene marcas: mantiene el resaltado
    expect(pasos[1].coreografia.acciones).toEqual([{ t: "resaltar", pieza: "ssd" }]);
    expect(ev.at(-1)).toMatchObject({ tipo: "fin", pasos: 2 });
  });

  it("bloquea una pregunta peligrosa sin llamar a la IA", async () => {
    const stream = streamFalso(["no debería llamarse."]);
    const ev = await todos(conversar({ ...base, pregunta: "¿Cómo abro la batería?" }, stream));
    expect(stream.llamadas).toBe(0);
    expect(ev[0].tipo).toBe("bloqueo");
  });

  it("si la IA propone un paso peligroso, lo reemplaza y corta la respuesta", async () => {
    const stream = streamFalso(["Primero sacá la tapa. ", "Después abrí la batería con un cutter. ", "Y listo."]);
    const ev = await todos(conversar({ ...base, pregunta: "¿Cómo cambio la batería?" }, stream));
    expect(ev.map((e) => e.tipo)).toEqual(["paso", "bloqueo", "fin"]);
    const bloqueo = ev[1];
    if (bloqueo.tipo !== "bloqueo") throw new Error();
    expect(bloqueo.coreografia.dice).not.toMatch(/cutter/);
    expect(bloqueo.coreografia.riesgo).toBe("alto");
  });

  it("[[paso:N]] usa la cita verificada del paso del pack", async () => {
    const conCita = knowledgePackEjemplo.pasos.find((p) => p.cita?.estado === "VERIFICADO")!;
    const stream = streamFalso([`[[paso:${conCita.orden}]] Seguí este paso. `]);
    const ev = await todos(conversar({ ...base, pregunta: "¿Qué hago primero?" }, stream));
    const p = ev[0];
    if (p.tipo !== "paso") throw new Error();
    expect(p.coreografia.cita).toEqual(conCita.cita);
  });

  it("si el pack no alcanza ([[manual]]), avisa y consulta el manual", async () => {
    const llamadas: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const stream: StreamIA = async function* (params) {
      llamadas.push(params);
      const texto = llamadas.length === 1 ? "[[manual]]" : "Según el manual, son tres tornillos. ";
      yield { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: texto } } as Anthropic.RawMessageStreamEvent;
    };
    const ev = await todos(conversar({ ...base, pregunta: "¿Cuántos tornillos tiene la bisagra?" }, stream));
    expect(ev.map((e) => e.tipo)).toEqual(["buscando", "paso", "fin"]);
    expect(JSON.stringify(llamadas[1].messages)).toContain("file_1");
    expect(JSON.stringify(llamadas[0].messages)).not.toContain("file_1");
  });

  it("la consulta al manual arranca igual que la lectura del pack (reusa su caché de prompts)", async () => {
    const llamadas: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const stream: StreamIA = async function* (params) {
      llamadas.push(params);
      const texto = llamadas.length === 1 ? "[[manual]]" : "Según el manual, son tres tornillos. ";
      yield { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: texto } } as Anthropic.RawMessageStreamEvent;
    };
    await todos(conversar({ ...base, pregunta: "¿Cuántos tornillos tiene la bisagra?" }, stream));
    let lectura: Anthropic.MessageCreateParamsNonStreaming | undefined;
    const enviar: EnviarMensaje = async (params) => {
      lectura = params;
      return { content: [], stop_reason: "end_turn" } as unknown as Anthropic.Message;
    };
    await leerManual({ fileId: "file_1", titulo: knowledgePackEjemplo.fuentes[0].doc }, "tarea", 100, enviar, "prueba");
    const prefijo = (p: Anthropic.MessageCreateParamsNonStreaming) => ({
      model: p.model,
      system: p.system,
      effort: p.output_config?.effort,
      tools: p.tools,
      documento: (p.messages[0].content as Anthropic.ContentBlockParam[])[0],
    });
    expect(prefijo(llamadas[1])).toEqual(prefijo(lectura!));
  });

  it("sin manual no hay segunda llamada", async () => {
    const stream = streamFalso(["No tengo esa información verificada. "]);
    const ev = await todos(conversar({ ...base, manualFileId: null, pregunta: "¿Y la bisagra?" }, stream));
    expect(stream.llamadas).toBe(1);
    expect(ev.map((e) => e.tipo)).toEqual(["paso", "fin"]);
  });

  it("con plano, descarta piezas que no están en el plano", async () => {
    const plano = { modelo: "x", unidades: "cm" as const, piezas: [{ pieza: "ventilador", forma: "caja" as const, dim: [1, 1, 1] as [number, number, number], pos: [0, 0, 0] as [number, number, number], pivote: [0, 0, 0] as [number, number, number] }] };
    const stream = streamFalso(["[[resaltar:ssd]] [[resaltar:ventilador]] Mirá acá. "]);
    const ev = await todos(conversar({ ...base, plano, pregunta: "¿Dónde está el ventilador?" }, stream));
    const p = ev[0];
    if (p.tipo !== "paso") throw new Error();
    expect(p.coreografia.acciones).toEqual([{ t: "resaltar", pieza: "ventilador" }]);
  });

  it("el fin trae el costo de la respuesta como evento del feed (con lo leído de la caché)", async () => {
    const stream: StreamIA = async function* () {
      yield {
        type: "message_start",
        message: { usage: { input_tokens: 1000, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 4000 } },
      } as unknown as Anthropic.RawMessageStreamEvent;
      yield { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "El SSD está abajo. " } } as Anthropic.RawMessageStreamEvent;
      yield { type: "message_delta", delta: {}, usage: { output_tokens: 200 } } as unknown as Anthropic.RawMessageStreamEvent;
    };
    const ev = await todos(conversar({ ...base, pregunta: "¿Dónde está el SSD?" }, stream));
    const fin = ev.at(-1);
    if (fin?.tipo !== "fin" || !fin.costo) throw new Error("sin costo");
    // Haiku: 1000 × 0,1 + 4000 × 0,01 (caché) + 200 × 0,5, por millón.
    expect(fin.costo.usd).toBeCloseTo((1000 * 0.1 + 4000 * 0.01 + 200 * 0.5) / 1e6, 10);
    expect(fin.costo.evento).toMatchObject({ casoId: "c1", agente: "experto", tipo: "costo" });
    expect(fin.costo.evento.mensaje).toMatch(/4000 leídos de la caché/);
  });

  it("un error del stream sale como evento de error", async () => {
    const roto: StreamIA = async function* () {
      throw new Error("se cortó");
    };
    const ev = await todos(conversar({ ...base, pregunta: "hola" }, roto));
    expect(ev).toEqual([{ tipo: "error", mensaje: expect.any(String) }]);
  });
});

describe("cambiar", () => {
  const base2 = { casoId: "c1", pack: knowledgePackEjemplo, manualFileId: null };

  it("[[cambiar:pieza]] completa coreografia.cambiar si la pieza existe", async () => {
    const stream = streamFalso(["[[resaltar:ventilador]] [[cambiar:ventilador]] Según el manual, el ventilador se reemplaza. "]);
    const ev = await todos(conversar({ ...base2, pregunta: "¿Qué hago?" }, stream));
    const p = ev[0];
    if (p.tipo !== "paso") throw new Error();
    expect(p.coreografia.cambiar).toBe("ventilador");
    Coreografia.parse(p.coreografia);
  });

  it("una pieza que no está en el plano no se manda", async () => {
    const stream = streamFalso(["[[cambiar:capacitor_inventado]] Hay que cambiarlo. "]);
    const ev = await todos(conversar({ ...base2, pregunta: "¿Qué hago?" }, stream));
    const p = ev[0];
    if (p.tipo !== "paso") throw new Error();
    expect(p.coreografia.cambiar).toBeUndefined();
  });
});

describe("pregunta de seguimiento (A7)", () => {
  const seis = ["Uno. ", "Dos. ", "Tres. ", "Cuatro. ", "Cinco. ", "Seis. "];
  const base3 = { casoId: "c1", pack: knowledgePackEjemplo, manualFileId: null };

  it("con historial, responde corto: corta en 4 frases", async () => {
    const ev = await todos(
      conversar({ ...base3, historial: [{ rol: "experto", texto: "Primero sacá la tapa." }], pregunta: "¿Y la batería?" }, streamFalso(seis)),
    );
    expect(ev.filter((e) => e.tipo === "paso")).toHaveLength(4);
    expect(ev.at(-1)).toMatchObject({ tipo: "fin", pasos: 4 });
  });

  it("sin historial no hay tope", async () => {
    const ev = await todos(conversar({ ...base3, pregunta: "¿Qué hago?" }, streamFalso(seis)));
    expect(ev.filter((e) => e.tipo === "paso")).toHaveLength(6);
  });

  it("las reglas piden responder solo lo nuevo y mover solo esa pieza", async () => {
    let sistema = "";
    const stream: StreamIA = async function* (p) {
      sistema = JSON.stringify(p.system);
      yield { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Ok. " } } as Anthropic.RawMessageStreamEvent;
    };
    await todos(conversar({ ...base3, pregunta: "¿Dónde está el SSD?" }, stream));
    expect(sistema).toMatch(/SOLO lo que pregunta/);
    expect(sistema).toMatch(/solo para esa pieza/);
  });
});

describe("tipo de equipo en la seguridad del chat (#112)", () => {
  it("en un celular el bloqueo habla de la batería, no de 220 V", async () => {
    const base4 = { casoId: "c1", pack: knowledgePackEjemplo, manualFileId: null };
    const ev = await todos(conversar({ ...base4, tipoEquipo: "celular", pregunta: "¿Cómo abro la batería para cambiarle las celdas?" }, streamFalso(["x. "])));
    const b = ev[0];
    if (b.tipo !== "bloqueo") throw new Error("no bloqueó");
    expect(b.coreografia.dice).toMatch(/bater/i);
    expect(b.coreografia.dice).not.toMatch(/220/);
  });
});

describe("guía del síntoma explicada (#160)", () => {
  it("la primera respuesta pide 4 a 8 pasos explicados; las de seguimiento no", async () => {
    const sistemas: string[] = [];
    const stream: StreamIA = async function* (p) {
      sistemas.push(JSON.stringify(p.system));
      yield { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Ok. " } } as Anthropic.RawMessageStreamEvent;
    };
    const base5 = { casoId: "c1", pack: knowledgePackEjemplo, manualFileId: null };
    await todos(conversar({ ...base5, pregunta: "No enciende" }, stream));
    await todos(conversar({ ...base5, historial: [{ rol: "experto", texto: "Revisá el cargador." }], pregunta: "¿Y si no anda?" }, stream));
    expect(sistemas[0]).toMatch(/de 4 a 8 pasos/);
    expect(sistemas[0]).toMatch(/qué vas a ver o escuchar/);
    expect(sistemas[1]).not.toMatch(/de 4 a 8 pasos/);
  });
});
