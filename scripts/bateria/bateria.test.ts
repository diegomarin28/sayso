import { describe, expect, it } from "vitest";
import { casoEjemplo, fichaEjemplo, knowledgePackEjemplo, planoEjemplo } from "../../shared";
import { correrBateria, costoDe, tabla } from "./bateria";
import { CASOS } from "./casos";

const costo = (usd: number) => ({ tipo: "costo", datos: { usd } });
const COSTOS = { entender: 0.001, knowledge: 0.2, plano: 0.02, chat: 0.05 };

/** La app de mentira: responde como las rutas reales, sin IA. */
function appFalsa({ bloquea = true, pausa = false } = {}) {
  const llamadas: string[] = [];
  const f: typeof fetch = async (url, init) => {
    const ruta = new URL(String(url)).pathname;
    llamadas.push(ruta);
    if (pausa) return Response.json({ error: "IA en pausa", codigo: "ia_en_pausa" }, { status: 503 });
    const cuerpo = JSON.parse(String(init?.body ?? "{}"));
    switch (ruta) {
      case "/api/intake/entender":
        return Response.json({ caso: { ...casoEjemplo, id: `caso-${llamadas.length}`, sintoma: cuerpo.texto }, tipoEquipo: "notebook", eventos: [costo(COSTOS.entender)] });
      case "/api/ficha":
        return Response.json({ ficha: { ...fichaEjemplo, casoId: cuerpo.ficha.casoId, confirmadaPorUsuario: true }, listaParaPreparar: true, eventos: [] });
      case "/api/knowledge":
        return Response.json({ pack: knowledgePackEjemplo, manualUrl: "https://ej.com/m.pdf", manualFileId: "file_1", paginasVistaExplosionada: [51], paginaVistaInterior: 68, desdeCache: false, eventos: [costo(COSTOS.knowledge)] });
      case "/api/plano": {
        const plano = { ...planoEjemplo, piezas: planoEjemplo.piezas.map((p, i) => ({ ...p, origen: i % 2 ? "estimada" : "manual" })) };
        return Response.json({ plano, origen: "ia", avisos: [], eventos: [costo(COSTOS.plano)] });
      }
      case "/api/chat": {
        const peligrosa = CASOS.some((c) => c.peligrosa === cuerpo.pregunta);
        const linea = peligrosa && bloquea ? { tipo: "bloqueo", clases: ["bateria"], coreografia: { paso: 1, dice: "Acá frenamos.", acciones: [], riesgo: "alto" } } : { tipo: "paso", coreografia: { paso: 1, dice: "Sacá los tornillos.", acciones: [], riesgo: "bajo" } };
        const fin = { tipo: "fin", pasos: 1, costo: { usd: COSTOS.chat, evento: {} } };
        return new Response([linea, fin].map((l) => JSON.stringify(l)).join("\n"));
      }
    }
    return new Response("no", { status: 404 });
  };
  return { f, llamadas };
}

const porCaso = COSTOS.entender + COSTOS.knowledge + COSTOS.plano + 2 * COSTOS.chat;

describe("batería de pruebas (sin IA)", () => {
  it("recorre el flujo completo y arma la tabla", async () => {
    const { f, llamadas } = appFalsa();
    const r = await correrBateria(CASOS.slice(0, 2), { base: "http://app", topeUsd: 1, fetch: f });
    expect(r.cortado).toBe(false);
    expect(llamadas.slice(0, 6)).toEqual(["/api/intake/entender", "/api/ficha", "/api/knowledge", "/api/plano", "/api/chat", "/api/chat"]);
    const [fila] = r.filas;
    expect(fila).toMatchObject({ identificado: "notebook · notebook", verificado: knowledgePackEjemplo.verificado, pasos: knowledgePackEjemplo.pasos.length, bloqueos: "peligrosa bloqueada" });
    expect(fila.manual).toBe(knowledgePackEjemplo.fuentes[0].doc);
    expect(fila.origen3D).toMatch(/^ia · \d+ manual, \d+ estimada$/);
    expect(fila.usd).toBeCloseTo(porCaso);
    expect(r.totalUsd).toBeCloseTo(2 * porCaso);
    const t = tabla(r.filas, r.totalUsd);
    expect(t).toContain("| Equipo | Identificado | Manual | Verificado | Pasos | Origen del 3D | Bloqueos | Costo | Tiempo | Nota |");
    expect(t).toContain("Notebook (HP 250 G9)");
  });

  it("corta antes del paso siguiente cuando el acumulado pasa el tope, y marca lo que no corrió", async () => {
    const { f, llamadas } = appFalsa();
    // El primer caso cuesta ~0,32: con tope 0,3 se termina, y el segundo se corta antes de empezar.
    const r = await correrBateria(CASOS.slice(0, 3), { base: "http://app", topeUsd: 0.3, fetch: f });
    expect(r.cortado).toBe(true);
    expect(r.filas[0].nota).toBeUndefined();
    expect(r.filas[1].nota).toMatch(/corte antes de entender/);
    expect(r.filas[2].nota).toMatch(/no corrido/);
    expect(llamadas.filter((l) => l === "/api/intake/entender")).toHaveLength(1);
  });

  it("si una pregunta peligrosa no se bloquea, la tabla lo dice", async () => {
    const { f } = appFalsa({ bloquea: false });
    const r = await correrBateria(CASOS.slice(0, 1), { base: "http://app", topeUsd: 1, fetch: f });
    expect(r.filas[0].bloqueos).toBe("peligrosa NO bloqueada");
  });

  it("con la IA en pausa (503) corta todo sin seguir llamando", async () => {
    const { f, llamadas } = appFalsa({ pausa: true });
    const r = await correrBateria(CASOS.slice(0, 3), { base: "http://app", topeUsd: 1, fetch: f });
    expect(r.cortado).toBe(true);
    expect(r.filas[0].nota).toMatch(/IA en pausa/);
    expect(llamadas).toHaveLength(1);
  });

  it("costoDe suma solo los eventos de costo", () => {
    expect(costoDe([costo(0.1), { tipo: "caso_creado" }, costo(0.05)])).toBeCloseTo(0.15);
  });

  it("los casos cubren los nueve equipos pedidos, cada uno con una pregunta peligrosa", () => {
    expect(CASOS.map((c) => c.id)).toEqual(["notebook", "celular", "split", "heladera", "televisor", "lavarropas", "microondas", "airfryer", "reloj"]);
    for (const c of CASOS) expect(c.peligrosa.length).toBeGreaterThan(10);
  });
});
