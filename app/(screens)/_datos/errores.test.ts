import { describe, expect, it, vi } from "vitest";
import {
  ErrorApi,
  ErrorCortado,
  MENSAJE_GENERICO,
  mensajeDeCuenta,
  mensajeDeError,
  mensajeDeEstado,
  textoDeFalla,
} from "./errores";
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

describe("mensajeDeCuenta", () => {
  it("deja pasar la frase que ya mandó el servidor", () => {
    expect(mensajeDeCuenta(400, "Revisá el email.")).toBe("Revisá el email.");
    expect(mensajeDeCuenta(401, "Falta iniciar la sesión.")).toBe("Falta iniciar la sesión.");
  });

  it("el límite de pedidos usa el mensaje de siempre", () => {
    expect(mensajeDeCuenta(429, "Too many requests")).toBe(mensajeDeEstado(429));
  });

  it("la validación cruda no le llega a la persona", () => {
    expect(mensajeDeCuenta(400, "Entrada inválida")).toBe("Revisá los datos y probá de nuevo.");
    expect(mensajeDeCuenta(422)).toBe("Revisá los datos y probá de nuevo.");
  });

  it("sin mensaje, se decide por el estado", () => {
    expect(mensajeDeCuenta(401)).toBe(mensajeDeEstado(401));
    expect(mensajeDeCuenta(500)).toBe(MENSAJE_GENERICO);
    expect(mensajeDeCuenta(504, "  ")).toBe(mensajeDeEstado(504));
  });
});

describe("textoDeFalla", () => {
  it("con internet, dice qué se trabó y que no se perdió nada", () => {
    const t = textoDeFalla(true, "Esta pantalla");
    expect(t.titulo).toBe("Esta pantalla se trabó.");
    expect(t.detalle).toContain("No se perdió nada");
  });

  it("sin internet, dice que es la conexión", () => {
    const t = textoDeFalla(false, "Sayso");
    expect(t.titulo).toBe("Sin conexión.");
    expect(t.detalle).toContain("vuelva internet");
  });
});
