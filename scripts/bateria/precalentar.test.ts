import { describe, expect, it } from "vitest";
import { knowledgePackEjemplo, planoEjemplo } from "../../shared";
import { CASOS } from "./casos";
import { claseDe, leerEquipos, precalentar, tablaPrecalentar } from "./precalentar";

const costo = (usd: number) => ({ tipo: "costo", datos: { usd } });

function appFalsa({ enCache = false } = {}) {
  const pedidos: { ruta: string; cuerpo: Record<string, unknown> }[] = [];
  const f: typeof fetch = async (url, init) => {
    const ruta = new URL(String(url)).pathname;
    const cuerpo = JSON.parse(String(init?.body ?? "{}"));
    pedidos.push({ ruta, cuerpo });
    if (ruta === "/api/knowledge") {
      return Response.json({ pack: knowledgePackEjemplo, manualUrl: "https://ej.com/m.pdf", manualFileId: "file_1", paginasVistaExplosionada: [51], paginaVistaInterior: 68, desdeCache: enCache, eventos: enCache ? [] : [costo(0.15)] });
    }
    if (ruta === "/api/plano") return Response.json({ plano: planoEjemplo, origen: "ia", desdeCache: enCache, avisos: [], eventos: enCache ? [] : [costo(0.02)] });
    return new Response("no", { status: 404 });
  };
  return { f, pedidos };
}

describe("precalentar (sin IA)", () => {
  it("solo corre knowledge y plano, con la ficha confirmada y el tipo de equipo", async () => {
    const { f, pedidos } = appFalsa();
    const equipos = leerEquipos("HP|250 G9|notebook; Samsung|Galaxy A15|celular");
    const r = await precalentar(equipos, { base: "http://app", topeUsd: 0.5, fetch: f });
    expect(pedidos.map((p) => p.ruta)).toEqual(["/api/knowledge", "/api/plano", "/api/knowledge", "/api/plano"]);
    const k = pedidos[0].cuerpo as { ficha: { marca: { valor: string; estado: string }; modelo: { valor: string }; clase: string }; tipoEquipo: string };
    expect(k.ficha).toMatchObject({ clase: "notebook", marca: { valor: "HP", estado: "confirmado" }, modelo: { valor: "250 G9" } });
    expect(k.tipoEquipo).toBe("notebook");
    expect(pedidos[1].cuerpo).toMatchObject({ tipoEquipo: "notebook", manualFileId: "file_1", paginaVistaInterior: 68 });
    expect(r.filas[0]).toMatchObject({ yaEstaba: false, manual: knowledgePackEjemplo.fuentes[0].doc, vistas: "interior 68 · explosionada 51" });
    expect(r.totalUsd).toBeCloseTo(2 * 0.17);
    expect(tablaPrecalentar(r.filas, r.totalUsd)).toContain("| HP 250 G9 (notebook) | no |");
  });

  it("si ya estaba en la caché lo dice y no gasta", async () => {
    const { f } = appFalsa({ enCache: true });
    const r = await precalentar(leerEquipos("HP|250 G9|notebook"), { base: "http://app", topeUsd: 0.5, fetch: f });
    expect(r.filas[0]).toMatchObject({ yaEstaba: true, usd: 0 });
    expect(r.filas[0].plano).toMatch(/^ya estaba · ia/);
  });

  it("corta antes del paso siguiente si se pasa el tope (0,50 por defecto en el CLI)", async () => {
    const { f, pedidos } = appFalsa();
    const equipos = CASOS.slice(0, 4).map((c) => ({ marca: c.marca, modelo: c.modelo, tipoEquipo: c.tipoEquipo, clase: c.clase }));
    // Cada equipo cuesta 0,17: después del tercero van 0,51 > 0,50 y el cuarto no empieza.
    const r = await precalentar(equipos, { base: "http://app", topeUsd: 0.5, fetch: f });
    expect(r.cortado).toBe(true);
    expect(r.filas[3].nota).toMatch(/corte antes de knowledge/);
    expect(pedidos.filter((p) => p.ruta === "/api/knowledge")).toHaveLength(3);
  });

  it("lee la lista de equipos y deduce la clase del tipo", () => {
    expect(leerEquipos(" James | AAM-12 AU-INV | aire acondicionado split ;Samsung|WW70T3020BW|lavarropas\nPhilips|HD9218")).toEqual([
      { marca: "James", modelo: "AAM-12 AU-INV", tipoEquipo: "aire acondicionado split", clase: "split" },
      { marca: "Samsung", modelo: "WW70T3020BW", tipoEquipo: "lavarropas", clase: "lavarropas" },
      { marca: "Philips", modelo: "HD9218", tipoEquipo: "equipo", clase: "otro" },
    ]);
    expect(claseDe("Portátil HP")).toBe("notebook");
    expect(() => leerEquipos("solo-una-cosa")).toThrow(/Marca\|Modelo/);
  });
});
