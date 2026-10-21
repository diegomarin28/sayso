import { describe, expect, it, vi } from "vitest";
import { ErrorApi, ErrorCortado, MENSAJE_GENERICO, mensajeDeError, mensajeDeEstado } from "./errores";
import { ErrorImagen } from "./imagen";

describe("mensajeDeEstado", () => {
  it.each([
    [401, "sesión venció"],
    [408, "tardando"],
    [504, "tardando"],
    [413, "foto pesa"],
    [429, "muchos pedidos"],
    [502, "trabé"],
  ])("el %i dice qué pasó", (status, parte) => {
    expect(mensajeDeEstado(status)).toContain(parte);
  });

  it("lo desconocido usa el genérico, sin datos técnicos", () => {
    for (const s of [400, 500, 503, 0]) expect(mensajeDeEstado(s)).toBe(MENSAJE_GENERICO);
  });
});

describe("mensajeDeError", () => {
  it("muestra el mensaje de los errores pensados para la persona", () => {
    expect(mensajeDeError(new ErrorApi("No hay conexión."))).toBe("No hay conexión.");
    expect(mensajeDeError(new ErrorCortado("Se cortó."))).toBe("Se cortó.");
    expect(mensajeDeError(new ErrorImagen("No pude abrir esa foto."))).toBe("No pude abrir esa foto.");
  });

  it("no filtra el texto de un error inesperado", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mensajeDeError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(MENSAJE_GENERICO);
    expect(mensajeDeError("boom")).toBe(MENSAJE_GENERICO);
    log.mockRestore();
  });
});
