import { describe, expect, it } from "vitest";
import type { KnowledgePack, PlanoDePiezas } from "../../shared";
import type { LlamarIA, PedidoIA } from "../ia/claude";
import { claveManual } from "../knowledge/manuales";
import { cachePlanosEnMemoria } from "./cache";
import { fotosDeLaGuia, fotosDelInterior } from "./fotos-guia";
import { delLadoDeLaPlanta, type PropuestaPlano } from "./generador";
import { obtenerPlano } from "./obtener";
import { elegirPlantilla } from "./plantillas/por-tipo";

/**
 * #235: sin manual con vistas, el cartógrafo ubica las piezas mirando las fotos del equipo abierto de la guía
 * (los pasos de iFixit). Equipos ficticios: las reglas son por tipo, nunca por modelo. Sin red ni IA.
 */
const GUIA = "https://www.guias.ej/Guide/Tablo+6+Battery/50";
const paso = (n: number) => `${GUIA}#s${500 + n}`;
const foto = (n: number) => `https://img.cdn.guias.ej/igi/${n}.standard`;
/** Lo que devuelve `fotosDelInterior`: la foto y el paso que cita. */
const par = (n: number) => ({ paso: paso(n), foto: foto(n) });

const pack = (tipo: string, pasos: [string, string[]][]): KnowledgePack => ({
  modelo: `${tipo} X`,
  clase: "otro",
  verificado: false,
  fuentes: [{ doc: "Guía de Tablo", url: GUIA }],
  piezas: ["pantalla", "bateria", "placa_madre", "camara_trasera", "tornillos"].map((id) => ({ id, nombre: id, descripcion: "", ubicacion: "" })),
  pasos: pasos.map(([texto, piezas], i) => ({
    id: `p${i + 1}`,
    orden: i + 1,
    texto,
    piezas,
    riesgo: "bajo" as const,
    cita: { doc: "Guía de Tablo", url: paso(i + 1), estado: "NO_VERIFICABLE" as const },
  })),
  advertencias: [],
  repuestos: [],
});

const PASOS: [string, string[]][] = [
  ["Calentá el borde de la pantalla.", ["pantalla"]],
  ["Despegá la pantalla.", ["pantalla"]],
  ["Sacá los tornillos del soporte.", ["tornillos"]],
  ["Desconectá la batería de la placa.", ["bateria", "placa_madre"]],
  ["Sacá la cámara de la placa.", ["camara_trasera", "placa_madre"]],
  ["Despegá la batería.", ["bateria"]],
];
const todas = Object.fromEntries(PASOS.map((_, i) => [paso(i + 1), foto(i + 1)]));

/** Un CDN de fotos simulado: cada URL de foto devuelve un JPEG chiquito (y anota qué se pidió). */
function cdn(tipo = "image/jpeg") {
  const pedidas: string[] = [];
  const f = (async (url: string | URL) => {
    pedidas.push(String(url));
    return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { headers: { "content-type": tipo } });
  }) as typeof fetch;
  return Object.assign(f, { pedidas });
}

describe("fotosDelInterior", () => {
  it("las de los pasos que tocan más piezas internas, en el orden de la guía (no la pantalla ni los tornillos)", () => {
    expect(fotosDelInterior(pack("tablet", PASOS), todas)).toEqual([par(4), par(5), par(6)]);
    expect(fotosDelInterior(pack("tablet", PASOS), todas, 2)).toEqual([par(4), par(5)]);
  });

  it("sin fotos, ninguna", () => {
    expect(fotosDelInterior(pack("tablet", PASOS), {})).toEqual([]);
  });

  it("si ningún paso nombra piezas internas, las de la segunda mitad de la guía (ahí ya está abierto)", () => {
    const sinPiezas = PASOS.map(([t]) => [t, []] as [string, string[]]);
    expect(fotosDelInterior(pack("tablet", sinPiezas), todas)).toEqual([par(4), par(5), par(6)]);
    expect(fotosDelInterior(pack("tablet", sinPiezas), todas, 1)).toEqual([par(4)]);
  });

  it("la misma foto en dos pasos va una vez", () => {
    const repetida = { ...todas, [paso(5)]: foto(4) };
    expect(fotosDelInterior(pack("tablet", PASOS), repetida).map((x) => x.foto)).toEqual([foto(4), foto(6)]);
  });
});

