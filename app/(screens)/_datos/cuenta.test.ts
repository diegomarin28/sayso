import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TIEMPO_CUENTA_MS } from "./con-tiempo";
import { ErrorCuenta, entrar, leerCuenta } from "./cuenta";
import { MENSAJE_TARDA } from "./errores";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("pedidos de la cuenta", () => {
  it("si el servidor no contesta, falla con «Está tardando» en vez de esperar para siempre", async () => {
    vi.stubGlobal("fetch", (_ruta: string, init?: RequestInit) =>
      new Promise<Response>((_ok, no) => {
        init?.signal?.addEventListener("abort", () => no(new DOMException("cortado", "AbortError")));
      }),
    );
    const r = entrar("a@b.com", "x").catch((e) => e);
    await vi.advanceTimersByTimeAsync(TIEMPO_CUENTA_MS);
    const e = await r;
    expect(e).toBeInstanceOf(ErrorCuenta);
    expect(e.message).toBe(MENSAJE_TARDA);
    expect(e.codigo).toBe("tiempo");
  });

  it("sin red sigue diciendo «Sin conexión»", async () => {
    vi.stubGlobal("fetch", async () => Promise.reject(new TypeError("Failed to fetch")));
    await expect(leerCuenta()).rejects.toMatchObject({ message: "Sin conexión. Probá de nuevo.", codigo: "red" });
  });
});
