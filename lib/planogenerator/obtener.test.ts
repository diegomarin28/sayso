import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { fichaEjemplo, knowledgePackEjemplo, type KnowledgePack } from "../../shared";
import type Anthropic from "@anthropic-ai/sdk";
import { LIMITES, type EnviarMensaje, type LlamarIA, type PedidoIA } from "../ia/claude";
import { bloqueManual, SYSTEM_LECTOR } from "../knowledge/lector";
import { cachePlanosEnMemoria } from "./cache";
import { propuestaDesdePlantilla } from "./generador";
import { obtenerPlano } from "./obtener";

const kp = knowledgePackEjemplo;
const propuesta = JSON.stringify({ base_ancho_cm: null, base_prof_cm: null, piezas: propuestaDesdePlantilla({ modelo: "x", unidades: "cm", piezas: [] }) });
const contador = () => {
  const llamadas: PedidoIA[] = [];
  const llamar: LlamarIA = async (p) => {
    llamadas.push(p);
    return propuesta;
  };
  return { llamadas, llamar };
};
/** La IA con el manual entero: responde el JSON como texto (con citas, la API no da salida estructurada). */
const enviarFalso = (texto = propuesta) => {
  const pedidos: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const enviar: EnviarMensaje = async (params) => {
    pedidos.push(params);
    return { content: [{ type: "text", text: "```json\n" + texto + "\n```", citations: null }], stop_reason: "end_turn" } as unknown as Anthropic.Message;
  };
  return { pedidos, enviar };
};
const entrada = { casoId: "c", knowledgePack: kp, ficha: fichaEjemplo };
const pdfDePrueba = async (hojas: number) => {
  const doc = await PDFDocument.create();
  for (let n = 0; n < hojas; n++) doc.addPage();
  return doc.save();
};

