import { describe, expect, it } from "vitest";
import { buscarGuiaIfixit, equipoIfixit, esDelTema, fotosPorPaso, guiaIfixit, guiasDelSintoma, LICENCIA, manualWebDeIfixit, nombresParaIfixit, ordenarGuias, temasDelSintoma, type GuiaEnLista } from "./ifixit";

/**
 * Una API de iFixit simulada (sin red): la búsqueda pide TODAS las palabras (en el título o la descripción),
 * como la real, y las categorías no nombran la marca. Los equipos son ficticios: las reglas son por nombre y código de modelo, no por marca.
 */
const CATEGORIAS: Record<string, { description: string; guides: { guideid: number; title: string; subject: string; type: string }[] }> = {
  "Fono X21": {
    description: "Repair guides for the Fono X21 smartphone.",
    guides: [
      { guideid: 1, title: "Fono X21 Screen Replacement", subject: "Screen", type: "replacement" },
      { guideid: 2, title: "Fono X21 Battery Replacement", subject: "Battery", type: "replacement" },
      { guideid: 3, title: "Fono X21 Charging Port Replacement", subject: "Charging Port", type: "replacement" },
    ],
  },
  "Fono X21 Ultra": { description: "The bigger one.", guides: [{ guideid: 9, title: "Fono X21 Ultra Battery Replacement", subject: "Battery", type: "replacement" }] },
  "Libro Air 13 Late 2020": {
    description: "The first Libro Air with the Z1 chip.",
    guides: [
      { guideid: 20, title: "Libro Air Battery Replacement", subject: "Battery", type: "replacement" },
      { guideid: 21, title: "Libro Air Fan Replacement", subject: "Fan", type: "replacement" },
    ],
  },
  "Tele 55C722": { description: "A 55 inch TV.", guides: [{ guideid: 30, title: "Tele 55C722 Screen Replacement", subject: "Screen", type: "replacement" }] },
  "Tablo 6": { description: "The sixth generation Tablo.", guides: [{ guideid: 50, title: "Tablo 6 Battery Replacement", subject: "Battery", type: "replacement" }] },
  "Tablo Air 4": { description: "Tablo Air, 4th generation.", guides: [{ guideid: 51, title: "Tablo Air 4 Battery Replacement", subject: "Battery", type: "replacement" }] },
  // Otro equipo que comparte UNA palabra con un modelo sin números (un proyector «Luminous Superior»).
  "Aspira Elite Superior": { description: "Commercial vacuum cleaner.", guides: [{ guideid: 60, title: "Aspira Elite Superior Capacitor Repair", subject: "Capacitor", type: "repair" }] },
  "Proyecta Lux": { description: "Ceiling projector.", guides: [{ guideid: 61, title: "Proyecta Lux Lamp Replacement", subject: "Lamp", type: "replacement" }] },
  Mando: {
    description: "Game controller.",
    guides: [
      { guideid: 40, title: "Mando Battery Replacement (alias)", subject: "Battery", type: "replacement" },
      { guideid: 41, title: "Mando Joystick Replacement", subject: "Joystick", type: "replacement" },
      { guideid: 42, title: "Mando Battery Replacement", subject: "Battery", type: "replacement" },
    ],
  },
};

const paso = (stepid: number, title: string, lines: [string, string][], fotos = 1) => ({
  stepid,
  title,
  lines: lines.map(([bullet, text_raw]) => ({ bullet, text_raw })),
  media: { type: "image", data: Array.from({ length: fotos }, (_, i) => ({ standard: `https://img.ej/${stepid}-${i}.standard` })) },
});
const GUIA = (id: number, title: string) => ({
  guideid: id,
  title,
  url: `https://www.ifixit.com/Guide/${title.replace(/ /g, "+")}/${id}`,
  category: "Fono X21",
  subject: "Battery",
  difficulty: "Moderate",
  author: { username: "Autora" },
  tools: [{ text: "Suction Handle", url: "https://ej/ventosa" }],
  parts: [{ text: "Fono X21 Battery", url: "https://ej/bateria" }],
  steps: [
    paso(100, "Heat the back", [["black", "Heat the back cover for two minutes."], ["icon_caution", "Do not puncture the battery."]]),
    paso(101, "", [["black", "Disconnect the battery connector."]], 2),
  ],
});

