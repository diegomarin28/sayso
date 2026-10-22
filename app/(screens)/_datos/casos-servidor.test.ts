import { describe, expect, it } from "vitest";
import { sincronizacionDeEstado } from "./casos-servidor";

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
