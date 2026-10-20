import { describe, expect, it } from "vitest";
import { contrasenaValida, emailValido } from "./credenciales";

describe("credenciales", () => {
  it("email: formato completo, sin espacios de más", () => {
    expect(emailValido("yo@ejemplo.com")).toBe(true);
    expect(emailValido("  Yo@Ejemplo.com.ar ")).toBe(true);
    for (const malo of ["", "yo", "yo@", "@ejemplo.com", "yo@ejemplo", "yo @ejemplo.com"]) expect(emailValido(malo)).toBe(false);
  });

  it("contraseña: 8 o más, con letras y números, hasta 72", () => {
    expect(contrasenaValida("clave1234")).toBe(true);
    expect(contrasenaValida("contraseña9")).toBe(true);
    for (const mala of ["clave12", "solamenteletras", "12345678", "a1".repeat(37)]) expect(contrasenaValida(mala)).toBe(false);
  });
});