describe("fotosDeLaGuia", () => {
  it("baja las elegidas, con el paso de cada una como cita y el sitio de la guía", async () => {
    const f = cdn();
    const r = (await fotosDeLaGuia(pack("tablet", PASOS), todas, f))!;
    expect(r.imagenes).toHaveLength(3);
    expect(r.imagenes[0].mediaType).toBe("image/jpeg");
    expect(r.fuente).toEqual({ doc: "Fotos de la guía (guias.ej)", urls: [paso(4), paso(5), paso(6)] });
  });

  it("solo del mismo sitio que la guía del pack y por HTTPS (las URL llegan del navegador)", async () => {
    const f = cdn();
    const ajenas = { [paso(4)]: "https://otro.sitio/x.jpg", [paso(5)]: "http://img.cdn.guias.ej/y.jpg", [paso(6)]: foto(6) };
    const r = (await fotosDeLaGuia(pack("tablet", PASOS), ajenas, f))!;
    expect(f.pedidas).toEqual([foto(6)]);
    expect(r.fuente.urls).toEqual([paso(6)]);
  });

  it("sin imágenes que sirvan (no es imagen, o falla la red), null: sigue la búsqueda web", async () => {
    expect(await fotosDeLaGuia(pack("tablet", PASOS), todas, cdn("text/html"))).toBeNull();
    const caida = (async () => {
      throw new Error("sin red");
    }) as typeof fetch;
    expect(await fotosDeLaGuia(pack("tablet", PASOS), todas, caida)).toBeNull();
  });
});

describe("delLadoDeLaPlanta: fotos abiertas por el otro lado se espejan (por tipo)", () => {
  const propuesta = (vista: "frente" | "atras"): PropuestaPlano => ({
    base_ancho_cm: null,
    base_prof_cm: null,
    vista_fotos: vista,
    piezas: [{ pieza: "bateria", x: 0.4, z: 0.1, ancho: 0.5, prof: 0.5, alto_cm: null, capa: "sobre_base", sobre: null, forma: "caja", etiquetaManual: null, pagina: 1, confianza: "alta" }],
  });
  const x = (tipo: string, vista: "frente" | "atras") => {
    const avisos: string[] = [];
    return delLadoDeLaPlanta(propuesta(vista), elegirPlantilla(pack(tipo, []), tipo)!, avisos).piezas[0].x;
  };

  it.each(["tablet", "celular"])("%s (modelado por atrás): abierto por el frente se espeja; por atrás, no", (tipo) => {
    expect(x(tipo, "frente")).toBe(-0.4);
    expect(x(tipo, "atras")).toBe(0.4);
  });

  it("reloj (modelado por la pantalla): abierto por atrás se espeja", () => {
    expect(x("reloj inteligente", "atras")).toBe(-0.4);
    expect(x("reloj inteligente", "frente")).toBe(0.4);
  });
});

