import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { COMPATIBILIDAD, textoEnvio, textoTotal } from "../../components/compras/textos";
import type { EnviarMensaje } from "../ia/claude";
import { buscarOpciones } from "./agente";
import { costoDe } from "./costo";
import type { Propuesta } from "./esquemas";
import { claveUrl, elegirOpciones, montoVisto, recolectarEvidencia } from "./verificar";

const ML = "https://articulo.mercadolibre.com.uy/MLU-111-ventilador-thinkpad-_JM";
const ML_SIN_FRU = "https://articulo.mercadolibre.com.uy/MLU-222-cooler-notebook-_JM";
const TIENDA = "https://www.tienda.com/fan-e14";
const DOLAR = "https://www.brou.com.uy/cotizaciones";

const busqueda = (resultados: { url: string; title: string }[]): Anthropic.WebSearchToolResultBlock =>
  ({
    type: "web_search_tool_result",
    tool_use_id: "s1",
    caller: { type: "direct" },
    content: resultados.map((r) => ({ type: "web_search_result", encrypted_content: "", page_age: null, ...r })),
  }) as Anthropic.WebSearchToolResultBlock;

const lectura = (url: string, texto: string): Anthropic.WebFetchToolResultBlock =>
  ({
    type: "web_fetch_tool_result",
    tool_use_id: "f1",
    caller: { type: "direct" },
    content: {
      type: "web_fetch_result",
      url,
      retrieved_at: null,
      content: { type: "document", title: null, citations: null, source: { type: "text", media_type: "text/plain", data: texto } },
    },
  }) as Anthropic.WebFetchToolResultBlock;

const BLOQUES: Anthropic.ContentBlock[] = [
  busqueda([
    { url: ML, title: "Ventilador Lenovo ThinkPad E14 5F10S13875" },
    { url: ML_SIN_FRU, title: "Cooler para notebook universal" },
    { url: TIENDA, title: "Fan for ThinkPad E14 Gen 2" },
  ]),
  lectura(`${ML}?tracking=1`, "Ventilador FRU 5F10-S13875. Precio $ 1.290. Envío gratis a todo el país."),
  lectura(DOLAR, "Dólar eBROU compra 39,50 venta 41,00"),
];

const candidato = (url: string, precio: number, moneda: "UYU" | "USD" = "UYU", envio: number | null = 0, llega: boolean | null = true) => ({
  url,
  titulo: "aviso",
  tienda: "tienda",
  precio,
  moneda,
  envio,
  llegaAUruguay: llega,
});

const PEDIDO = { pieza: "ventilador", numeroParte: "5F10S13875", modelo: "ThinkPad E14 Gen 2" };

