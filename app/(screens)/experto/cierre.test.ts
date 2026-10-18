import { describe, expect, it } from "vitest";
import { casoEjemplo, fichaEjemplo, knowledgePackEjemplo, planoEjemplo } from "../../../shared";
import { guardarLocal, leerCaso, listarCasos } from "../_datos/mis-casos";
import { fuenteConRetomar, pasosAlRetomar, preguntaAlRetomar } from "./cierre";

const pieza = knowledgePackEjemplo.pasos.find((p) => p.piezas.length)!.piezas[0];

describe("retomar un caso que esperaba el repuesto (sin IA)", () => {
  it("arranca con la bienvenida y sigue desde el primer paso que usa esa pieza", () => {
    const eventos = pasosAlRetomar(knowledgePackEjemplo, planoEjemplo, pieza);
    expect(eventos[0].tipo).toBe("paso");
    const pasos = eventos.filter((e) => e.tipo === "paso").slice(1);
    const primero = [...knowledgePackEjemplo.pasos]
      .sort((a, b) => a.orden - b.orden)
      .find((p) => p.piezas.includes(pieza))!;
    expect(pasos[0].tipo === "paso" && pasos[0].coreografia.dice).toBe(primero.texto);
    expect(eventos.at(-1)?.tipo).toBe("fin");
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
    expect(tipos).toEqual(["paso", "paso", "bloqueo", "fin"]);
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
