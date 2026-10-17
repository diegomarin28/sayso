import { afterEach, describe, expect, it, vi } from "vitest";
import { casoEjemplo, fichaEjemplo, knowledgePackEjemplo } from "../../../shared";
import { ErrorApi, generarPlano, leerChapa, pedidosDeFoto, prepararExperto } from "./api";

/** Bajar costos: cada llamada a la IA se hace una sola vez por caso, aunque se vaya atrás y adelante. */

const respuesta = (cuerpo: unknown) => Promise.resolve(Response.json(cuerpo));
const ficha = { ...fichaEjemplo, modelo: { ...fichaEjemplo.modelo, estado: "confirmado" as const } };
const knowledge = {
  pack: knowledgePackEjemplo,
  manualUrl: null,
  manualFileId: null,
  paginasVistaExplosionada: [],
  paginaVistaInterior: null,
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
      .mockImplementation(() =>
        respuesta({ plano: { modelo: "m", unidades: "cm", piezas: [] }, origen: "ia", eventos: [] }),
      );
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const f = { ...ficha, casoId: "caso-plano" };
    await expect(generarPlano(f, knowledge)).rejects.toThrow();
    await generarPlano(f, knowledge);
    await generarPlano(f, knowledge);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("pantallas: IA en pausa (freno de gasto)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("un 503 ia_en_pausa llega como ErrorApi con el mensaje para mostrar", async () => {
    const mensaje = "IA en pausa: se llegó al límite de gasto de hoy. Probá de nuevo más tarde.";
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ error: mensaje, codigo: "ia_en_pausa" }, { status: 503 }))),
    );
    const p = pedidosDeFoto({ ...casoEjemplo, id: "caso-pausa" });
    await expect(p).rejects.toBeInstanceOf(ErrorApi);
    await expect(p).rejects.toThrow(mensaje);
  });
});

describe("pantallas: tipo de equipo y foto del frente (#63)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const imagen = (n: string) => ({ base64: n.repeat(40), mediaType: "image/jpeg" as const });

  it("pedidos manda el tipoEquipo", async () => {
    const fetch = vi.fn(() => respuesta({ pedidos: [], eventos: [] }));
    vi.stubGlobal("fetch", fetch);
    await pedidosDeFoto({ ...casoEjemplo, id: "caso-tipo" }, "heladera no frost");
    expect(
      JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string),
    ).toMatchObject({
      tipoEquipo: "heladera no frost",
    });
  });

  it("chapa manda etiqueta e imagenesFrente, y alcanza con la foto del frente", async () => {
    const fetch = vi.fn(() => respuesta({ ficha: { ...fichaEjemplo, casoId: "caso-frente" }, eventos: [] }));
    vi.stubGlobal("fetch", fetch);
    const caso = { ...casoEjemplo, id: "caso-frente" };
    await leerChapa(caso, [], { tipoEquipo: "notebook", imagenesFrente: [imagen("a")] });
    const cuerpo = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(cuerpo).toMatchObject({ tipoEquipo: "notebook", imagenes: [] });
    expect(cuerpo.imagenesFrente).toHaveLength(1);
  });

  it("sin ninguna foto no llama a la IA: la ficha sale vacía", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const r = await leerChapa({ ...casoEjemplo, id: "caso-sin-fotos" }, [], {});
    expect(fetch).not.toHaveBeenCalled();
    expect(r.ficha.modelo.estado).toBe("desconocido");
  });
});

describe("plano: tipoEquipo para la plantilla por tipo (#78)", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("generarPlano manda el tipoEquipo de la recepción", async () => {
    const fetch = vi.fn(() =>
      respuesta({ plano: { modelo: "m", unidades: "cm", piezas: [] }, origen: "plantilla", eventos: [] }),
    );
    vi.stubGlobal("fetch", fetch);
    await generarPlano({ ...ficha, casoId: "caso-plano-tipo" }, knowledge, "heladera no frost");
    const cuerpo = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(cuerpo.tipoEquipo).toBe("heladera no frost");
  });
});

describe("knowledge: tipoEquipo (#79)", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("prepararExperto manda el tipoEquipo de la recepción", async () => {
    const fetch = vi.fn(() => respuesta(knowledge));
    vi.stubGlobal("fetch", fetch);
    await prepararExperto({ ...ficha, casoId: "caso-knowledge-tipo" }, "no enfría", "heladera no frost");
    const cuerpo = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(cuerpo.tipoEquipo).toBe("heladera no frost");
  });
});
