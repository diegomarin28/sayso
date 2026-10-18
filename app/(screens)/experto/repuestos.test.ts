import { describe, expect, it } from "vitest";
import { knowledgePackEjemplo, type KnowledgePack } from "../../../shared";
import { eventosVisibles } from "../_ui/feed";
import { piezasParaComprar } from "./piezas-compra";

const cita = { doc: "Manual", pagina: 90, estado: "VERIFICADO" as const };
const conNumeros: KnowledgePack = {
  ...knowledgePackEjemplo,
  repuestos: [
    { pieza: "ventilador", numeroParte: "5F10S13875", cita },
    { pieza: "bateria", numeroParte: "L19M3PF1", cita: { ...cita, pagina: 91 } },
  ],
};

describe("piezasParaComprar (C8: siempre hay un camino para comprar)", () => {
  it("sin números de parte en el manual igual ofrece las piezas de la guía, para buscar por modelo", () => {
    const items = piezasParaComprar({ ...knowledgePackEjemplo, repuestos: [] });
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(6);
    expect(items.every((i) => i.numeroParte === null)).toBe(true);
    // Primero las que aparecen en los pasos.
    const enPasos = new Set(knowledgePackEjemplo.pasos.flatMap((p) => p.piezas));
    if (enPasos.size) expect(enPasos.has(items[0].pieza)).toBe(true);
  });

  it("con números de parte, esos (con su página); la que el experto pide cambiar va primero", () => {
    expect(piezasParaComprar(conNumeros)).toEqual([
      { pieza: "ventilador", numeroParte: "5F10S13875", pagina: 90 },
      { pieza: "bateria", numeroParte: "L19M3PF1", pagina: 91 },
    ]);
    expect(piezasParaComprar(conNumeros, "bateria")[0]).toMatchObject({ pieza: "bateria", numeroParte: "L19M3PF1" });
    expect(piezasParaComprar(conNumeros, "ssd")[0]).toEqual({ pieza: "ssd", numeroParte: null });
  });
});

describe("eventosVisibles (C6: sin costos en producción)", () => {
  const ev = (tipo: string) => ({ id: tipo, casoId: "c", agente: "experto" as const, tipo, mensaje: tipo, ts: "t" });
  const eventos = [ev("manual_encontrado"), ev("costo"), ev("plano_generado")];

  it("en producción no se ven los costos; en desarrollo sí", () => {
    expect(eventosVisibles(eventos, "production").map((e) => e.tipo)).toEqual(["manual_encontrado", "plano_generado"]);
    expect(eventosVisibles(eventos, "development")).toHaveLength(3);
  });
});
