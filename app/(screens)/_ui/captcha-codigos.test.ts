import { describe, expect, it } from "vitest";
import { CODIGO_NO_CARGO, fraseCaptcha } from "./captcha-codigos";

describe("código de error del captcha → frase", () => {
  it("110200 es dominio no autorizado", () => {
    expect(fraseCaptcha("110200")).toMatch(/dominio no autorizado/);
  });

  it("otros códigos 110xxx son de configuración", () => {
    expect(fraseCaptcha("110100")).toMatch(/configuración/);
  });

  it("el script que no carga tiene su frase de conexión", () => {
    expect(fraseCaptcha(CODIGO_NO_CARGO)).toMatch(/conexión/);
  });

  it("300xxx y 600xxx son fallos de la verificación", () => {
    expect(fraseCaptcha("600010")).toMatch(/no pudo confirmar/);
    expect(fraseCaptcha("300010")).toMatch(/no pudo confirmar/);
  });

  it("un código desconocido usa la frase genérica", () => {
    expect(fraseCaptcha("999999")).toMatch(/inesperado/);
  });

  it("sin código no muestra un código inventado", () => {
    expect(fraseCaptcha(null)).toBe("Probá de nuevo.");
  });
});