function api(): typeof fetch {
  return (async (url: string | URL) => {
    const u = decodeURIComponent(String(url).replace("https://www.ifixit.com/api/2.0", ""));
    const busqueda = u.match(/^\/search\/(.+)\?filter=category/);
    if (busqueda) {
      const dichas = busqueda[1].toLowerCase().split(/\s+/);
      const results = Object.keys(CATEGORIAS)
        .filter((t) => dichas.every((d) => `${t} ${CATEGORIAS[t].description}`.toLowerCase().split(/[^a-z0-9]+/).includes(d)))
        .map((title) => ({ title }));
      return Response.json({ results });
    }
    const wiki = u.match(/^\/wikis\/CATEGORY\/(.+)$/);
    if (wiki && CATEGORIAS[wiki[1]]) return Response.json({ title: wiki[1], ...CATEGORIAS[wiki[1]] });
    const guia = u.match(/^\/guides\/(\d+)$/);
    if (guia) {
      const id = +guia[1];
      if (id === 40) return Response.json({ guideid: 40, title: "alias", url: "https://ej/40", steps: [] }); // alias sin pasos
      return Response.json(GUIA(id, `Guía ${id}`));
    }
    return new Response("no", { status: 404 });
  }) as typeof fetch;
}

describe("equipoIfixit: el equipo exacto, o nada", () => {
  it("con la marca adelante (iFixit no la nombra): la saca y encuentra el modelo, no el Ultra", async () => {
    const e = await equipoIfixit("MarcaQ Fono X21", api());
    expect(e?.titulo).toBe("Fono X21");
    expect(e?.guias.map((g) => g.id)).toEqual([1, 2, 3]);
  });

  it("un código de modelo que no está en el título vale si está en la descripción (Z1)", async () => {
    expect((await equipoIfixit("Libro Air Z1", api()))?.titulo).toBe("Libro Air 13 Late 2020");
  });

  it("otro modelo de la misma línea no sirve (55V6C no es 55C722): mejor nada que la guía equivocada", async () => {
    expect(await equipoIfixit("Tele 55V6C", api())).toBeNull();
    expect(await equipoIfixit("Impresora LaserX M404", api())).toBeNull();
  });

  it("un modelo sin números no se confunde con otro equipo por una palabra en común (la guía de una aspiradora para un proyector)", async () => {
    expect(await equipoIfixit("MarcaV Luminous Superior", api())).toBeNull();
    expect(await buscarGuiaIfixit("MarcaV Luminous Superior", "no prende", api())).toBeNull();
  });

  it("un modelo sin números sí se encuentra si están todas sus palabras (la marca puede faltar)", async () => {
    expect((await equipoIfixit("MarcaV Proyecta Lux", api()))?.titulo).toBe("Proyecta Lux");
  });

  it("si la red falla, null (sigue la búsqueda de siempre)", async () => {
    const caida = (async () => {
      throw new Error("sin red");
    }) as unknown as typeof fetch;
    expect(await equipoIfixit("Fono X21", caida)).toBeNull();
    expect(await buscarGuiaIfixit("Fono X21", "batería", caida)).toBeNull();
  });
});

describe("tablets como las nombra la ficha (#256): la generación y el código de la etiqueta", () => {
  it.each([
    ["MarcaT Tablo (6.ª generación)", "Tablo 6"],
    ["MarcaT Tablo (6th generation) T2567", "Tablo 6"],
    ["MarcaT Tablo Air (4.ª generación) A2316", "Tablo Air 4"],
    ["MarcaT Tablo Air 4 SM-T500", "Tablo Air 4"],
  ])("«%s» → %s en iFixit (gratis, sin búsqueda web)", async (dicho, titulo) => {
    expect((await equipoIfixit(dicho, api()))?.titulo).toBe(titulo);
    expect((await buscarGuiaIfixit(dicho, "no prende", api()))?.id).toBeGreaterThan(0);
  });

  it("nombresParaIfixit: sacar el código solo si queda un número de modelo («Epson L3250» no queda en «Epson»)", () => {
    expect(nombresParaIfixit("Apple iPad mini (6.ª generación) A2567")).toEqual(["Apple iPad mini (6.ª generación) A2567", "Apple iPad mini 6 A2567", "Apple iPad mini 6"]);
    expect(nombresParaIfixit("Epson L3250")).toEqual(["Epson L3250"]);
    expect(nombresParaIfixit("LG 43UQ7500PSF")).toEqual(["LG 43UQ7500PSF"]);
    expect(nombresParaIfixit("Samsung RT38K5930S8")).toEqual(["Samsung RT38K5930S8"]);
  });
});

describe("ordenarGuias: por el síntoma, en castellano", () => {
  const guias: GuiaEnLista[] = CATEGORIAS["Fono X21"].guides.map((g) => ({ id: g.guideid, titulo: g.title, tema: g.subject, tipo: g.type }));
  it.each([
    ["se le rompió la pantalla", 1],
    ["la batería dura poco", 2],
    ["no carga", 3],
    ["anda raro", 2], // sin pistas: batería, solo como respaldo (ver guiasDelSintoma)
  ])("%s → guía %i", (sintoma, id) => {
    expect(ordenarGuias(guias, sintoma)[0].id).toBe(id);
  });
});

