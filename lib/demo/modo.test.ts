import { existsSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { knowledgePackEjemplo, planoEjemplo } from "../../shared";
import type { EventoChat } from "../../components/viewer/guia/eventos-chat";
import { fuenteSimulada } from "../../components/viewer/guia/simulada";
import { PREGUNTAS_DEMO, activarDemo, fotoDeEjemplo, leerDemoDeUrl, modoDemo, sinIA } from "./modo";

/** Un navegador mínimo: localStorage y eventos. */
function navegador() {
  const datos = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => datos.get(k) ?? null,
      setItem: (k: string, v: string) => void datos.set(k, v),
      removeItem: (k: string) => void datos.delete(k),
    },
    dispatchEvent: vi.fn(),
  });
}

describe("modo demo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("apagado por defecto; NEXT_PUBLIC_DATOS=demo o =fixture apagan la IA", () => {
    expect(sinIA()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_DATOS", "fixture");
    expect([sinIA(), modoDemo()]).toEqual([true, false]);
    vi.stubEnv("NEXT_PUBLIC_DATOS", "demo");
    expect([sinIA(), modoDemo()]).toEqual([true, true]);
  });

  it("se prende y se apaga desde el celular, sin recompilar (?demo=1 / ?demo=0)", () => {
    navegador();
    expect(leerDemoDeUrl("https://app.test/fotos")).toBe(false);
    expect(leerDemoDeUrl("https://app.test/?demo=1")).toBe(true);
    expect([modoDemo(), sinIA()]).toEqual([true, true]);
    expect(leerDemoDeUrl("https://app.test/?demo=1")).toBe(false); // ya estaba
    expect(leerDemoDeUrl("https://app.test/?demo=0")).toBe(true);
    expect(modoDemo()).toBe(false);
    activarDemo(true);
    expect(modoDemo()).toBe(true);
  });

  it("hay una foto de ejemplo para cada pedido; la primera de la etiqueta sale movida", () => {
    expect(fotoDeEjemplo("etiqueta", 1)).toMatch(/movida/);
    expect(fotoDeEjemplo("etiqueta", 2)).not.toMatch(/movida/);
    for (const tipo of ["frente", "etiqueta", "puertos", "interior", "otro"]) {
      for (const intento of [1, 2]) expect(existsSync(`public${fotoDeEjemplo(tipo, intento)}`), `${tipo} ${intento}`).toBe(true);
    }
  });

  it("las dos preguntas tienen respuesta con el chat simulado: el SSD se marca y abrir la batería se bloquea", async () => {
    const respuestas: EventoChat[][] = [];
    for (const pregunta of PREGUNTAS_DEMO) {
      const eventos: EventoChat[] = [];
      const pedido = { casoId: "demo", pack: knowledgePackEjemplo, plano: planoEjemplo, historial: [], pregunta };
      for await (const e of fuenteSimulada(pedido, new AbortController().signal)) eventos.push(e);
      respuestas.push(eventos);
    }
    const [ssd, bateria] = respuestas;
    const paso = ssd.find((e) => e.tipo === "paso");
    expect(paso?.tipo === "paso" && paso.coreografia.acciones).toContainEqual({ t: "resaltar", pieza: "ssd" });
    expect(bateria[0]).toMatchObject({ tipo: "bloqueo" });
  });
});
