import { describe, expect, it } from "vitest";
import { casoEjemplo, fichaEjemplo, knowledgePackEjemplo, planoEjemplo } from "../../shared";
import { correrBateria, costoDe, evaluarProcedimiento, tabla, tablaPlano, type ComparacionPlano, type EntradaPlano } from "./bateria";
import { CASOS, CASOS_DEMO } from "./casos";

const costo = (usd: number) => ({ tipo: "costo", datos: { usd } });
const COSTOS = { entender: 0.001, knowledge: 0.2, plano: 0.02, chat: 0.05 };

/** La app de mentira: responde como las rutas reales, sin IA. */
function appFalsa({ bloquea = true, pausa = false } = {}) {
  const llamadas: string[] = [];
  const cuerpos: Record<string, unknown>[] = [];
  const f: typeof fetch = async (url, init) => {
    const ruta = new URL(String(url)).pathname;
    llamadas.push(ruta);
    if (pausa) return Response.json({ error: "IA en pausa", codigo: "ia_en_pausa" }, { status: 503 });
    const cuerpo = JSON.parse(String(init?.body ?? "{}"));
    cuerpos.push(cuerpo);
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
  return { f, llamadas, cuerpos };
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
    expect(t).toContain("| Equipo | Identificado | Manual | Verificado | Pasos | Origen del 3D | Bloqueos | Procedimientos | Costo | Tiempo | Nota |");
    expect(t).toContain("Notebook (HP 250 G9)");
  });

  it("como la app, pasa el tipo de equipo de la recepción a knowledge, plano y chat", async () => {
    const { f, cuerpos } = appFalsa();
    await correrBateria(CASOS.slice(0, 1), { base: "http://app", topeUsd: 1, fetch: f });
    // entender, ficha, knowledge, plano, chat, chat
    expect(cuerpos.slice(2).map((c) => c.tipoEquipo)).toEqual(["notebook", "notebook", "notebook", "notebook"]);
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

  it("preguntas de procedimiento: cuenta las que traen pasos y marca las que solo mandan al manual", async () => {
    const { f } = appFalsa();
    const iphone = CASOS_DEMO.find((c) => c.id === "iphone-13")!;
    const respuestas: Record<string, string[]> = {
      "¿Cómo abro el celular?": ["Para eso consultá el manual de Apple en support.apple.com/repair o un técnico."],
      "¿Cómo cambio la batería?": ["Apagalo.", "Calentá el borde.", "Levantá la pantalla con la ventosa.", "Desconectá la batería."],
      "¿Cómo cambio el conector de carga?": ["El manual oficial no incluye este procedimiento. Te paso los pasos de una guía pública de iFixit, que no es del fabricante.", "Sacá la pantalla.", "Desatornillá el soporte.", "Sacá el conector."],
    };
    const conRespuestas = (async (url: string | URL, init?: RequestInit) => {
      const cuerpo = init?.body ? JSON.parse(String(init.body)) : {};
      const dichos = String(url).endsWith("/api/chat") ? respuestas[cuerpo.pregunta] : undefined;
      if (!dichos) return f(url, init);
      const lineas = [...dichos.map((dice, i) => ({ tipo: "paso", coreografia: { paso: i + 1, dice, acciones: [], riesgo: "bajo" } })), { tipo: "fin", pasos: dichos.length }];
      return new Response(lineas.map((l) => JSON.stringify(l)).join("\n"));
    }) as typeof fetch;
    const r = await correrBateria([iphone], { base: "http://app", topeUsd: 1, fetch: conRespuestas });
    expect(r.filas[0].procedimientos).toBe("2/3 con pasos · NO: ¿Cómo abro el celular?");
    expect(tabla(r.filas, r.totalUsd)).toContain("2/3 con pasos");
    expect(evaluarProcedimiento(["Consultá el manual.", "Andá a support.apple.com."])).toEqual({ pasos: 0, ok: false });
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

describe("comparación del plano Sonnet vs Haiku (sin IA)", () => {
  const comparacion = (camino = "recorte"): ComparacionPlano => ({
    camino,
    sonnet: { modelo: "claude-sonnet-5-5", usd: 0.015, segundos: 9, origen3D: "ia · 5 manual, 2 estimada" },
    haiku: camino === "manual" ? null : { modelo: "claude-haiku-5-5", usd: 0.003, segundos: 4, origen3D: "ia · 4 manual, 3 estimada" },
    coincidencia: camino === "manual" ? null : { puntos: 11, max: 14, porcentaje: 79 },
    ...(camino === "manual" ? { nota: "con el manual entero el plano usa el modelo de lectura: no se compara" } : {}),
  });

  it("corre después del plano de la app, con la misma entrada, y suma su costo", async () => {
    const { f } = appFalsa();
    const entradas: EntradaPlano[] = [];
    const r = await correrBateria(CASOS.slice(0, 2), {
      base: "http://app",
      topeUsd: 1,
      fetch: f,
      compararPlano: async (e) => (entradas.push(e), comparacion(entradas.length === 2 ? "manual" : "recorte")),
    });
    expect(entradas[0]).toMatchObject({ manualFileId: "file_1", paginaVistaInterior: 68, paginasVistaExplosionada: [51], tipoEquipo: "notebook" });
    expect(r.filas[0].usd).toBeCloseTo(porCaso + 0.015 + 0.003);
    expect(r.filas[1].usd).toBeCloseTo(porCaso + 0.015);
    const t = tablaPlano(r.filas);
    expect(t).toContain("| Notebook | recorte | US$ 0.0150 · 9 s · ia · 5 manual, 2 estimada | US$ 0.0030 · 4 s · ia · 4 manual, 3 estimada | 11/14 (79 %) |");
    expect(t).toMatch(/Celular \| manual .*\| — \| — \| con el manual entero/);
    expect(t).toMatch(/Sonnet US\$ 0\.0300 · Haiku US\$ 0\.0030 · coincidencia media 79 % en 1 equipos/);
  });

  it("cuenta para el tope: si ya se pasó, no compara", async () => {
    const { f } = appFalsa();
    let llamadas = 0;
    // Después de knowledge van 0,201 (el plano corre); después del plano, 0,221: con tope 0,21 la comparación no empieza.
    const r = await correrBateria(CASOS.slice(0, 1), { base: "http://app", topeUsd: 0.21, fetch: f, compararPlano: async () => (llamadas++, comparacion()) });
    expect(llamadas).toBe(0);
    expect(r.filas[0].nota).toMatch(/corte antes de la comparación del plano/);
  });

  it("un error en la comparación no corta el caso; la IA en pausa sí", async () => {
    const { f } = appFalsa();
    const r = await correrBateria(CASOS.slice(0, 1), { base: "http://app", topeUsd: 1, fetch: f, compararPlano: async () => Promise.reject(new Error("se cayó la red")) });
    expect(r.filas[0].nota).toMatch(/comparación del plano: se cayó la red/);
    expect(r.filas[0].bloqueos).toBe("peligrosa bloqueada"); // las preguntas igual corrieron
    const pausa = Object.assign(new Error("IA en pausa"), { name: "IAEnPausa" });
    const r2 = await correrBateria(CASOS.slice(0, 2), { base: "http://app", topeUsd: 1, fetch: f, compararPlano: async () => Promise.reject(pausa) });
    expect(r2.cortado).toBe(true);
    expect(r2.filas[1].nota).toMatch(/no corrido/);
  });
});
