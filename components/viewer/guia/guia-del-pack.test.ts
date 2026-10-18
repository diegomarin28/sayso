import { describe, expect, it } from "vitest";
import { knowledgePackEjemplo, planoEjemplo, type KnowledgePack, type PlanoDePiezas } from "../../../shared";
import { evaluarPedido } from "../../../lib/safety/riesgos";
import { guiaDelPack, MAX_PASOS_GUIA, pasosDelPack } from "./guia-del-pack";

const resaltadas = (acciones: { t: string; pieza?: string }[]) => acciones.flatMap((a) => (a.t === "resaltar" ? [a.pieza] : []));
/** Un plano con esas piezas (para equipos que no son la notebook del fixture). */
const planoCon = (...ids: string[]): PlanoDePiezas => ({
  ...planoEjemplo,
  piezas: ids.map((pieza) => ({ pieza, forma: "caja" as const, dim: [10, 1, 10] as [number, number, number], pos: [0, 1, 0] as [number, number, number], pivote: [0, 0, 0] as [number, number, number] })),
});

describe("guiaDelPack: el paso a paso de la guía simulada, con el pack (#161, sin IA)", () => {
  it("con el pack corto del fixture arma 4 pasos explicados: abrir, qué vas a ver, ubicar el ventilador y sacarlo", () => {
    const g = guiaDelPack(knowledgePackEjemplo, planoEjemplo);
    expect(g.map((c) => c.paso)).toEqual([1, 2, 3, 4]);
    // El primer paso del pack ya dice apagar y desenchufar: no se suma otro.
    expect(g[0].dice).toBe("Apagá, desenchufá y quitá la tapa inferior.");
    expect(g[0].cita).toMatchObject({ pagina: 52 });
    // Al sacar la tapa: qué hay adentro, primero lo que usa la guía.
    expect(g[1].dice).toBe("Adentro vas a ver el ventilador, la placa madre y el disipador. Te las marco en el 3D.");
    expect(resaltadas(g[1].acciones)).toEqual(["ventilador", "placa_madre", "disipador"]);
    expect(g[2].dice).toBe("Ubicá el ventilador: sobre el disipador, a la derecha del procesador. Expulsa el aire caliente. Te lo marco en el 3D.");
    expect(g[2].acciones[0]).toEqual({ t: "camara", objetivo: "ventilador", zoom: 1.4 });
    expect(g[3].dice).toMatch(/^Aflojá los dos tornillos/);
    expect(resaltadas(g[3].acciones)).toEqual(["ventilador", "tornillos_ventilador"]);
    expect(g[3].cita).toMatchObject({ pagina: 54 });
  });

  it("si el pack arranca tocando el equipo sin apagarlo, el primer paso es la seguridad (otra variante: un celular)", () => {
    const celular: KnowledgePack = {
      ...knowledgePackEjemplo,
      clase: "otro",
      piezas: [{ id: "bateria", nombre: "Batería", descripcion: "Alimenta el celular.", ubicacion: "en el centro" }],
      pasos: [
        { id: "p1", orden: 1, texto: "Despegá la tapa trasera con calor.", piezas: ["tapa_trasera"], riesgo: "medio" },
        { id: "p2", orden: 2, texto: "Desconectá el flex de la batería.", piezas: ["bateria"], riesgo: "medio" },
      ],
      advertencias: ["No dobles ni pinches la batería."],
    };
    const g = guiaDelPack(celular, planoCon("tapa_trasera", "bateria"));
    expect(g[0].dice).toBe("Antes de empezar: apagalo y desconectalo de la corriente (cable o cargador).");
    // La tapa es una envoltura: no se "ubica", se saca.
    expect(g[1].dice).toBe("Despegá la tapa trasera con calor.");
    expect(g[2].dice).toMatch(/^Adentro vas a ver la batería/);
    // "Desconectá el flex" es desarmar, no cortar la corriente: antes va el "ubicá".
    expect(g[3].dice).toBe("Ubicá la batería: en el centro. Alimenta el celular. Te la marco en el 3D.");
    expect(g[4].dice).toBe("Desconectá el flex de la batería.");
  });

  it("la seguridad va primero: nada de «ubicá» antes de desenchufar; las advertencias no se suman (el filtro del visor bloquearía el paso)", () => {
    const tv: KnowledgePack = {
      ...knowledgePackEjemplo,
      clase: "otro",
      piezas: [{ id: "fuente_alimentacion_tv", nombre: "Fuente de alimentación", descripcion: "Convierte la corriente.", ubicacion: "detrás del panel" }],
      pasos: [
        { id: "p1", orden: 1, texto: "Desenchufá el TV y esperá un minuto.", piezas: ["fuente_alimentacion_tv"], riesgo: "bajo" },
        { id: "p2", orden: 2, texto: "Revisá la fuente.", piezas: ["fuente_alimentacion_tv"], riesgo: "medio" },
      ],
      advertencias: [
        "No encontré en las fuentes un manual de servicio para este modelo; el manual público es de usuario y está en inglés, así que antes de desarmar conviene consultar un técnico.",
        "La fuente y el inversor manejan tensiones peligrosas, y los capacitores pueden retener carga.",
      ],
    };
    const g = guiaDelPack(tv, planoCon("fuente_alimentacion_tv"));
    expect(g[0].dice).toBe("Desenchufá el TV y esperá un minuto.");
    for (const c of g) expect(evaluarPedido(c.dice, { tipoEquipo: "televisor" }).bloqueado).toBe(false);
    expect(g[1].dice).toBe("Ubicá la fuente de alimentación: detrás del panel. Convierte la corriente. Te la marco en el 3D.");
    expect(g[2].dice).toBe("Revisá la fuente.");
  });

  it("si el pack arranca con pruebas sin tocar piezas (equipo prendido), no se antepone «apagalo»", () => {
    const pruebas: KnowledgePack = {
      ...knowledgePackEjemplo,
      pasos: [{ id: "p0", orden: 1, texto: "Cargalo 10 minutos con el cable original.", piezas: [], riesgo: "bajo" }, ...knowledgePackEjemplo.pasos.map((p) => ({ ...p, orden: p.orden + 1 }))],
    };
    const g = guiaDelPack(pruebas, planoEjemplo);
    expect(g[0].dice).toBe("Cargalo 10 minutos con el cable original.");
    expect(g.some((c) => c.dice.startsWith("Antes de empezar"))).toBe(false);
  });

  it("un paso de riesgo alto del pack frena la guía (no sigue con lo que viene después)", () => {
    const conRiesgo: KnowledgePack = {
      ...knowledgePackEjemplo,
      pasos: [...knowledgePackEjemplo.pasos, { id: "p3", orden: 3, texto: "Reemplazá el capacitor de la fuente.", piezas: [], riesgo: "alto" }, { id: "p4", orden: 4, texto: "Cerrá.", piezas: [], riesgo: "bajo" }],
    };
    const g = guiaDelPack(conRiesgo, planoEjemplo);
    expect(g.at(-1)).toMatchObject({ riesgo: "alto", acciones: [{ t: "restaurar" }] });
    expect(g.at(-1)!.dice).toMatch(/^Acá frenamos/);
    expect(g.some((c) => c.dice === "Cerrá.")).toBe(false);
  });

  it("sin piezas en el plano no mueve la cámara a nada que no existe; con un pack largo no suma pasos pero no pierde ninguno", () => {
    const largo: KnowledgePack = { ...knowledgePackEjemplo, pasos: Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, orden: i + 1, texto: `Paso ${i + 1}.`, piezas: ["no_existe"], riesgo: "bajo" as const })) };
    const g = guiaDelPack(largo, { ...planoEjemplo, piezas: [] });
    expect(g.map((c) => c.dice)).toEqual(largo.pasos.map((p) => p.texto));
    for (const c of g) expect(c.acciones).toEqual([{ t: "restaurar" }]);
    // Con piezas en el plano y 11 pasos: solo entra 1 paso sumado (tope MAX_PASOS_GUIA).
    const once: KnowledgePack = {
      ...knowledgePackEjemplo,
      pasos: Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, orden: i + 1, texto: `Revisá ${i + 1}.`, piezas: [knowledgePackEjemplo.piezas[1 + (i % 7)].id], riesgo: "bajo" as const })),
    };
    const g2 = guiaDelPack(once, planoEjemplo);
    expect(g2).toHaveLength(MAX_PASOS_GUIA);
    expect(g2.filter((c) => /^Revisá/.test(c.dice))).toHaveLength(11);
  });

  it("«ubicá» se lee bien aunque el pack traiga la ubicación con mayúscula o la descripción repita el nombre", () => {
    const impresora: KnowledgePack = {
      ...knowledgePackEjemplo,
      piezas: [{ id: "cartucho_toner", nombre: "Cartucho de tóner", descripcion: "Cartucho de toner", ubicacion: "Dentro de la impresora, detrás de la puerta del frente" }],
      pasos: [{ id: "p1", orden: 1, texto: "Sacá el cartucho.", piezas: ["cartucho_toner"], riesgo: "bajo" }],
      advertencias: [],
    };
    const ubica = guiaDelPack(impresora, planoCon("cartucho_toner")).find((c) => c.dice.startsWith("Ubicá"));
    expect(ubica?.dice).toBe("Ubicá el cartucho de tóner: dentro de la impresora, detrás de la puerta del frente. Te lo marco en el 3D.");
  });

  it("sin pasos en el pack no inventa una guía", () => {
    expect(guiaDelPack({ ...knowledgePackEjemplo, pasos: [] }, planoEjemplo)).toEqual([]);
  });
});

