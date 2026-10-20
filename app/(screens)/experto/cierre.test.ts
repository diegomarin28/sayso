import { describe, expect, it } from "vitest";
import { casoEjemplo, fichaEjemplo, knowledgePackEjemplo, planoEjemplo } from "../../../shared";
import { guardarLocal, leerCaso, listarCasos } from "../_datos/mis-casos";
import type { EventoChat, FuenteChat } from "../../../components/viewer";
import type { Coreografia } from "../../../shared";
import { fuenteConCierre, fuenteConRetomar, pasosAlRetomar, pasosDeCierre, piezaCandidata, preguntaAlRetomar } from "./cierre";

const pieza = knowledgePackEjemplo.pasos.find((p) => p.piezas.length)!.piezas[0];

describe("retomar un caso que esperaba el repuesto (sin IA)", () => {
  it("arranca desde el primer paso que usa esa pieza, con la bienvenida delante y su cita", () => {
    const eventos = pasosAlRetomar(knowledgePackEjemplo, planoEjemplo, pieza);
    const primero = [...knowledgePackEjemplo.pasos]
      .sort((a, b) => a.orden - b.orden)
      .find((p) => p.piezas.includes(pieza))!;
    const [uno] = eventos;
    expect(uno.tipo === "paso" && uno.coreografia.dice).toMatch(/^Ya tenés el repuesto \(.+\): sigamos desde el cambio\. /);
    expect(uno.tipo === "paso" && uno.coreografia.dice.endsWith(primero.texto)).toBe(true);
    // La bienvenida no es un paso aparte: el primero conserva la cita de la guía (no sale «Guía pública»).
    expect(primero.cita).toBeDefined();
    expect(uno.tipo === "paso" && uno.coreografia.cita).toEqual(primero.cita);
    expect(uno.tipo === "paso" && uno.coreografia.paso).toBe(1);
    expect(eventos.at(-1)?.tipo).toBe("fin");
  });

  it("si el primer paso es de riesgo alto, bloquea sin bienvenida; sin pasos, queda solo la bienvenida", () => {
    const alto = {
      ...knowledgePackEjemplo,
      pasos: [{ id: "a", orden: 1, texto: "Abrí la batería.", piezas: [pieza], riesgo: "alto" as const }],
    };
    const [bloqueo] = pasosAlRetomar(alto, planoEjemplo, pieza);
    expect(bloqueo.tipo).toBe("bloqueo");
    expect(bloqueo.tipo === "bloqueo" && bloqueo.coreografia.dice).toBe("Abrí la batería.");
    const vacio = pasosAlRetomar({ ...knowledgePackEjemplo, pasos: [] }, planoEjemplo, pieza);
    expect(vacio.map((e) => e.tipo)).toEqual(["paso", "fin"]);
  });

  it("solo resalta piezas que existen en el plano", () => {
    const enPlano = new Set(planoEjemplo.piezas.map((p) => p.pieza));
    for (const e of pasosAlRetomar(knowledgePackEjemplo, planoEjemplo, pieza)) {
      if (e.tipo !== "paso" && e.tipo !== "bloqueo") continue;
      for (const a of e.coreografia.acciones) if (a.t === "resaltar") expect(enPlano.has(a.pieza)).toBe(true);
    }
  });

  it("un paso de riesgo alto corta como bloqueo", () => {
    const pack = {
      ...knowledgePackEjemplo,
      pasos: [
        { id: "a", orden: 1, texto: "Abrí la tapa.", piezas: [pieza], riesgo: "bajo" as const },
        { id: "b", orden: 2, texto: "Abrí la batería.", piezas: [pieza], riesgo: "alto" as const },
        { id: "c", orden: 3, texto: "Nunca llega.", piezas: [pieza], riesgo: "bajo" as const },
      ],
    };
    const tipos = pasosAlRetomar(pack, planoEjemplo, pieza).map((e) => e.tipo);
    expect(tipos).toEqual(["paso", "bloqueo", "fin"]);
  });

  it("la fuente responde la pregunta de retomar sin llamar a la base; lo demás va a la base", async () => {
    let llamadas = 0;
    const base = async function* () {
      llamadas++;
      yield { tipo: "fin" as const };
    };
    const pregunta = preguntaAlRetomar(knowledgePackEjemplo, pieza);
    const fuente = fuenteConRetomar(
      base,
      pregunta,
      pasosAlRetomar(knowledgePackEjemplo, planoEjemplo, pieza),
    );
    const pedido = { casoId: "c", pack: knowledgePackEjemplo, plano: planoEjemplo, historial: [], pregunta };
    const senal = new AbortController().signal;
    for await (const _ of fuente(pedido, senal)) void _;
    expect(llamadas).toBe(0);
    for await (const _ of fuente({ ...pedido, pregunta: "¿Dónde está el SSD?" }, senal)) void _;
    expect(llamadas).toBe(1);
  });
});

