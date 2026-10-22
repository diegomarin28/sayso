import { describe, expect, it } from "vitest";
import { mezclarCasos, type CasoGuardado, type GuiaGuardada, type ResumenServidor } from "./mis-casos";

const caso = (id: string) => ({
  id,
  clase: "otro" as const,
  sintoma: "no carga",
  estado: "captura" as const,
  creadoEn: "2026-10-20T10:00:00.000Z",
});
const guia = { marca: "guía local" } as unknown as GuiaGuardada;
const cierre = { estado: "resuelto" as const, ts: "2026-10-20T11:00:00.000Z" };

const local = (id: string, actualizadoEn: string, extra: Partial<CasoGuardado> = {}): CasoGuardado => ({
  caso: caso(id),
  tipoEquipo: "celular",
  ficha: null,
  guia: null,
  cierre: null,
  guiaEnServidor: false,
  pendienteServidor: false,
  fotosSinCopia: 0,
  actualizadoEn,
  ...extra,
});
const servidor = (id: string, actualizadoEn: string, extra: Partial<ResumenServidor> = {}): ResumenServidor => ({
  caso: caso(id),
  tipoEquipo: "celular",
  ficha: null,
  cierre: null,
  tieneGuia: false,
  actualizadoEn,
  ...extra,
});

describe("mezclarCasos", () => {
  it("suma los casos que solo están en el servidor, con la guía para bajar", () => {
    const r = mezclarCasos([local("a", "2026-10-20T12:00:00.000Z")], [servidor("b", "2026-10-19T12:00:00.000Z", { tieneGuia: true })]);
    expect(r.map((c) => c.caso.id).sort()).toEqual(["a", "b"]);
    const b = r.find((c) => c.caso.id === "b")!;
    expect(b.guia).toBeNull();
    expect(b.guiaEnServidor).toBe(true);
  });

  it("gana el lado actualizado más reciente, sin perder lo que el otro tiene", () => {
    const [r] = mezclarCasos(
      [local("a", "2026-10-20T12:00:00.000Z", { cierre })],
      [servidor("a", "2026-10-20T13:00:00.000Z", { tipoEquipo: "tablet" })],
    );
    expect(r.tipoEquipo).toBe("tablet");
    expect(r.cierre).toEqual(cierre);
    expect(r.actualizadoEn).toBe("2026-10-20T13:00:00.000Z");
  });

  it("si lo local es más nuevo, se queda con lo local", () => {
    const [r] = mezclarCasos(
      [local("a", "2026-10-20T14:00:00.000Z", { cierre })],
      [servidor("a", "2026-10-20T13:00:00.000Z", { cierre: { estado: "derivado", ts: "x" } })],
    );
    expect(r.cierre).toEqual(cierre);
    expect(r.actualizadoEn).toBe("2026-10-20T14:00:00.000Z");
  });

  it("nunca pisa la guía local", () => {
    const [r] = mezclarCasos([local("a", "2026-10-20T12:00:00.000Z", { guia })], [servidor("a", "2026-10-20T13:00:00.000Z", { tieneGuia: true })]);
    expect(r.guia).toBe(guia);
    expect(r.guiaEnServidor).toBe(true);
  });

  it("sin lista del servidor quedan los locales", () => {
    const locales = [local("a", "2026-10-20T12:00:00.000Z")];
    expect(mezclarCasos(locales, [])).toEqual(locales);
  });
});
