import { describe, expect, it } from "vitest";
import { planoEjemplo, type PlanoDePiezas } from "../../../shared";
import { nombreFuente, textoPlano } from "./resumen-guia";

const conOrigen = (origenes: ("manual" | "estimada" | "plantilla")[]): PlanoDePiezas => ({
  ...planoEjemplo,
  medidas: { ancho: "manual", prof: "manual" } as PlanoDePiezas["medidas"],
  piezas: planoEjemplo.piezas.slice(0, origenes.length).map((p, i) => ({ ...p, origen: origenes[i] })),
});

describe("C10: qué dice Preparando del 3D", () => {
  it("«según el manual» solo si todo sale del manual", () => {
    expect(textoPlano({ plano: conOrigen(["manual", "manual"]), origen: "ia", avisos: [] })).toBe(
      "2 piezas ubicadas según el manual",
    );
  });

  it("un plano mixto muestra el resumen, no «según el manual»", () => {
    const t = textoPlano({ plano: conOrigen(["manual", "estimada", "plantilla"]), origen: "ia", avisos: [] });
    expect(t).not.toMatch(/según el manual/);
    expect(t).toBe("Piezas en el 3D: 1 del manual · 1 estimada · 1 genérica");
  });

  it("sin origen por pieza no lo presenta como verificado", () => {
    expect(textoPlano({ plano: planoEjemplo, origen: "ia", avisos: [] })).not.toMatch(/según el manual/);
  });

  it("la plantilla es un esquema genérico", () => {
    expect(textoPlano({ plano: planoEjemplo, origen: "plantilla", avisos: [] })).toMatch(/Esquema genérico/);
  });
});

describe("#240: el nombre de la guía no es una URL entera", () => {
  it("una URL de guía pública muestra el título y el sitio (2 variantes)", () => {
    expect(nombreFuente("https://www.ifixit.com/Guide/Sony+WH-1000XM4+Battery+Replacement/143625")).toBe(
      "Sony WH-1000XM4 Battery Replacement · ifixit.com",
    );
    expect(nombreFuente("https://www.manualslib.com/manual/1234567/Lg-Wm3400cw-Lavarropas.html")).toBe(
      "Lg Wm3400cw Lavarropas · manualslib.com",
    );
  });

  it("sin título en la dirección, solo el sitio", () => {
    expect(nombreFuente("https://example.org/123/456")).toBe("example.org");
  });

  it("un nombre que no es URL queda igual, y sin nombre dice «Guía pública»", () => {
    expect(nombreFuente("Manual de servicio HP 250 G8")).toBe("Manual de servicio HP 250 G8");
    expect(nombreFuente(undefined)).toBe("Guía pública");
    expect(nombreFuente("  ")).toBe("Guía pública");
  });
});
