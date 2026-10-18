import { afterEach, describe, expect, it, vi } from "vitest";
import { casoEjemplo, fichaEjemplo, knowledgePackEjemplo } from "../../../shared";
import { ErrorApi, ErrorCortado, TIEMPO_MAXIMO_MS, cancelarPedidosEnCurso, generarPlano, hayPedidosEnCurso, leerChapa, pedidosDeFoto, prepararExperto } from "./api";

/** Bajar costos: cada llamada a la IA se hace una sola vez por caso, aunque se vaya atrás y adelante. */

const respuesta = (cuerpo: unknown) => Promise.resolve(Response.json(cuerpo));
const ficha = { ...fichaEjemplo, modelo: { ...fichaEjemplo.modelo, estado: "confirmado" as const } };
const knowledge = {
  pack: knowledgePackEjemplo,
  manualUrl: null,
  manualFileId: null,
  paginasVistaExplosionada: [],
  paginaVistaInterior: null,
  imagenesPaginas: {},
  fotosPasos: {},
  vistaInterior: null,
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

describe("Ver en el manual (#84)", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("las imágenes de páginas llegan con claves de texto y se buscan con el número", async () => {
    const fetch = vi.fn(() => respuesta({ ...knowledge, imagenesPaginas: { "54": "https://ej.com/p54.png" } }));
    vi.stubGlobal("fetch", fetch);
    const r = await prepararExperto({ ...ficha, casoId: "caso-imagenes" }, "ruido");
    const pagina = 54;
    expect(r.imagenesPaginas[pagina]).toBe("https://ej.com/p54.png");
    expect(r.vistaInterior).toBeNull();
  });
});

describe("Ver la foto del paso (#176)", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("las fotos de los pasos (iFixit) llegan por la URL del paso", async () => {
    const url = "https://www.ifixit.com/Guide/iPhone+13+Battery+Replacement/146173#s1";
    const fetch = vi.fn(() => respuesta({ ...knowledge, fotosPasos: { [url]: "https://guide-images.cdn.ifixit.com/x.jpg" } }));
    vi.stubGlobal("fetch", fetch);
    const r = await prepararExperto({ ...ficha, casoId: "caso-fotos" }, "no carga");
    expect(r.fotosPasos[url]).toBe("https://guide-images.cdn.ifixit.com/x.jpg");
  });

  it("sin iFixit (respuesta vieja, sin el campo) queda vacío", async () => {
    const { fotosPasos, ...sinFotos } = knowledge;
    void fotosPasos;
    vi.stubGlobal("fetch", vi.fn(() => respuesta(sinFotos)));
    const r = await prepararExperto({ ...ficha, casoId: "caso-sin-fotos" }, "no carga");
    expect(r.fotosPasos).toEqual({});
  });
});

describe("Preparando: sin espera infinita (tiempo máximo, cancelar y reintentar)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  /** Un fetch que nunca responde (red colgada), salvo que lo corten. */
  const colgado = (init?: RequestInit) =>
    new Promise<Response>((_, rechazar) => init?.signal?.addEventListener("abort", () => rechazar(new DOMException("abortado", "AbortError"))));
  const plano = () => respuesta({ plano: { modelo: "m", unidades: "cm", piezas: [] }, origen: "ia", eventos: [] });

  it("a los ~150 s se corta con ErrorCortado y el reintento hace un pedido nuevo (no reusa el colgado)", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockImplementationOnce((_: string, init?: RequestInit) => colgado(init)).mockImplementation(plano);
    vi.stubGlobal("fetch", fetch);
    const f = { ...ficha, casoId: "caso-colgado" };
    const primero = generarPlano(f, knowledge);
    const resultado = expect(primero).rejects.toThrow(ErrorCortado);
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_MS - 1);
    expect(hayPedidosEnCurso()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await resultado;
    await expect(primero).rejects.toThrow(/tardando demasiado/);
    expect(hayPedidosEnCurso()).toBe(false);
    await expect(generarPlano(f, knowledge)).resolves.toMatchObject({ origen: "ia" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("cancelarPedidosEnCurso (volvió la red) corta lo colgado y se puede volver a pedir", async () => {
    const fetch = vi.fn().mockImplementationOnce((_: string, init?: RequestInit) => colgado(init)).mockImplementation(() => respuesta(knowledge));
    vi.stubGlobal("fetch", fetch);
    const f = { ...ficha, casoId: "caso-cancelado" };
    const primero = prepararExperto(f, "se apaga");
    await Promise.resolve();
    expect(hayPedidosEnCurso()).toBe(true);
    cancelarPedidosEnCurso();
    await expect(primero).rejects.toThrow(/Se cortó la conexión/);
    await expect(prepararExperto(f, "se apaga")).resolves.toMatchObject({ desdeCache: false });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("sin red sigue siendo ErrorApi (no ErrorCortado): la pantalla espera a que vuelva", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    const e = await generarPlano({ ...ficha, casoId: "caso-sin-red" }, knowledge).catch((x) => x);
    expect(e).toBeInstanceOf(ErrorApi);
    expect(e).not.toBeInstanceOf(ErrorCortado);
  });
});
