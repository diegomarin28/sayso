import { describe, expect, it } from "vitest";
import { coreografiaEjemplo, knowledgePackEjemplo, planoEjemplo, type Coreografia, type KnowledgePack, type PlanoDePiezas } from "../../../shared";
import { datosTransparencia, textoCita } from "./transparencia";

const mixto: PlanoDePiezas = {
  ...planoEjemplo,
  piezas: planoEjemplo.piezas.map((p, i) => ({ ...p, origen: i === 0 ? "manual" : i === 1 ? "plantilla" : "estimada" })),
  medidas: { ancho: "manual", prof: "estimada" },
};

describe("¿De dónde sale esto? (sin datos fijos: todo sale del caso)", () => {
  it("manual verificado: título, link y cuántos pasos citan página", () => {
    const pack: KnowledgePack = { ...knowledgePackEjemplo, verificado: true, fuentes: [{ doc: "HMM T480", url: "https://ej.com/hmm.pdf" }] };
    const d = datosTransparencia(pack, mixto, "ia", []);
    const citados = pack.pasos.filter((p) => p.cita?.estado === "VERIFICADO").length;
    expect(d.manual).toEqual({ tipo: "verificado", titulo: "HMM T480", url: "https://ej.com/hmm.pdf", pasosCitados: citados, pasosTotal: pack.pasos.length });
  });

  it("sin manual: guía pública NO verificada, con sus fuentes", () => {
    const pack: KnowledgePack = { ...knowledgePackEjemplo, verificado: false, fuentes: [{ doc: "iFixit: cambio de batería", url: "https://ifixit.com/x" }] };
    expect(datosTransparencia(pack, mixto, "ia", []).manual).toEqual({ tipo: "guia_publica", fuentes: pack.fuentes, pasosTotal: pack.pasos.length });
  });

  it("3D: un plano mixto no se muestra como todo del manual; el genérico se dice", () => {
    const d = datosTransparencia(knowledgePackEjemplo, mixto, "ia", []);
    expect(d.tresD).toMatchObject({ generico: false, todoDelManual: false, medidasEstimadas: true });
    expect(d.tresD.resumen).toMatch(/1 del manual/);
    expect(datosTransparencia(knowledgePackEjemplo, mixto, "plantilla", []).tresD.generico).toBe(true);
  });

  it("esta respuesta: cada paso con su cita (verificada, no verificada o bloqueada); los no vistos no aparecen", () => {
    const sinCita: Coreografia = { paso: 3, dice: "Mirá abajo.", acciones: [], riesgo: "bajo" };
    const bloqueo: Coreografia = { paso: 4, dice: "Acá frenamos.", acciones: [], riesgo: "alto" };
    const pasos = [coreografiaEjemplo[0], undefined, sinCita, bloqueo];
    const r = datosTransparencia(knowledgePackEjemplo, mixto, "ia", pasos).respuesta;
    expect(r.map((x) => x.paso)).toEqual([1, 3, 4]);
    expect(r[0]).toMatchObject({ verificada: true, cita: `${coreografiaEjemplo[0].cita!.doc}, página ${coreografiaEjemplo[0].cita!.pagina}` });
    expect(r[1]).toMatchObject({ verificada: false, cita: "NO VERIFICADO" });
    expect(r[2]).toMatchObject({ bloqueado: true, cita: expect.stringMatching(/Bloqueado por seguridad/) });
  });

  it("una cita con página sin verificar lo dice", () => {
    expect(textoCita({ paso: 1, dice: "x", acciones: [], riesgo: "bajo", cita: { doc: "Guía", pagina: 12, estado: "NO_VERIFICABLE" } })).toEqual({
      cita: "página 12 · no verificado",
      verificada: false,
    });
  });
});