describe("pasosDelPack: «Seguir con la guía» al abrir desde Mis casos (#219, sin IA)", () => {
  it("los pasos guardados tal cual, con su cita (el sello de siempre) y sus piezas del plano resaltadas; no suma nada", () => {
    const g = pasosDelPack(knowledgePackEjemplo, planoEjemplo);
    expect(g.map((c) => c.dice)).toEqual(knowledgePackEjemplo.pasos.map((p) => p.texto));
    expect(g.map((c) => c.paso)).toEqual(knowledgePackEjemplo.pasos.map((_, i) => i + 1));
    expect(g.map((c) => c.cita)).toEqual(knowledgePackEjemplo.pasos.map((p) => p.cita));
    const ultimo = knowledgePackEjemplo.pasos.at(-1)!;
    const enPlano = ultimo.piezas.filter((id) => planoEjemplo.piezas.some((p) => p.pieza === id));
    expect(resaltadas(g.at(-1)!.acciones)).toEqual(enPlano);
  });

  it("frena en un paso de riesgo alto y ordena por `orden` (otra variante: un TV)", () => {
    const tv: KnowledgePack = {
      ...knowledgePackEjemplo,
      pasos: [
        { id: "b", orden: 2, texto: "Si la luz se apaga sola, puede ser la fuente: no la toques enchufada.", piezas: [], riesgo: "alto" },
        { id: "a", orden: 1, texto: "Desenchufá el TV y esperá un minuto.", piezas: ["fuente_alimentacion_tv"], riesgo: "bajo" },
        { id: "c", orden: 3, texto: "Revisá las tiras LED.", piezas: [], riesgo: "medio" },
      ],
    };
    const g = pasosDelPack(tv, planoCon("fuente_alimentacion_tv"));
    expect(g.map((c) => c.riesgo)).toEqual(["bajo", "alto"]);
    expect(g[0].dice).toBe("Desenchufá el TV y esperá un minuto.");
    expect(g[1].dice).toMatch(/^Acá frenamos/);
  });

  it("sin pasos en el pack, no hay nada que ofrecer", () => {
    expect(pasosDelPack({ ...knowledgePackEjemplo, pasos: [] }, planoEjemplo)).toEqual([]);
  });
});
