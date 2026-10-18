import { describe, expect, it } from "vitest";
import { knowledgePackEjemplo, planoEjemplo } from "../../../shared";
import type { EventoChat, PedidoChat } from "./eventos-chat";
import { guiaDelPack } from "./guia-del-pack";
import { fuenteSimulada } from "./simulada";

const primero = async (pedido: PedidoChat): Promise<EventoChat> => {
  for await (const ev of fuenteSimulada(pedido, new AbortController().signal)) return ev;
  throw new Error("sin eventos");
};
const pedido = (tipoEquipo?: string): PedidoChat => ({ casoId: "c", pack: knowledgePackEjemplo, plano: planoEjemplo, historial: [], pregunta: "quiero abrir la fuente", tipoEquipo });

describe("guía simulada: el bloqueo de seguridad según el tipo de equipo (#113)", () => {
  it("la misma pregunta avisa distinto en un celular (el cargador) y en una heladera (desenchufar)", async () => {
    const cel = await primero(pedido("celular"));
    const hel = await primero(pedido("heladera"));
    expect(cel.tipo).toBe("bloqueo");
    expect(hel.tipo).toBe("bloqueo");
    if (cel.tipo !== "bloqueo" || hel.tipo !== "bloqueo") return;
    expect(cel.coreografia.dice).toMatch(/cargador/);
    expect(hel.coreografia.dice).toMatch(/Desenchufá/);
  });
});

describe("guía simulada: el paso a paso sale del pack del caso (#161)", () => {
  it("una pregunta general recibe la guía armada con el pack (no la de ejemplo fija)", async () => {
    const evs: EventoChat[] = [];
    const p = { ...pedido("notebook"), pregunta: "¿Qué hago primero?" };
    for await (const ev of fuenteSimulada(p, new AbortController().signal)) evs.push(ev);
    const pasos = evs.flatMap((e) => (e.tipo === "paso" ? [e.coreografia] : []));
    expect(pasos).toEqual(guiaDelPack(knowledgePackEjemplo, planoEjemplo));
    expect(pasos.length).toBeGreaterThanOrEqual(4);
    expect(evs.at(-1)).toEqual({ tipo: "fin", pasos: pasos.length });
  });
});