describe("verificar", () => {
  const ev = recolectarEvidencia(BLOQUES);

  it("la clave de URL ignora www, query y barra final; rechaza lo que no es http(s)", () => {
    expect(claveUrl("https://www.tienda.com/fan-e14/?a=1#x")).toBe("tienda.com/fan-e14");
    expect(claveUrl("javascript:alert(1)")).toBeNull();
  });

  it("encuentra montos con separadores de miles", () => {
    expect(montoVisto("Precio $ 1.290", 1290)).toBe(true);
    expect(montoVisto("US$ 1,290.00", 1290)).toBe(true);
    expect(montoVisto("12900 pesos", 1290)).toBe(false);
  });

  it("verifica por número de parte, por modelo o lo marca no verificado; ordena compatibles primero", () => {
    const propuesta: Propuesta = {
      cotizacion: null,
      candidatos: [candidato(ML_SIN_FRU, 500), candidato(TIENDA, 900), candidato(ML, 1290)],
    };
    const r = elegirOpciones(propuesta, ev, PEDIDO);
    expect(r.opciones.map((o) => [o.url, o.compatibilidad])).toEqual([
      [ML, "numero_parte"], // la primera URL que devolvió la API
      [TIENDA, "modelo"],
      [ML_SIN_FRU, "no_verificado"],
    ]);
  });

  it("precio confirmado solo si se vio en la página leída", () => {
    const r = elegirOpciones({ cotizacion: null, candidatos: [candidato(ML, 1290), candidato(TIENDA, 900)] }, ev, PEDIDO);
    expect(r.opciones[0].precio.estado).toBe("confirmado");
    expect(r.opciones[0].envio).toEqual({ monto: 0, estado: "confirmado" });
    expect(r.opciones[1].precio.estado).toBe("probable");
  });

  it("descarta URLs inventadas, repetidas y las que no envían a Uruguay", () => {
    const r = elegirOpciones(
      {
        cotizacion: null,
        candidatos: [
          candidato("https://inventada.com/x", 10),
          candidato("javascript:alert(1)", 10),
          candidato(ML, 1290),
          candidato(`${ML}/`, 1000),
          candidato(TIENDA, 900, "UYU", null, false),
        ],
      },
      ev,
      PEDIDO,
    );
    expect(r.opciones).toHaveLength(1);
    expect(r.descartados).toHaveLength(3);
  });

  it("convierte dólares con una cotización leída; sin fuente, no hay total en pesos", () => {
    const usd = { candidatos: [candidato(TIENDA, 20, "USD", 5)] };
    expect(elegirOpciones({ ...usd, cotizacion: { uyuPorUsd: 41, url: DOLAR } }, ev, PEDIDO).opciones[0].totalUyu).toBe(1025);
    const sinFuente = elegirOpciones({ ...usd, cotizacion: { uyuPorUsd: 41, url: "https://x.com/dolar" } }, ev, PEDIDO);
    expect(sinFuente.cotizacion).toBeNull();
    expect(sinFuente.opciones[0].totalUyu).toBeNull();
  });

  it("dentro de la misma compatibilidad gana el total más barato", () => {
    const otra = "https://articulo.mercadolibre.com.uy/MLU-333-ventilador-_JM";
    const ev2 = recolectarEvidencia([busqueda([{ url: otra, title: "Fan 5F10S13875" }])], recolectarEvidencia(BLOQUES));
    const r = elegirOpciones({ cotizacion: null, candidatos: [candidato(ML, 1290), candidato(otra, 1000, "UYU", 100)] }, ev2, PEDIDO);
    expect(r.opciones.map((o) => o.totalUyu)).toEqual([1100, 1290]);
  });
});

const uso = (u: Partial<Anthropic.Usage>): Pick<Anthropic.Message, "usage"> => ({
  usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: null, cache_read_input_tokens: null, server_tool_use: null, ...u } as Anthropic.Usage,
});

describe("costo", () => {
  it("suma tokens y búsquedas a precio de lista", () => {
    const c = costoDe([
      uso({ input_tokens: 10_000, output_tokens: 1_000, server_tool_use: { web_search_requests: 2, web_fetch_requests: 1 } }),
      uso({ input_tokens: 20_000, output_tokens: 2_000, server_tool_use: { web_search_requests: 1, web_fetch_requests: 0 } }),
    ]);
    // 30K × 0,10/M + 3K × 0,50/M + 3 × 0,01
    expect(c).toMatchObject({ tokensEntrada: 30_000, tokensSalida: 3_000, busquedas: 3, usd: 0.0345 });
  });
});

const mensaje = (content: Anthropic.ContentBlock[], stop: Anthropic.StopReason = "end_turn"): Anthropic.Message =>
  ({ content, stop_reason: stop, usage: uso({ input_tokens: 1000, output_tokens: 100 }).usage }) as Anthropic.Message;
const texto = (t: string) => ({ type: "text", text: t, citations: null }) as Anthropic.TextBlock;

