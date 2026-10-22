import { describe, expect, it } from "vitest";
import { ErrorIA, type LlamarIA } from "../ia/claude";
import { IAEnPausa } from "../ia/freno";
import { parsearContenido } from "./lineas";
import { bloqueSospechosas, esSospechosa, limpiarTriage, puedeCambiar, soloEnTema, temasDeTriage, triarSintoma, type PasoConRol, type Triage } from "./triage";

const ventilador = { pieza: "ventilador", temas: ["fan", "heatsink"], porque: "Hace ruido y se calienta.", chequeo: "Con el equipo andando, acercá el oído." };
const triageFan: Triage = { sospechosas: [ventilador, { pieza: "disipador", temas: ["thermal"], porque: "Pasta seca.", chequeo: "Mirá si sale aire caliente." }], soloSoftware: false };

/** Simula al modelo devolviendo, en orden, cada respuesta de la lista (un Error se lanza). */
function falso(...respuestas: unknown[]): LlamarIA & { ultimo: string } {
  let i = 0;
  const f = Object.assign(
    async (p: Parameters<LlamarIA>[0]) => {
      f.ultimo = JSON.stringify(p.contenido);
      const r = respuestas[Math.min(i++, respuestas.length - 1)];
      if (r instanceof Error) throw r;
      return typeof r === "string" ? r : JSON.stringify(r);
    },
    { ultimo: "" },
  );
  return f;
}

const paso = (orden: number, rol: PasoConRol["rol"], piezas: string[], texto = `Paso ${orden}.`): PasoConRol => ({
  id: `paso-${orden}`,
  orden,
  texto,
  piezas,
  riesgo: "bajo",
  ...(rol ? { rol } : {}),
});

describe("limpiarTriage: el código valida lo que propone la IA", () => {
  it("normaliza ids y temas, saca repetidas e inválidas y deja hasta 3", () => {
    const t = limpiarTriage({
      soloSoftware: false,
      sospechosas: [
        { pieza: "Ventilador", temas: ["Fan", "fan", "heat sink", "thermal"], porque: " Ruido. ", chequeo: "Escuchalo." },
        { pieza: "ventilador", temas: ["fan"], porque: "Repetida.", chequeo: "x" },
        { pieza: "puerto de carga", temas: ["charging"], porque: "No carga.", chequeo: "Probá otro cable." },
        { pieza: "<script>", temas: ["x"], porque: "Mal.", chequeo: "x" },
        { pieza: "batería", temas: ["battery"], porque: "Dura poco.", chequeo: "Mirá el porcentaje." },
        { pieza: "pantalla", temas: ["screen"], porque: "Cuarta.", chequeo: "x" },
      ],
    });
    expect(t.sospechosas.map((s) => s.pieza)).toEqual(["ventilador", "puerto_de_carga", "bateria"]);
    expect(t.sospechosas[0]).toMatchObject({ temas: ["fan", "thermal"], porque: "Ruido." });
  });

  it("descarta una sospechosa sin porqué o sin chequeo", () => {
    expect(limpiarTriage({ soloSoftware: false, sospechosas: [{ pieza: "ram", temas: [], porque: "", chequeo: "x" }] }).sospechosas).toEqual([]);
  });
});

describe("triarSintoma", () => {
  it("manda el equipo y el síntoma como datos y devuelve las sospechosas limpias", async () => {
    const llamar = falso({ soloSoftware: false, sospechosas: [ventilador] });
    const t = await triarSintoma({ equipo: "Libro Air (notebook)", sintoma: "se calienta y se apaga" }, llamar);
    expect(t?.sospechosas.map((s) => s.pieza)).toEqual(["ventilador"]);
    expect(llamar.ultimo).toContain("<sintoma>se calienta y se apaga</sintoma>");
  });

  it("si la IA no responde bien, null (la guía sigue sin filtro)", async () => {
    expect(await triarSintoma({ equipo: "x", sintoma: "y" }, falso("no es json"))).toBeNull();
    expect(await triarSintoma({ equipo: "x", sintoma: "y" }, falso(new ErrorIA("caída")))).toBeNull();
  });

  it("la IA en pausa no se tapa: sube", async () => {
    await expect(triarSintoma({ equipo: "x", sintoma: "y" }, falso(new IAEnPausa("apagada")))).rejects.toBeInstanceOf(IAEnPausa);
  });
});

