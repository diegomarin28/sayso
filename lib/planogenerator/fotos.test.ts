import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { fichaEjemplo, type Ficha, type KnowledgePack } from "../../shared";
import { ErrorIA, type EnviarMensaje, type LlamarIA, type PedidoIA } from "../ia/claude";
import type { Fetch } from "../knowledge/descargar";
import { cachePlanosEnMemoria } from "./cache";
import { buscarFotosInterior, imagenesDelInterior, nombraModelo, type BuscarFotos, type FotosInterior } from "./fotos";
import { obtenerPlano } from "./obtener";

/** #235: sin manual con vistas, las piezas se ubican con fotos del interior de ese modelo; si no hay, como hoy. */

const pieza = (id: string, nombre: string) => ({ id, nombre, descripcion: "", ubicacion: "" });
const pack = (modelo: string): KnowledgePack => ({
  modelo,
  clase: "otro",
  verificado: false,
  fuentes: [{ doc: "guía pública" }],
  piezas: [pieza("bateria", "Batería"), pieza("placa_madre", "Placa"), pieza("conector_carga", "Conector de carga"), pieza("pantalla", "Pantalla")],
  pasos: [],
  advertencias: [],
  repuestos: [],
});
const ficha = (marca: string, modelo: string): Ficha => ({
  ...fichaEjemplo,
  marca: { ...fichaEjemplo.marca, valor: marca },
  modelo: { ...fichaEjemplo.modelo, valor: modelo },
});
// Dos variantes del mismo tipo.
const VARIANTES = [
  { marca: "Samsung", modelo: "Galaxy A52" },
  { marca: "Motorola", modelo: "Moto G84" },
] as const;
const entrada = (v: (typeof VARIANTES)[number]) => ({ casoId: "c", knowledgePack: pack(v.modelo), ficha: ficha(v.marca, v.modelo), tipoEquipo: "celular" });

const fotos: FotosInterior = {
  imagenes: [
    { base64: "AAAA", mediaType: "image/jpeg" },
    { base64: "BBBB", mediaType: "image/jpeg" },
  ],
  fuente: { doc: "Fotos del interior (ifixit.com)", urls: ["https://www.ifixit.com/Teardown/a", "https://www.ifixit.com/Guide/b"] },
};
/** La IA ve la batería (corrida a la derecha) en la foto 1 y la placa en la 2; el conector no lo ve. */
const propuesta = JSON.stringify({
  base_ancho_cm: 7.5,
  base_prof_cm: 16,
  medidas_fuente: "manual",
  piezas: [
    { pieza: "bateria", x: 0.5, z: 0.2, ancho: 0.4, prof: 0.5, alto_cm: 0.5, capa: "sobre_base", sobre: null, forma: "caja", etiquetaManual: null, pagina: 1, confianza: "alta" },
    { pieza: "placa_madre", x: -0.4, z: -0.6, ancho: 0.4, prof: 0.3, alto_cm: 0.2, capa: "sobre_base", sobre: null, forma: "caja", etiquetaManual: null, pagina: 2, confianza: "alta" },
    { pieza: "conector_carga", x: 0, z: 0.9, ancho: 0.2, prof: 0.1, alto_cm: 0.3, capa: "sobre_base", sobre: null, forma: "caja", etiquetaManual: null, pagina: null, confianza: "baja" },
  ],
});
const imagenesDe = (p: PedidoIA) => p.contenido.filter((b) => b.type === "image").length;
/** Sin imágenes, la IA solo estima: ninguna pieza en una página. */
const sinPaginas = JSON.stringify({ ...JSON.parse(propuesta), medidas_fuente: "estimada", piezas: JSON.parse(propuesta).piezas.map((p: object) => ({ ...p, pagina: null })) });
const ia = (falla = 0) => {
  const pedidos: PedidoIA[] = [];
  const llamar: LlamarIA = async (p) => {
    pedidos.push(p);
    if (pedidos.length <= falla) throw new ErrorIA("se cortó");
    return imagenesDe(p) ? propuesta : sinPaginas;
  };
  return { pedidos, llamar };
};