describe("buscarOpciones", () => {
  it("sigue tras pause_turn, verifica y devuelve el costo", async () => {
    const respuestas = [
      mensaje(BLOQUES, "pause_turn"),
      mensaje([texto(JSON.stringify({ cotizacion: null, candidatos: [candidato(ML, 1290)] }))]),
    ];
    const pedidos: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const enviar: EnviarMensaje = async (p) => {
      pedidos.push(structuredClone(p));
      return respuestas.shift()!;
    };
    const r = await buscarOpciones(PEDIDO, { enviar });
    expect(r.opciones[0].compatibilidad).toBe("numero_parte");
    expect(r.costo.tokensEntrada).toBe(2000);
    expect(pedidos[0].model).toBe("claude-haiku-5-5");
    // La API no acepta country "UY" en la ubicación de la búsqueda: con eso fallaba todo (prueba real, #197).
    expect(JSON.stringify(pedidos[0].tools)).not.toContain("user_location");
    expect(pedidos[1].messages).toHaveLength(2);
  });

  it("pide corregir una vez y si vuelve a fallar no es un error: vuelve sin opciones y con motivo «incompleta»", async () => {
    let llamadas = 0;
    const enviar: EnviarMensaje = async () => {
      llamadas++;
      return mensaje([texto("no sé")]);
    };
    const r = await buscarOpciones(PEDIDO, { enviar });
    expect(llamadas).toBe(2);
    expect(r).toMatchObject({ opciones: [], motivo: "incompleta" });
    expect(r.costo.tokensEntrada).toBe(2000);
  });

  it("pasado el plazo deja de buscar: pide el JSON sin herramientas y devuelve lo que encontró (antes del corte de la ruta)", async () => {
    let reloj = 0;
    const pedidos: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const enviar: EnviarMensaje = async (p) => {
      pedidos.push(structuredClone(p));
      reloj += 40_000; // cada vuelta de búsqueda tarda
      return p.tool_choice?.type === "none"
        ? mensaje([texto(JSON.stringify({ cotizacion: null, candidatos: [candidato(ML, 1290)] }))])
        : mensaje(BLOQUES, "pause_turn");
    };
    const r = await buscarOpciones(PEDIDO, { enviar, ahora: () => reloj });
    expect(r.opciones).toHaveLength(1);
    expect(r.motivo).toBeUndefined();
    expect(pedidos.slice(0, -1).every((p) => !p.tool_choice)).toBe(true);
    const ultimo = pedidos.at(-1)!;
    expect(ultimo.tool_choice).toEqual({ type: "none" });
    expect(JSON.stringify(ultimo.messages.at(-1))).toContain("Se terminó el tiempo de búsqueda");
    expect(pedidos.length).toBeLessThanOrEqual(4); // 75 s de plazo: 2 vueltas de 40 s y el cierre
  });

  it("busca con el nombre de la pieza (no con el id del pack) y sin número de parte dice «desconocido»", async () => {
    const pedidos: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const enviar: EnviarMensaje = async (p) => {
      pedidos.push(structuredClone(p));
      return mensaje([texto(JSON.stringify({ cotizacion: null, candidatos: [] }))]);
    };
    const r = await buscarOpciones({ pieza: "conector_lightning", nombre: "Conector Lightning de carga", numeroParte: null, modelo: "iPhone 13", marca: "Apple" }, { enviar });
    expect(r).toMatchObject({ opciones: [] });
    expect(r.motivo).toBeUndefined();
    const pedido = JSON.stringify(pedidos[0].messages[0]);
    expect(pedido).toContain("Conector Lightning de carga");
    expect(pedido).toContain("número de parte (FRU): desconocido");
  });
});

describe("textos de la tarjeta", () => {
  const base = elegirOpciones({ cotizacion: null, candidatos: [candidato(TIENDA, 900, "UYU", null)] }, recolectarEvidencia(BLOQUES), PEDIDO)
    .opciones[0];

  it("dice cuando el envío no se sabe y que el total no lo incluye", () => {
    expect(textoEnvio(base)).toBe("Envío a Uruguay: a confirmar");
    expect(textoTotal(base)).toMatch(/^Total sin envío/);
  });

  it("solo número de parte o modelo cuentan como verificado", () => {
    expect(Object.entries(COMPATIBILIDAD).filter(([, v]) => v.verificado).map(([k]) => k)).toEqual(["numero_parte", "modelo"]);
  });
});
