import { describe, expect, it } from "vitest";
import { accionDeTecla, anuncioResaltadas, conMenosMovimiento, descripcionVisor, PASO_TECLADO } from "./accesibilidad";

describe("descripcionVisor", () => {
  it("dice qué es, el origen y las teclas", () => {
    const t = descripcionVisor("Todo ubicado con el manual", 12);
    expect(t).toContain("12 piezas");
    expect(t).toContain("Todo ubicado con el manual");
    expect(t).toContain("Escape");
  });
  it("singular", () => expect(descripcionVisor("x", 1)).toContain("1 pieza."));
});

describe("anuncioResaltadas", () => {
  it("sin piezas no anuncia nada", () => expect(anuncioResaltadas([])).toBe(""));
  it("una pieza con su origen", () => {
    expect(anuncioResaltadas([{ nombre: "Ventilador", origen: "Manual · p. 54" }])).toBe("Pieza resaltada en el 3D: Ventilador (Manual · p. 54).");
  });
  it("varias, y sin origen cuando no hay", () => {
    expect(anuncioResaltadas([{ nombre: "SSD", origen: null }, { nombre: "RAM", origen: "Genérica" }])).toBe(
      "Piezas resaltadas en el 3D: SSD, RAM (Genérica).",
    );
  });
});

describe("accionDeTecla", () => {
  it("las flechas giran en el sentido esperado", () => {
    expect(accionDeTecla("ArrowLeft")).toEqual({ t: "girar", horizontal: -PASO_TECLADO.giro, vertical: 0 });
    expect(accionDeTecla("ArrowDown")).toEqual({ t: "girar", horizontal: 0, vertical: PASO_TECLADO.giro });
  });
  it("más acerca y menos aleja", () => {
    expect(accionDeTecla("+")).toEqual({ t: "acercar", delta: PASO_TECLADO.acercar });
    expect(accionDeTecla("-")).toEqual({ t: "acercar", delta: -PASO_TECLADO.acercar });
  });
  it("Escape vuelve a la vista de la guía", () => expect(accionDeTecla("Escape")).toEqual({ t: "volver" }));
  it("Tab y el resto siguen de largo", () => {
    expect(accionDeTecla("Tab")).toBeNull();
    expect(accionDeTecla("a")).toBeNull();
  });
});

describe("conMenosMovimiento", () => {
  const d = { mover: 750, girar: 750 };
  it("sin pedirlo deja los tiempos", () => expect(conMenosMovimiento(d, false)).toBe(d));
  it("pidiéndolo todo salta al final", () => expect(conMenosMovimiento(d, true)).toEqual({ mover: 0, girar: 0 }));
});