describe("obtenerPlano con fotos del interior (#235)", () => {
  it.each(VARIANTES)("$marca $modelo: lo que la IA vio en una foto queda con origen «foto» y la URL; lo demás, estimado", async (v) => {
    const { pedidos, llamar } = ia();
    const r = await obtenerPlano(entrada(v), { cache: cachePlanosEnMemoria(), llamar, buscarFotos: async () => fotos });
    expect(imagenesDe(pedidos[0])).toBe(2);
    const de = (id: string) => r.plano.piezas.find((p) => p.pieza === id)!;
    expect(de("bateria").origen).toBe("foto");
    expect(de("bateria").cita).toMatchObject({ doc: fotos.fuente.doc, url: fotos.fuente.urls[0] });
    expect(de("placa_madre").cita?.url).toBe(fotos.fuente.urls[1]);
    // Lo que no vio queda como hoy: estimado o genérico (el esqueleto del tipo lo ubica), nunca "foto".
    const sinFotos = await obtenerPlano(entrada(v), { cache: cachePlanosEnMemoria(), llamar: ia().llamar });
    const hoy = (id: string) => sinFotos.plano.piezas.find((p) => p.pieza === id)!;
    expect(de("conector_carga").origen).toBe(hoy("conector_carga").origen);
    expect(["estimada", "plantilla"]).toContain(de("conector_carga").origen);
    // Ninguna pieza dice "manual" ni las medidas salen de una foto.
    expect(r.plano.piezas.some((p) => p.origen === "manual")).toBe(false);
    expect(r.plano.medidas).toEqual({ ancho: "estimada", prof: "estimada" });
    // La batería queda donde la vio la IA (a la derecha), no donde la pone el esqueleto del celular.
    expect(de("bateria").pos[0]).toBeGreaterThan(hoy("bateria").pos[0] + 0.5);
    expect(r.avisos[0]).toMatch(/2 fotos del interior/);
  });

  const casos: [string, BuscarFotos][] = [
    ["no encuentra nada", async () => null],
    ["la búsqueda falla", async () => Promise.reject(new Error("sin red"))],
  ];
  it.each(casos)("si %s, el plano es el de hoy (estimado), sin error", async (_, buscarFotos) => {
    for (const v of VARIANTES) {
      const hoy = await obtenerPlano(entrada(v), { cache: cachePlanosEnMemoria(), llamar: ia().llamar });
      const { pedidos, llamar } = ia();
      const r = await obtenerPlano(entrada(v), { cache: cachePlanosEnMemoria(), llamar, buscarFotos });
      expect(r.plano).toEqual(hoy.plano);
      expect(pedidos.map(imagenesDe)).toEqual([0]);
      expect(r.plano.piezas.some((p) => p.origen === "foto")).toBe(false);
    }
  });

  it("si la IA no puede con las fotos, vuelve a intentar como hoy (sin fotos)", async () => {
    const { pedidos, llamar } = ia(2); // el pedido con fotos falla (y su reintento)
    const r = await obtenerPlano(entrada(VARIANTES[0]), { cache: cachePlanosEnMemoria(), llamar, buscarFotos: async () => fotos });
    expect(r.origen).toBe("ia");
    expect(pedidos.at(-1) && imagenesDe(pedidos.at(-1)!)).toBe(0);
    expect(r.plano.piezas.some((p) => p.origen === "foto")).toBe(false);
  });

  it("con manual o con un plano guardado no se buscan fotos", async () => {
    let buscadas = 0;
    const buscarFotos: BuscarFotos = async () => (buscadas++, fotos);
    const cache = cachePlanosEnMemoria();
    await obtenerPlano({ ...entrada(VARIANTES[0]), imagenes: [{ base64: "CCCC", mediaType: "image/png" }], paginas: [12] }, { cache, llamar: ia().llamar, buscarFotos });
    await obtenerPlano(entrada(VARIANTES[0]), { cache, llamar: ia().llamar, buscarFotos });
    expect(buscadas).toBe(0);
  });
});

describe("buscarFotosInterior (sin red ni IA)", () => {
  const html = (modelo: string) => `<html><body><h1>${modelo} Teardown</h1>
    <img src="/logo.png" alt="logo">
    <img src="https://cdn.x.com/paso1.jpg" alt="Battery and motherboard exposed" width="800">
    <img data-src="/img/interior-2.jpg" alt="Inside view">
    <img src="/avatar/u.jpg" alt="autor"></body></html>`;
  const jpg = Buffer.alloc(40_000, 1);
  const red = (paginas: Record<string, string>): Fetch =>
    (async (url: string) => {
      if (paginas[url]) return new Response(paginas[url], { headers: { "content-type": "text/html" } });
      if (/\.jpg$/.test(url)) return new Response(jpg, { headers: { "content-type": "image/jpeg" } });
      return new Response("", { status: 404 });
    }) as unknown as Fetch;
  const haiku = (paginas: string[]): EnviarMensaje =>
    (async () => ({ content: [{ type: "text", text: JSON.stringify({ paginas }) }], stop_reason: "end_turn" })) as unknown as EnviarMensaje;

  it("se queda con las imágenes del equipo abierto de las páginas que nombran el modelo", async () => {
    const r = await buscarFotosInterior(
      { marca: "Samsung", modelo: "Galaxy A52", clase: "otro" },
      { enviar: haiku(["https://otro.com/a72", "https://ifixit.com/a52"]), fetch: red({ "https://otro.com/a72": html("Galaxy A72"), "https://ifixit.com/a52": html("Galaxy A52") }) },
    );
    expect(r?.imagenes).toHaveLength(2);
    expect(r?.fuente.urls).toEqual(["https://ifixit.com/a52", "https://ifixit.com/a52"]);
    expect(r?.fuente.doc).toBe("Fotos del interior (ifixit.com)");
  });

  it("null si no hay páginas, si ninguna nombra el modelo o si la búsqueda falla", async () => {
    const equipo = { marca: "Samsung", modelo: "Galaxy A52", clase: "otro" as const };
    expect(await buscarFotosInterior(equipo, { enviar: haiku([]), fetch: red({}) })).toBeNull();
    expect(await buscarFotosInterior(equipo, { enviar: haiku(["https://otro.com/a72"]), fetch: red({ "https://otro.com/a72": html("Galaxy A72") }) })).toBeNull();
    const falla: EnviarMensaje = async () => {
      throw new Error("429");
    };
    expect(await buscarFotosInterior(equipo, { enviar: falla, fetch: red({}) })).toBeNull();
  });

  it("nombraModelo e imagenesDelInterior", () => {
    expect(nombraModelo("<p>Samsung Galaxy-A52 5G</p>", "Galaxy A52")).toBe(true);
    expect(nombraModelo("<p>Galaxy A72</p>", "Galaxy A52")).toBe(false);
    expect(imagenesDelInterior(html("x"), "https://ifixit.com/g")).toEqual(["https://cdn.x.com/paso1.jpg", "https://ifixit.com/img/interior-2.jpg"]);
  });
});

// Para que el tipo de la respuesta falsa no se pierda (Anthropic.Message tiene más campos).
export type _ = Anthropic.Message;
