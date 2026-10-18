import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { OpcionCompra, PedidoCompra, ResultadoCompras } from "../../lib/compras/esquemas";
import { MENSAJE_PAUSA } from "../../lib/ia/pausa";
import { MENSAJES, buscar, crearFuenteApi, hrefSeguro, type FuenteCompras } from "./fuente";
import { VistaCompras } from "./OpcionesCompra";

/** Respuestas simuladas: nada de esto llama a la IA ni a internet. */
const opcion = (n: number, cambios: Partial<OpcionCompra> = {}): OpcionCompra => ({
  url: `https://articulo.mercadolibre.com.uy/MLU-${n}-ventilador-_JM`,
  titulo: `Ventilador notebook ${n}`,
  tienda: `Tienda ${n}`,
  compatibilidad: "numero_parte",
  precio: { monto: 1000 + n, moneda: "UYU", estado: "confirmado" },
  envio: { monto: 0, estado: "confirmado" },
  totalUyu: 1000 + n,
  ...cambios,
});

const TRES: OpcionCompra[] = [
  opcion(1),
  opcion(2, { compatibilidad: "modelo", envio: { monto: 250, estado: "probable" }, totalUyu: 1252 }),
  opcion(3, {
    compatibilidad: "no_verificado",
    precio: { monto: 30, moneda: "USD", estado: "probable" },
    envio: { monto: null, estado: "desconocido" },
    totalUyu: null,
  }),
];

const resultado = (opciones: OpcionCompra[]): ResultadoCompras & { eventos: [] } => ({
  opciones,
  cotizacion: null,
  descartados: [],
  costo: { modelo: "claude-haiku-5-5", tokensEntrada: 1, tokensSalida: 1, busquedas: 1, usd: 0.01 },
  eventos: [],
});

