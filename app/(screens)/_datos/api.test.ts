import { afterEach, describe, expect, it, vi } from "vitest";
import { casoEjemplo, fichaEjemplo, knowledgePackEjemplo } from "../../../shared";
import { generarPlano, pedidosDeFoto, prepararExperto } from "./api";

/** Bajar costos: cada llamada a la IA se hace una sola vez por caso, aunque se vaya atrás y adelante. */

const respuesta = (cuerpo: unknown) => Promise.resolve(Response.json(cuerpo));
const ficha = { ...fichaEjemplo, modelo: { ...fichaEjemplo.modelo, estado: "confirmado" as const } };
const knowledge = {
  pack: knowledgePackEjemplo,
  manualUrl: null,
  manualFileId: null,
  paginasVistaExplosionada: [],
  desdeCache: false,
  eventos: [],
};

describe("pantallas: una llamada por caso", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pedir las fotos dos veces para el mismo caso llama una sola vez", async () => {
    const fetch = vi.fn(() => respuesta({ pedidos: [], eventos: [] }));
    vi.stubGlobal("fetch", fetch);
    const caso = { ...casoEjemplo, id: "caso-fotos" };
    await Promise.all([pedidosDeFoto(caso), pedidosDeFoto(caso)]);
    await pedidosDeFoto(caso); // volver a la pantalla
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("knowledge: mismo equipo = una llamada; corregir el modelo = otra", async () => {
    const fetch = vi.fn(() => respuesta(knowledge));
    vi.stubGlobal("fetch", fetch);
    const f = { ...ficha, casoId: "caso-knowledge" };
    await prepararExperto(f, "se apaga");
    await prepararExperto(f, "se apaga");
    expect(fetch).toHaveBeenCalledTimes(1);
    await prepararExperto({ ...f, modelo: { valor: "Otro modelo", estado: "confirmado" } }, "se apaga");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("si falla, se puede reintentar", async () => {
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve(Response.json({ error: "x" }, { status: 502 })))
      .mockImplementation(() => respuesta({ plano: { modelo: "m", unidades: "cm", piezas: [] }, origen: "ia", eventos: [] }));
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const f = { ...ficha, casoId: "caso-plano" };
    await expect(generarPlano(f, knowledge)).rejects.toThrow();
    await generarPlano(f, knowledge);
    await generarPlano(f, knowledge);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