describe("guía del síntoma: nunca la de otra pieza", () => {
  const notebook: GuiaEnLista[] = CATEGORIAS["Libro Air 13 Late 2020"].guides.map((g) => ({ id: g.guideid, titulo: g.title, tema: g.subject, tipo: g.type }));
  const celular: GuiaEnLista[] = CATEGORIAS["Fono X21"].guides.map((g) => ({ id: g.guideid, titulo: g.title, tema: g.subject, tipo: g.type }));

  it.each([
    ["se calienta y se apaga", 21], // sin nombrar la pieza: la temperatura pesa como la batería, y el ventilador suma "calienta"
    ["se apaga sola y el ventilador hace mucho ruido", 21],
    ["hace ruido", 21],
    ["se recalienta jugando", 21],
    ["la batería no dura nada", 20],
    ["se descarga rápido", 20],
  ])("notebook: %s → guía %i", (sintoma, id) => {
    expect(guiasDelSintoma(notebook, sintoma)[0]?.id).toBe(id);
  });

  it("\"durante\" no es \"dura\": no suma para la batería", () => {
    expect(temasDelSintoma("hace ruido durante el arranque").has("battery")).toBe(false);
  });

  it("nombrar la pieza pesa más que un síntoma que puede venir de varias", () => {
    const t = temasDelSintoma("se apaga y el ventilador hace ruido");
    expect(t.get("fan")!).toBeGreaterThan(t.get("battery")!);
  });

  it.each(["anda raro", "se tilda", "anda lento"])("sin pieza ni falla (%s): ninguna guía del síntoma", (sintoma) => {
    expect(guiasDelSintoma(celular, sintoma)).toEqual([]);
  });

  it("si el equipo no tiene guía del tema, no se usa la de otra pieza", () => {
    expect(guiasDelSintoma(celular, "el ventilador hace ruido")).toEqual([]);
  });

  it("esDelTema: una guía ya guardada se revisa contra el síntoma nuevo", () => {
    expect(esDelTema({ titulo: "Libro Air Battery Replacement", tema: "Battery" }, "el ventilador hace ruido")).toBe(false);
    expect(esDelTema({ titulo: "Libro Air Fan Replacement", tema: "Fan" }, "el ventilador hace ruido")).toBe(true);
  });

  it("buscarGuiaIfixit con delTema: null si no hay guía del tema; sin delTema, la de respaldo", async () => {
    expect(await buscarGuiaIfixit("Fono X21", "anda raro", api(), { delTema: true })).toBeNull();
    expect((await buscarGuiaIfixit("Fono X21", "anda raro", api()))?.id).toBe(2);
  });
});

describe("guiaIfixit y manualWebDeIfixit", () => {
  it("pasos con texto, avisos aparte, fotos y la URL de cada paso", async () => {
    const g = (await guiaIfixit(2, api()))!;
    expect(g.pasos).toHaveLength(2);
    expect(g.pasos[0]).toMatchObject({ titulo: "Heat the back", texto: ["Heat the back cover for two minutes."], avisos: ["Do not puncture the battery."] });
    expect(g.pasos[0].url).toBe(`${g.url}#s100`);
    expect(g.pasos[1].titulo).toBe("Paso 2"); // sin título en iFixit
    expect(g.pasos[1].fotos).toHaveLength(2);
    expect(g.herramientas[0].nombre).toBe("Suction Handle");
  });

  it("si la mejor guía viene vacía (un alias), usa la siguiente", async () => {
    const g = await buscarGuiaIfixit("Mando", "la batería no dura", api());
    expect(g?.id).toBe(42);
  });

  it("fotosPorPaso: la primera foto de cada paso, por la URL del paso (la que lleva la cita)", async () => {
    const g = (await guiaIfixit(2, api()))!;
    expect(fotosPorPaso(g)).toEqual({ [`${g.url}#s100`]: "https://img.ej/100-0.standard", [`${g.url}#s101`]: "https://img.ej/101-0.standard" });
    expect(Object.keys(fotosPorPaso(g))).toEqual(manualWebDeIfixit(g).secciones.slice(1).map((s) => s.url));
  });

  it("como manual web: herramientas y piezas, un paso por sección (con su URL) y la atribución", async () => {
    const g = (await guiaIfixit(2, api()))!;
    const m = manualWebDeIfixit(g);
    expect(m.secciones).toHaveLength(3);
    expect(m.secciones[0].texto).toMatch(/Herramientas: Suction Handle/);
    expect(m.secciones[0].texto).toContain(LICENCIA);
    expect(m.secciones[1]).toMatchObject({ titulo: "Paso 1: Heat the back", url: `${g.url}#s100` });
    expect(m.secciones[1].texto).toMatch(/Atención: Do not puncture the battery\./);
  });
});