const PEDIDO: PedidoCompra = { pieza: "ventilador", numeroParte: "5F10S13875", modelo: "NB-15" };
const respuesta = (status: number, cuerpo: unknown) =>
  new Response(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
const fuenteCon = (r: Response | Error, plazo?: number) =>
  crearFuenteApi((async () => (r instanceof Error ? Promise.reject(r) : r)) as typeof fetch, plazo);
/** HTML de la vista; los espacios duros de Intl ("$ 250") como espacios comunes. */
const html = (estado: Parameters<typeof VistaCompras>[0]["estado"], pedido: Parameters<typeof VistaCompras>[0]["pedido"] = PEDIDO) =>
  renderToStaticMarkup(<VistaCompras estado={estado} pedido={pedido} onBuscar={() => {}} />).replace(/\u00a0/g, " ");
/** Las dos piezas del caso real (iPhone 13): una sin número de parte y otra con. Y un TV. */
const CONECTOR: PedidoCompra = { pieza: "conector_lightning", nombre: "Conector Lightning de carga", numeroParte: null, modelo: "iPhone 13", marca: "Apple" };
const BATERIA: PedidoCompra = { pieza: "bateria", nombre: "Batería", numeroParte: "661-21991", modelo: "iPhone 13", marca: "Apple" };
const FUENTE_TV: PedidoCompra = { pieza: "fuente", nombre: "Fuente de alimentación", numeroParte: null, modelo: "55V6C", marca: "TCL" };
const PLACA_TV: PedidoCompra = { pieza: "placa_principal", nombre: "Placa principal", numeroParte: "40-MT56E1-MAB2HG", modelo: "55V6C", marca: "TCL" };

describe("fuente de /api/compras", () => {
  const senal = () => new AbortController().signal;

  it("devuelve las opciones validadas", async () => {
    const r = await fuenteCon(respuesta(200, resultado(TRES)))(PEDIDO, senal());
    expect(r.opciones).toHaveLength(3);
  });

  it.each([
    ["sin conexión", new TypeError("Failed to fetch"), MENSAJES.sinConexion],
    ["la IA no pudo (502)", respuesta(502, { error: "La IA no pudo responder." }), MENSAJES.ia],
    ["el servidor cortó por tiempo (504 de Vercel, sin JSON)", respuesta(504, "An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT"), MENSAJES.tardo],
    ["error interno (500) sin JSON", respuesta(500, "<html>"), MENSAJES.interno],
    ["entrada inválida (400)", respuesta(400, { error: "Entrada inválida" }), MENSAJES.faltanDatos],
    ["tope de gasto: IA en pausa (503)", respuesta(503, { codigo: "ia_en_pausa" }), MENSAJE_PAUSA],
    ["200 con forma rara", respuesta(200, { opciones: [{ url: "javascript:alert(1)" }] }), MENSAJES.interno],
    ["200 vacío", respuesta(200, "null"), MENSAJES.interno],
  ])("%s → mensaje claro", async (_, r, mensaje) => {
    await expect(fuenteCon(r)(PEDIDO, senal())).rejects.toThrow(mensaje);
  });

  it("si tarda demasiado, corta y lo dice", async () => {
    const colgada: typeof fetch = (_url, init) =>
      new Promise((_, rechazar) => init?.signal?.addEventListener("abort", () => rechazar(new DOMException("abort", "AbortError"))));
    await expect(crearFuenteApi(colgada, 20)(PEDIDO, senal())).rejects.toThrow(MENSAJES.tardo);
  });
});

describe("buscar (lo que hace la pantalla con cada respuesta)", () => {
  it("con resultados queda lista y reenvía los eventos", async () => {
    const onEvento = vi.fn();
    const fuente: FuenteCompras = async () => ({ ...resultado(TRES), eventos: [{ id: "e", casoId: "c", agente: "compras", tipo: "x", mensaje: "m", ts: "t" }] });
    expect(await buscar(fuente, PEDIDO, new AbortController().signal, onEvento)).toEqual({ t: "listo", opciones: TRES });
    expect(onEvento).toHaveBeenCalledTimes(1);
  });

  it("un error inesperado (no de la API) nunca llega crudo a la pantalla", async () => {
    const rota = (async () => ({ opciones: TRES })) as unknown as FuenteCompras; // sin `eventos`
    expect(await buscar(rota, PEDIDO, new AbortController().signal)).toEqual({ t: "error", mensaje: MENSAJES.general });
  });

  it("si la pantalla la cortó, no muestra nada", async () => {
    const c = new AbortController();
    const fuente: FuenteCompras = async () => {
      c.abort();
      throw new Error("abort");
    };
    expect(await buscar(fuente, PEDIDO, c.signal)).toBeNull();
  });
});

describe("<VistaCompras>", () => {
  it("muestra los 3 resultados con precio, envío a Uruguay y verificado / no verificado", () => {
    const h = html({ t: "listo", opciones: TRES });
    expect(h.match(/<li/g)).toHaveLength(3);
    expect(h.match(/>✓ Verificado</g)).toHaveLength(2);
    expect(h).toContain(">No verificado<");
    expect(h).toContain("Envío a Uruguay: gratis");
    expect(h).toContain("Envío a Uruguay: $ 250");
    expect(h).toContain("Envío a Uruguay: a confirmar");
    expect(h).toContain("Mejor opción");
    expect(h).toContain("Precio sin confirmar");
    expect(h).toMatch(/US\$\s?30/);
  });

  it('"Comprar" abre la publicación en otra pestaña y no hay nada que pague', () => {
    const h = html({ t: "listo", opciones: TRES });
    const links = [...h.matchAll(/<a [^>]*>/g)].map((m) => m[0]);
    expect(links).toHaveLength(3);
    for (const [i, a] of links.entries()) {
      expect(a).toContain(`href="${TRES[i].url}"`);
      expect(a).toContain('target="_blank"');
      expect(a).toContain('rel="noopener noreferrer"');
    }
    expect(h).not.toMatch(/<form|<input|pagar ahora|tarjeta/i);
    expect(h).toContain("Ahí pagás vos");
  });

  it("un link que no es http(s) no se muestra como botón", () => {
    const h = html({ t: "listo", opciones: [opcion(1, { url: "javascript:alert(1)" })] });
    expect(h).not.toContain("<a ");
    expect(h).toContain("No tengo un link seguro");
    expect(hrefSeguro("javascript:alert(1)")).toBeNull();
    expect(hrefSeguro("https://tienda.uy/x")).toBe("https://tienda.uy/x");
  });

  it("el título dice el nombre de la pieza, no el id del pack", () => {
    const h = html({ t: "inicio" }, CONECTOR);
    expect(h).toContain("Conector Lightning de carga");
    expect(h).not.toContain("conector_lightning");
    // Sin nombre en el pack, el id legible.
    expect(html({ t: "inicio" }, { ...CONECTOR, nombre: null })).toContain("Conector lightning");
  });

  it.each([
    ["celular, sin N.º de parte", CONECTOR, "busqué por modelo", "conector-lightning-de-carga-apple-iphone-13"],
    ["celular, con N.º de parte", BATERIA, "N.º de parte 661-21991", "661-21991"],
    ["TV, sin N.º de parte", FUENTE_TV, "busqué por modelo", "fuente-de-alimentacion-tcl-55v6c"],
    ["TV, con N.º de parte", PLACA_TV, "N.º de parte 40-MT56E1-MAB2HG", "40-mt56e1-mab2hg"],
  ])("sin resultados (%s): dice qué pasó y ofrece buscarlo en Mercado Libre, sin decir que está verificado", (_, pedido, dice, consulta) => {
    const h = html({ t: "listo", opciones: [] }, pedido);
    expect(h).toContain(`No encontré publicaciones de ${pedido.nombre} para ${pedido.marca} ${pedido.modelo} con envío a Uruguay`);
    expect(h).toContain(dice);
    expect(h).toContain(`href="https://listado.mercadolibre.com.uy/${consulta}"`);
    expect(h).toContain("no está verificado que sea compatible");
    expect(h).toContain("Buscar de nuevo");
    expect(h).not.toContain("<li");
    expect(h).not.toMatch(/probá de nuevo/i);
  });

  it("búsqueda incompleta (el agente no cerró a tiempo): lo dice, no que no hay", () => {
    const h = html({ t: "listo", opciones: [], motivo: "incompleta" }, CONECTOR);
    expect(h).toContain("No llegué a terminar la búsqueda de Conector Lightning de carga a tiempo");
    expect(h).not.toContain("No encontré publicaciones");
    expect(h).toContain("Buscarlo en Mercado Libre");
  });

  it.each(Object.entries(MENSAJES))("si falla (%s): la causa, la alternativa y buscar de nuevo, como alerta", (_, mensaje) => {
    const h = html({ t: "error", mensaje }, CONECTOR);
    expect(h).toContain('role="alert"');
    expect(h).toContain(mensaje);
    expect(h).toContain("Buscarlo en Mercado Libre");
    expect(h).toContain("Buscar de nuevo");
    expect(mensaje).not.toMatch(/probá de nuevo/i);
  });

  it("antes de buscar, un botón; buscando, un aviso (cada búsqueda cuesta: no arranca sola)", () => {
    expect(html({ t: "inicio" })).toContain("Ver dónde comprar esta pieza");
    expect(html({ t: "buscando" })).toContain('aria-busy="true"');
  });
});
