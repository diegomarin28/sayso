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

describe("C6: la persona nunca ve tokens ni costos (créditos)", () => {
  const eventos = [
    ev("pack_armado", "Armé la guía"),
    ev("costo", "Costo de este paso: US$ 0,12 (1200 tokens…)"),
  ];

  it("el feed oculta los eventos de costo, también en desarrollo", () => {
    expect(eventosVisibles(eventos).map((e) => e.tipo)).toEqual(["pack_armado"]);
  });
});