describe("temas y bloque para la lectura", () => {
  it("la sospechosa más probable pesa más que una palabra suelta del síntoma", () => {
    const t = temasDeTriage(triageFan);
    expect(t.get("fan")).toBe(6);
    expect(t.get("thermal")).toBe(4);
    expect(temasDeTriage(null).size).toBe(0);
  });

  it("el bloque lista las sospechosas en orden con su chequeo; sin sospechosas, vacío", () => {
    const b = bloqueSospechosas(triageFan);
    expect(b).toMatch(/<sospechosas>\n1\. ventilador: Hace ruido y se calienta\. Cómo confirmarla: Con el equipo andando/);
    expect(b).toMatch(/Los pasos de reparación son solo de estas piezas/);
    expect(bloqueSospechosas({ sospechosas: [], soloSoftware: true })).toBe("");
  });
});

describe("soloEnTema: el código saca los pasos de otra pieza", () => {
  it("descarta cambiar la batería si se sospecha del ventilador; desconectarla para llegar queda", () => {
    const pasos = [
      paso(1, "chequeo", [], "Reiniciá."),
      paso(2, "acceso", ["tapa_inferior"], "Sacá la tapa."),
      paso(3, "acceso", ["bateria"], "Desconectá la batería."),
      paso(4, "reparacion", ["bateria"], "Cambiá la batería."),
      paso(5, "reparacion", ["ventilador_cpu"], "Limpiá el ventilador."),
      paso(6, "armado", ["tapa_inferior"], "Cerrá."),
    ];
    const r = soloEnTema({ pasos, repuestos: [{ pieza: "bateria" }, { pieza: "ventilador_cpu" }] }, triageFan.sospechosas);
    expect(r.fuera.map((p) => p.texto)).toEqual(["Cambiá la batería."]);
    expect(r.pasos.map((p) => [p.orden, p.id, p.texto])).toEqual([
      [1, "paso-1", "Reiniciá."],
      [2, "paso-2", "Sacá la tapa."],
      [3, "paso-3", "Desconectá la batería."],
      [4, "paso-4", "Limpiá el ventilador."],
      [5, "paso-5", "Cerrá."],
    ]);
    expect(r.repuestos).toEqual([{ pieza: "ventilador_cpu" }]);
  });

  it("si toda la reparación era de otra pieza, no se abre el equipo: quedan los chequeos", () => {
    const pasos = [paso(1, "chequeo", []), paso(2, "acceso", ["tapa_inferior"]), paso(3, "reparacion", ["bateria"]), paso(4, "armado", ["tapa_inferior"])];
    const r = soloEnTema({ pasos, repuestos: [] }, triageFan.sospechosas);
    expect(r.pasos.map((p) => p.rol)).toEqual(["chequeo"]);
  });

  it("un paso sin rol (lectura vieja) o sin piezas no se juzga; sin sospechosas no cambia nada", () => {
    const pasos = [paso(1, undefined, ["bateria"]), paso(2, "reparacion", []), paso(3, "reparacion", ["ventilador"])];
    expect(soloEnTema({ pasos, repuestos: [] }, triageFan.sospechosas).pasos).toHaveLength(3);
    const todos = [paso(1, "reparacion", ["bateria"])];
    expect(soloEnTema({ pasos: todos, repuestos: [{ pieza: "bateria" }] }, [])).toEqual({ pasos: todos, repuestos: [{ pieza: "bateria" }], fuera: [] });
  });
});

describe("esSospechosa y puedeCambiar", () => {
  it("un id es de la sospechosa si es su tipo o empieza con él", () => {
    expect(esSospechosa("ventilador", triageFan.sospechosas)).toBe(true);
    expect(esSospechosa("ventilador_gpu", triageFan.sospechosas)).toBe(true);
    expect(esSospechosa("tornillos_ventilador", triageFan.sospechosas)).toBe(false);
    expect(esSospechosa("bateria", triageFan.sospechosas)).toBe(false);
  });

  it("sin sospechosas (pack viejo) se puede cambiar cualquiera", () => {
    expect(puedeCambiar("bateria", undefined)).toBe(true);
    expect(puedeCambiar("bateria", [])).toBe(true);
    expect(puedeCambiar("bateria", triageFan.sospechosas)).toBe(false);
  });
});

describe("la lectura marca el rol de cada PASO", () => {
  it("lee el rol (con o sin tilde); sin rol, el paso queda igual", () => {
    const c = parsearContenido(
      [
        { texto: "PASO|1|Cambiá el ventilador.|ventilador|bajo|reparación", citas: [] },
        { texto: "PASO|2|Cerrá la tapa.|tapa_inferior|bajo|armado", citas: [] },
        { texto: "PASO|3|Reiniciá.||bajo", citas: [] },
      ],
      "Manual",
    );
    expect(c.pasos.map((p) => p.rol)).toEqual(["reparacion", "armado", undefined]);
  });
});