describe("mis casos (en este dispositivo)", () => {
  it("guarda, mezcla los cambios y lista el más reciente primero", () => {
    guardarLocal({ caso: { ...casoEjemplo, id: "uno" }, tipoEquipo: "notebook" });
    guardarLocal({ caso: { ...casoEjemplo, id: "dos" } });
    guardarLocal({ caso: { ...casoEjemplo, id: "uno" }, ficha: { ...fichaEjemplo, casoId: "uno" } });
    const uno = leerCaso("uno")!;
    expect(uno.tipoEquipo).toBe("notebook"); // no se pierde al guardar la ficha
    expect(uno.ficha?.casoId).toBe("uno");
    expect(listarCasos()[0].caso.id).toBe("uno");
  });

  it("descarta lo que no valida en vez de romper", () => {
    guardarLocal({ caso: { ...casoEjemplo, id: "tres", clase: "heladera" as never } });
    expect(leerCaso("tres")).toBeNull();
  });
});

describe("cierre de la guía: Siguiente llega hasta el final", () => {
  const pedido = (pregunta: string) => ({ pregunta }) as Parameters<FuenteChat>[0];
  const leer = async (f: FuenteChat, pregunta: string) => {
    const r: EventoChat[] = [];
    for await (const e of f(pedido(pregunta), new AbortController().signal)) r.push(e);
    return r;
  };
  const respuesta = (eventos: EventoChat[]): FuenteChat => async function* () {
    yield* eventos;
  };
  const paso = (n: number, extra: Partial<Coreografia> = {}): EventoChat => ({
    tipo: "paso",
    coreografia: { paso: n, dice: `Paso ${n}`, acciones: [], riesgo: "bajo", ...extra },
  });

  it("la pieza candidata es la del último paso que está en el plano", () => {
    const ultimo = [...knowledgePackEjemplo.pasos].sort((a, b) => b.orden - a.orden)[0];
    expect(piezaCandidata(knowledgePackEjemplo, planoEjemplo)).toBe(ultimo.piezas[0]);
  });

  it("a la guía del síntoma le suma probar y, si sigue igual, la pieza a cambiar", async () => {
    const base = respuesta([paso(1), paso(2), { tipo: "fin", pasos: 2 }]);
    const r = await leer(fuenteConCierre(base, "sintoma", knowledgePackEjemplo, planoEjemplo), "sintoma");
    const pasos = r.flatMap((e) => (e.tipo === "paso" ? [e.coreografia] : []));
    expect(pasos.map((c) => c.paso)).toEqual([1, 2, 3, 4]);
    expect(pasos[2].dice).toMatch(/probalo/);
    expect(pasos[3].cambiar).toBe(piezaCandidata(knowledgePackEjemplo, planoEjemplo));
    expect(r.at(-1)).toEqual({ tipo: "fin", pasos: 4 });
  });

  it("si el experto ya dijo qué cambiar, solo suma probar", async () => {
    const base = respuesta([paso(1, { cambiar: "ventilador" }), { tipo: "fin", pasos: 1 }]);
    const r = await leer(fuenteConCierre(base, "s", knowledgePackEjemplo, planoEjemplo), "s");
    expect(r.filter((e) => e.tipo === "paso")).toHaveLength(2);
  });

  it("no toca otras preguntas ni una respuesta bloqueada", async () => {
    const base = respuesta([paso(1), { tipo: "fin", pasos: 1 }]);
    expect(await leer(fuenteConCierre(base, "s", knowledgePackEjemplo, planoEjemplo), "otra")).toHaveLength(2);
    const bloqueo = respuesta([
      { tipo: "bloqueo", clases: [], coreografia: { paso: 1, dice: "Acá frenamos.", acciones: [], riesgo: "alto" } },
      { tipo: "fin", pasos: 1 },
    ]);
    expect(await leer(fuenteConCierre(bloqueo, "s", knowledgePackEjemplo, planoEjemplo), "s")).toHaveLength(2);
  });

  it("sin piezas en el plano no inventa qué cambiar", () => {
    const r = pasosDeCierre(knowledgePackEjemplo, { ...planoEjemplo, piezas: [] }, 3, false);
    expect(r).toHaveLength(1);
    expect(r[0].cambiar).toBeUndefined();
  });
});
