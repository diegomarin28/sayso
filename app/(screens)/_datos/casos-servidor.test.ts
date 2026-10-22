import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guiaDelServidor, mensajeSinGuia, sincronizacionDeEstado, sincronizarCasos } from "./casos-servidor";
import { TIEMPO_CUENTA_MS } from "./con-tiempo";

describe("sincronizacionDeEstado", () => {
  it("2xx está bien", () => {
    expect(sincronizacionDeEstado(200)).toBe("ok");
  });
  it("401 es sesión vencida", () => {
    expect(sincronizacionDeEstado(401)).toBe("sesion");
  });
  it("el resto es un fallo para reintentar", () => {
    for (const s of [403, 429, 500, 502, 503]) expect(sincronizacionDeEstado(s)).toBe("fallo");
  });
});

describe("mensajeSinGuia", () => {
  it("la sesión vencida no se confunde con la conexión", () => {
    expect(mensajeSinGuia("sesion")).toContain("sesión venció");
    expect(mensajeSinGuia("sesion")).not.toContain("conexión");
  });
  it("una guía que no está guardada no pide revisar la conexión", () => {
    expect(mensajeSinGuia("vacio")).not.toContain("conexión");
  });
  it("red o servidor piden reintentar", () => {
    expect(mensajeSinGuia("fallo")).toContain("Revisá la conexión");
  });
});

describe("pedidos colgados", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", (_ruta: string, init?: RequestInit) =>
      new Promise<Response>((_ok, no) => {
        init?.signal?.addEventListener("abort", () => no(new DOMException("cortado", "AbortError")));
      }),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("la lista de casos termina en «fallo» para ofrecer Reintentar", async () => {
    const r = sincronizarCasos();
    await vi.advanceTimersByTimeAsync(TIEMPO_CUENTA_MS);
    expect(await r).toBe("fallo");
  });

  it("la guía que no baja termina en «fallo»: el caso no queda bloqueado", async () => {
    const r = guiaDelServidor("caso-1");
    await vi.advanceTimersByTimeAsync(TIEMPO_CUENTA_MS);
    expect(await r).toEqual({ motivo: "fallo" });
  });
});