describe("obtenerPlano con las fotos de la guía", () => {
  const ficha = (modelo: string) => ({
    casoId: "c",
    clase: "otro" as const,
    marca: { valor: "Marca", estado: "confirmado" as const, fuente: "usuario" as const },
    modelo: { valor: modelo, estado: "confirmado" as const, fuente: "usuario" as const },
    serie: { valor: null, estado: "desconocido" as const },
    anio: { valor: null, estado: "desconocido" as const },
    confirmadaPorUsuario: true,
  });
  /** La IA ve la batería en la foto 1, abajo a la derecha, y la placa en la 2. */
  function ia(): LlamarIA & { pedidos: PedidoIA[] } {
    const pedidos: PedidoIA[] = [];
    const f: LlamarIA = async (p) => {
      pedidos.push(p);
      return JSON.stringify({
        base_ancho_cm: 17,
        base_prof_cm: 24,
        medidas_fuente: "estimada",
        vista_fotos: "atras",
        piezas: [
          // La pantalla "vista" en la foto (a medio sacar) no cuenta: la pone el esqueleto en su cara.
          { pieza: "pantalla", x: 0, z: 0, ancho: 0.9, prof: 0.9, alto_cm: 0.2, capa: "sobre_base", sobre: null, forma: "caja", etiquetaManual: null, pagina: 1, confianza: "alta" },
          { pieza: "bateria", x: 0.5, z: 0.5, ancho: 0.4, prof: 0.3, alto_cm: 0.4, capa: "sobre_base", sobre: null, forma: "extrusion", etiquetaManual: null, pagina: 1, confianza: "alta" },
          { pieza: "placa_madre", x: -0.5, z: -0.4, ancho: 0.3, prof: 0.4, alto_cm: 0.2, capa: "placa", sobre: null, forma: "caja", etiquetaManual: null, pagina: 2, confianza: "media" },
        ],
      });
    };
    return Object.assign(f, { pedidos });
  }
  const textoDe = (p: PedidoIA) => JSON.stringify(p.contenido);

  it("sin manual: primero las fotos de la guía (gratis, sin búsqueda web); lo que vio queda donde lo vio, con origen «foto»", async () => {
    const llamar = ia();
    const kp = pack("tablet", PASOS);
    let buscadas = 0;
    const buscarFotos = async () => (buscadas++, null);
    const r = await obtenerPlano(
      { casoId: "c", knowledgePack: kp, tipoEquipo: "tablet", ficha: ficha("T1"), fotosPasos: todas },
      { cache: cachePlanosEnMemoria(), llamar, descargar: cdn(), buscarFotos },
    );
    expect(buscadas).toBe(0);
    expect(r.camino).toBe("imagenes");
    const contenido = llamar.pedidos[0].contenido as { type: string }[];
    expect(contenido.filter((b) => b.type === "image")).toHaveLength(3);
    expect(textoDe(llamar.pedidos[0])).toMatch(/3 fotos del interior de este modelo/);
    expect(textoDe(llamar.pedidos[0])).toMatch(/vista_fotos/);
    const bateria = r.plano.piezas.find((p) => p.pieza === "bateria")!;
    expect(bateria.origen).toBe("foto");
    expect(bateria.cita).toMatchObject({ doc: "Fotos de la guía (guias.ej)", url: paso(4) });
    expect(r.plano.piezas.find((p) => p.pieza === "pantalla")!.origen).not.toBe("foto");
    // Vista en la foto abajo a la derecha: queda en la mitad derecha y de abajo de la planta, no en el esqueleto.
    const raiz = r.plano.piezas.find((p) => !p.padre)!;
    expect(bateria.pos[0]).toBeGreaterThan(raiz.pos[0]);
    expect(bateria.pos[2]).toBeGreaterThan(raiz.pos[2]);
  });

  it("sin fotos de la guía que sirvan, sigue la búsqueda web de fotos (#303)", async () => {
    let buscadas = 0;
    const buscarFotos = async () => (buscadas++, null);
    await obtenerPlano(
      { casoId: "c", knowledgePack: pack("tablet", PASOS), tipoEquipo: "tablet", ficha: ficha("T3"), fotosPasos: todas },
      { cache: cachePlanosEnMemoria(), llamar: ia(), descargar: cdn("text/html"), buscarFotos },
    );
    expect(buscadas).toBe(1);
  });

  it("con un manual, las fotos no se usan (el manual manda)", async () => {
    const llamar = ia();
    const f = cdn();
    await obtenerPlano(
      { casoId: "c", knowledgePack: pack("tablet", PASOS), tipoEquipo: "tablet", fotosPasos: todas, imagenes: [{ base64: "AAAA", mediaType: "image/png" }], paginas: [3] },
      { cache: cachePlanosEnMemoria(), llamar, descargar: f },
    );
    expect(f.pedidas).toEqual([]);
    expect(textoDe(llamar.pedidos[0])).toMatch(/páginas 3 del manual/);
  });

  it("un plano guardado todo estimado (del texto) se rehace con las fotos; uno con piezas vistas se reusa", async () => {
    const kp = pack("tablet", PASOS);
    const estimado: PlanoDePiezas = {
      modelo: "tablet X",
      unidades: "cm",
      piezas: kp.piezas.map((p, i) => ({ pieza: p.id, forma: "caja", dim: [1, 1, 1], pos: [i, 0, 0], pivote: [0, 0, 0], origen: "estimada" })),
    };
    for (const [origen, rehace] of [["estimada", true], ["manual", false], ["foto", false]] as const) {
      const cache = cachePlanosEnMemoria();
      const plano = { ...estimado, piezas: estimado.piezas.map((p) => ({ ...p, origen })) };
      await cache.set(claveManual("Marca", "T2"), "Marca", "T2", { plano, avisos: [], manualUrl: null, piezasPedidas: kp.piezas.map((p) => p.id) });
      const llamar = ia();
      const r = await obtenerPlano({ casoId: "c", knowledgePack: kp, tipoEquipo: "tablet", ficha: ficha("T2"), fotosPasos: todas }, { cache, llamar, descargar: cdn() });
      expect(r.desdeCache, origen).toBe(!rehace);
      // Rehecho: una llamada (o dos, si el barato vio menos de la mitad y pasa al más capaz).
      expect(llamar.pedidos.length > 0, origen).toBe(rehace);
    }
  });
});
