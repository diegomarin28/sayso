import { describe, expect, it } from "vitest";
import { knowledgePackEjemplo, planoEjemplo, type PlanoDePiezas } from "../../../shared";
import { resumenPasos, textoPlano, textoSelloPaso } from "./resumen-guia";

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

describe("Preparando: estado de los pasos sin carteles en cada uno", () => {
  const paso = (n: number, pagina?: number) => ({
    ...knowledgePackEjemplo.pasos[0],
    id: `p${n}`,
    orden: n,
    cita: pagina ? { doc: "Manual", pagina, estado: "VERIFICADO" as const } : undefined,
  });

  it("guía pública: una línea arriba con cuántos pasos tienen página", () => {
    const pack = { verificado: false, pasos: Array.from({ length: 11 }, (_, i) => paso(i + 1)) };
    expect(resumenPasos(pack)).toBe("Guía pública: 0 de 11 pasos con página del manual");
  });

  it("cada paso: «Manual ✓ p.N» si tiene cita; si no, «Guía pública» (gris)", () => {
    expect(textoSelloPaso(paso(1, 54), true)).toEqual({ texto: "Manual ✓ p.54", verificado: true });
    expect(textoSelloPaso(paso(2), false)).toEqual({ texto: "Guía pública", verificado: false });
    expect(textoSelloPaso(paso(3), true).verificado).toBe(false);
  });
});
