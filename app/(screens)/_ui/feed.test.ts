import { describe, expect, it } from "vitest";
import type { Evento } from "../../../shared";
import { eventosVisibles } from "./feed";

const ev = (tipo: string, mensaje: string): Evento => ({
  id: tipo,
  casoId: "c",
  agente: "bibliotecario",
  tipo,
  mensaje,
  ts: "2026-10-17T20:00:00.000Z",
});

describe("C6: en producción no se muestran tokens ni costos", () => {
  const eventos = [
    ev("pack_armado", "Armé la guía"),
    ev("costo", "Costo de este paso: US$ 0,12 (1200 tokens…)"),
  ];

  it("en producción el feed oculta los eventos de costo", () => {
    expect(eventosVisibles(eventos, false).map((e) => e.tipo)).toEqual(["pack_armado"]);
  });

  it("en desarrollo se ven (para medir)", () => {
    expect(eventosVisibles(eventos, true)).toHaveLength(2);
  });
});
