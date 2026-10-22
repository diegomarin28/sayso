import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorDeTiempo, fetchConTiempo } from "./con-tiempo";

/** Un fetch que nunca responde, pero se corta con la señal como el de verdad. */
const fetchColgado = () =>
  vi.fn(
    (_ruta: string, init?: RequestInit) =>
      new Promise<Response>((_ok, no) => {
        init?.signal?.addEventListener("abort", () => no(new DOMException("cortado", "AbortError")));
      }),
  );

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fetchConTiempo", () => {
  it("un pedido colgado se corta al vencer el tiempo", async () => {
    vi.stubGlobal("fetch", fetchColgado());
    const espera = expect(fetchConTiempo("/x", {}, 1000)).rejects.toBeInstanceOf(ErrorDeTiempo);
    await vi.advanceTimersByTimeAsync(1000);
    await espera;
  });

  it("una respuesta a tiempo pasa tal cual", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
    const res = await fetchConTiempo("/x", {}, 1000);
    expect(res.ok).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("un fallo de red no se confunde con el tiempo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(fetchConTiempo("/x", {}, 1000)).rejects.toBeInstanceOf(TypeError);
  });
});
