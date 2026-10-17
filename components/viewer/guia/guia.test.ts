import { describe, expect, it } from "vitest";
import { coreografiaEjemplo, type Coreografia } from "../../../shared";
import { leerNdjson, type EventoChat } from "./eventos-chat";
import { reproducir, tiempoDeLectura, type EstadoGuia } from "./reproducir";

const flujoDeBytes = (trozos: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      const enc = new TextEncoder();
      trozos.forEach((t) => c.enqueue(enc.encode(t)));
      c.close();
    },
  });
const juntar = async <T,>(it: AsyncIterable<T>) => {
  const res: T[] = [];
  for await (const x of it) res.push(x);
  return res;
};
async function* desde(evs: EventoChat[]) {
  for (const e of evs) yield e;
}

describe("leerNdjson", () => {
  it("arma las líneas aunque lleguen cortadas entre paquetes, y descarta las inválidas", async () => {
    const paso = JSON.stringify({ tipo: "paso", coreografia: coreografiaEjemplo[0] });
    const texto = `${paso}\n{"tipo":"cualquiera"}\nno es json\n{"tipo":"fin","pasos":1}`;
    const trozos = [texto.slice(0, 17), texto.slice(17, 90), texto.slice(90)];
    const evs = await juntar(leerNdjson(flujoDeBytes(trozos)));
    expect(evs.map((e) => e.tipo)).toEqual(["paso", "fin"]);
    expect(evs[0]).toEqual({ tipo: "paso", coreografia: coreografiaEjemplo[0] });
  });
});

describe("reproducir", () => {
  const registro = () => {
    const log: string[] = [];
    const pasos: Coreografia[] = [];
    return {
      log,
      pasos,
      m: {
        estado: (e: EstadoGuia, d?: string) => log.push(`estado:${e}${d ? `:${d}` : ""}`),
        paso: (c: Coreografia, b: boolean) => (pasos.push(c), log.push(`paso:${c.paso}${b ? ":bloqueo" : ""}`)),
        decir: async (t: string) => void log.push(`decir:${t.slice(0, 10)}`),
      },
    };
  };

  it("muestra cada paso y espera a que se diga antes del siguiente; devuelve lo dicho", async () => {
    const { log, m } = registro();
    const dicho = await reproducir(
      desde([
        { tipo: "paso", coreografia: coreografiaEjemplo[0] },
        { tipo: "buscando", texto: "Dejame buscarlo…" },
        { tipo: "paso", coreografia: coreografiaEjemplo[1] },
        { tipo: "fin", pasos: 2 },
      ]),
      m,
      new AbortController().signal,
    );
    expect(log).toEqual([
      "estado:pensando",
      "estado:hablando",
      "paso:1",
      "decir:Este es el",
      "estado:buscando:Dejame buscarlo…",
      "estado:hablando",
      "paso:2",
      "decir:Aflojá los",
      "estado:esperando",
    ]);
    expect(dicho).toEqual({ rol: "experto", texto: `${coreografiaEjemplo[0].dice} ${coreografiaEjemplo[1].dice}` });
  });

  it("después de un bloqueo no sigue y queda bloqueado", async () => {
    const { log, m } = registro();
    const derivacion: Coreografia = { paso: 1, dice: "Acá frenamos.", acciones: [{ t: "restaurar" }], riesgo: "alto" };
    await reproducir(
      desde([
        { tipo: "bloqueo", coreografia: derivacion, clases: ["bateria"] },
        { tipo: "paso", coreografia: coreografiaEjemplo[0] },
      ]),
      m,
      new AbortController().signal,
    );
    expect(log.filter((l) => l.startsWith("paso"))).toEqual(["paso:1:bloqueo"]);
    expect(log.at(-1)).toBe("estado:bloqueado");
  });

  it("un error se muestra tal cual", async () => {
    const { log, m } = registro();
    await reproducir(desde([{ tipo: "error", mensaje: "Probá de nuevo." }]), m, new AbortController().signal);
    expect(log.at(-1)).toBe("estado:error:Probá de nuevo.");
  });

  it("si se cancela (nueva pregunta), deja de mostrar pasos", async () => {
    const { pasos, m } = registro();
    const ctl = new AbortController();
    await reproducir(
      desde([
        { tipo: "paso", coreografia: coreografiaEjemplo[0] },
        { tipo: "paso", coreografia: coreografiaEjemplo[1] },
      ]),
      { ...m, decir: async () => ctl.abort() },
      ctl.signal,
    );
    expect(pasos).toHaveLength(1);
  });

  it("tiempo de lectura acotado", () => {
    expect(tiempoDeLectura("Hola")).toBe(2500);
    expect(tiempoDeLectura("x".repeat(1000))).toBe(9000);
  });
});