describe("obtenerPlano (caché por marca + modelo)", () => {
  it("la primera vez genera y guarda; la segunda reusa sin llamar a la IA", async () => {
    const cache = cachePlanosEnMemoria();
    const { llamadas, llamar } = contador();
    const a = await obtenerPlano(entrada, { cache, llamar });
    const b = await obtenerPlano(entrada, { cache, llamar });
    expect(a.desdeCache).toBe(false);
    expect(b.desdeCache).toBe(true);
    expect(b.plano).toEqual(a.plano);
    expect(llamadas).toHaveLength(1);
  });

  const conParlantes: KnowledgePack = {
    ...kp,
    piezas: [...kp.piezas, { id: "parlantes", nombre: "Parlantes", descripcion: "", ubicacion: "" }],
  };
  const parlantes = (pagina: number | null) =>
    JSON.stringify({
      base_ancho_cm: null,
      base_prof_cm: null,
      piezas: [{ pieza: "parlantes", x: 0.8, z: 0.8, ancho: 0.1, prof: 0.1, alto_cm: null, capa: "sobre_base", sobre: null, forma: "caja", etiquetaManual: null, pagina, confianza: "alta" }],
    });
  const conRecorte = async () => {
    const pdf = Buffer.from(await pdfDePrueba(60));
    return {
      entrada: { ...entrada, knowledgePack: conParlantes, manualUrl: "https://ej.com/hmm.pdf", manual: { fileId: "file_123", paginasVistaExplosionada: [12], paginaVistaInterior: 51 } },
      descargar: async () => new Response(pdf),
    };
  };

  it("otro síntoma con piezas nuevas y sin manual: reusa el guardado y suma lo que falta sin IA", async () => {
    const cache = cachePlanosEnMemoria();
    const { llamadas, llamar } = contador();
    const a = await obtenerPlano(entrada, { cache, llamar });
    const r = await obtenerPlano({ ...entrada, knowledgePack: conParlantes }, { cache, llamar });
    expect(llamadas).toHaveLength(1);
    expect(r.desdeCache).toBe(true);
    expect(r.origen).toBe("ia");
    expect(r.plano.piezas.map((p) => p.pieza)).toEqual(expect.arrayContaining([...a.plano.piezas.map((p) => p.pieza), "parlantes"]));
    expect(r.avisos.join(" ")).toMatch(/"parlantes".*sin IA/);
  });

  it("con manual: la IA ubica solo lo que falta, se suma lo que vio en una página y el guardado crece", async () => {
    const cache = cachePlanosEnMemoria();
    const { llamadas, llamar } = contador();
    const a = await obtenerPlano(entrada, { cache, llamar });
    const { entrada: e, descargar } = await conRecorte();
    const pidio: string[] = [];
    const r = await obtenerPlano(e, { cache, descargar, llamar: async (p) => (pidio.push(JSON.stringify(p.contenido)), parlantes(1)) });
    // Solo se pidió la pieza nueva, no las del plano guardado.
    expect(pidio).toHaveLength(1);
    expect(pidio[0]).toContain("parlantes: Parlantes");
    for (const p of kp.piezas) expect(pidio[0]).not.toContain(`- ${p.id}: `);
    expect(r.desdeCache).toBe(false);
    const nueva = r.plano.piezas.find((p) => p.pieza === "parlantes");
    expect(nueva).toMatchObject({ origen: "manual" });
    expect(nueva?.cita?.pagina).toBe(51);
    // Lo que ya estaba no se movió.
    for (const p of a.plano.piezas) expect(r.plano.piezas.find((q) => q.pieza === p.pieza)?.pos).toEqual(p.pos);
    expect(r.paginasLeidas).toEqual([51, 12]);
    // La tercera vez ya cubre: no hay IA.
    const otra = await obtenerPlano(e, { cache, descargar, llamar });
    expect(otra.desdeCache).toBe(true);
    expect(llamadas).toHaveLength(1);
  });

  it("con manual, si la IA no ve la pieza nueva en una página, va según el esqueleto y no se vuelve a pedir", async () => {
    const cache = cachePlanosEnMemoria();
    const { llamadas, llamar } = contador();
    await obtenerPlano(entrada, { cache, llamar });
    const { entrada: e, descargar } = await conRecorte();
    const r = await obtenerPlano(e, { cache, descargar, llamar: async () => parlantes(null) });
    expect(r.plano.piezas.find((p) => p.pieza === "parlantes")?.origen).not.toBe("manual");
    expect(r.paginasLeidas).toBeNull();
    expect((await obtenerPlano(e, { cache, descargar, llamar })).desdeCache).toBe(true);
    expect(llamadas).toHaveLength(1);
  });

  it("la plantilla genérica (IA falló) no se guarda", async () => {
    const cache = cachePlanosEnMemoria();
    const falla: LlamarIA = async () => "no es json";
    const r = await obtenerPlano(entrada, { cache, llamar: falla });
    expect(r.origen).toBe("plantilla");
    const { llamadas, llamar } = contador();
    expect((await obtenerPlano(entrada, { cache, llamar })).desdeCache).toBe(false);
    expect(llamadas).toHaveLength(1);
  });

  it("sin modelo en la ficha no hay clave: genera y no guarda", async () => {
    const cache = cachePlanosEnMemoria();
    const { llamadas, llamar } = contador();
    const sinModelo = { ...fichaEjemplo, modelo: { valor: null, estado: "desconocido" as const } };
    await obtenerPlano({ ...entrada, ficha: sinModelo }, { cache, llamar });
    await obtenerPlano({ ...entrada, ficha: sinModelo }, { cache, llamar });
    expect(llamadas).toHaveLength(2);
  });

  it("con el manual entero, el pedido arranca igual que la lectura del bibliotecario (caché de prompts)", async () => {
    const { llamadas, llamar } = contador();
    const { pedidos, enviar } = enviarFalso();
    const conUrl: KnowledgePack = { ...kp, fuentes: [{ doc: "Otro documento" }, { doc: "Manual de servicio X1", url: "https://ej.com/x1.pdf" }] };
    const r = await obtenerPlano(
      { ...entrada, knowledgePack: conUrl, manualUrl: "https://ej.com/x1.pdf", manual: { fileId: "file_123", paginasVistaExplosionada: [51, 52] } },
      { cache: cachePlanosEnMemoria(), llamar, enviar },
    );
    expect(r.origen).toBe("ia");
    expect(llamadas).toHaveLength(0);
    const [p] = pedidos;
    // Mismo prefijo que leerManual: system, effort y el documento (con el título de las fuentes del pack).
    expect(p.system).toBe(SYSTEM_LECTOR);
    expect(p.output_config).toEqual({ effort: LIMITES.lectura.effort });
    const contenido = p.messages[0].content as Anthropic.ContentBlockParam[];
    expect(contenido[0]).toEqual(bloqueManual({ fileId: "file_123", titulo: "Manual de servicio X1" }));
    // La tarea del cartógrafo va después del documento.
    expect(JSON.stringify(contenido[1])).toContain("páginas 51, 52");
    expect(JSON.stringify(contenido[1])).toContain("Respondé SOLO con un objeto JSON");
  });

  it("con el manual entero, si el JSON no valida dos veces cae a la plantilla", async () => {
    const { pedidos, enviar } = enviarFalso("esto no es un plano");
    const r = await obtenerPlano(
      { ...entrada, manual: { fileId: "file_123" } },
      { cache: cachePlanosEnMemoria(), enviar },
    );
    expect(pedidos).toHaveLength(2);
    expect(r.origen).toBe("plantilla");
  });

  it("con la vista interior y la URL, la IA lee solo esas páginas (no el manual entero)", async () => {
    const { llamadas, llamar } = contador();
    const pdf = Buffer.from(await pdfDePrueba(60));
    const r = await obtenerPlano(
      { ...entrada, manualUrl: "https://ej.com/hmm.pdf", manual: { fileId: "file_123", paginasVistaExplosionada: [12], paginaVistaInterior: 51 } },
      { cache: cachePlanosEnMemoria(), llamar, descargar: async () => new Response(pdf) },
    );
    expect(r.paginasLeidas).toEqual([51, 12]);
    expect(llamadas[0].contenido[0]).toMatchObject({ type: "document", source: { type: "base64", media_type: "application/pdf" } });
    expect(JSON.stringify(llamadas[0].contenido)).not.toContain("file_123");
    expect(JSON.stringify(llamadas[0].contenido)).toContain("la hoja 1 es la página 51");
  });

  it("si no se puede bajar el manual para recortarlo, lee el manual entero", async () => {
    const { pedidos, enviar } = enviarFalso();
    const r = await obtenerPlano(
      { ...entrada, manualUrl: "https://ej.com/hmm.pdf", manual: { fileId: "file_123", paginaVistaInterior: 51 } },
      { cache: cachePlanosEnMemoria(), enviar, descargar: async () => new Response("no", { status: 404 }) },
    );
    expect(r.paginasLeidas).toBeNull();
    const contenido = pedidos[0].messages[0].content as Anthropic.ContentBlockParam[];
    expect(contenido[0]).toMatchObject({ type: "document", source: { type: "file", file_id: "file_123" } });
  });
});
