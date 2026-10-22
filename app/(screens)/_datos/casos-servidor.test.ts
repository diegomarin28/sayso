import { describe, expect, it } from "vitest";
import { mensajeSinGuia, sincronizacionDeEstado } from "./casos-servidor";

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
