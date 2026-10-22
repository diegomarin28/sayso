import { describe, expect, it } from "vitest";
import { knowledgePackEjemplo, type KnowledgePack } from "../../../shared";
import { sospechasParaMostrar } from "./sospechas";

const sosp = (pieza: string) => ({ pieza, porque: `Porque ${pieza}.`, chequeo: `Mirá ${pieza}.` });
const pack = (sospechosas?: KnowledgePack["sospechosas"]): KnowledgePack => ({ ...knowledgePackEjemplo, sospechosas });

describe("sospechasParaMostrar", () => {
  it("sin el campo (packs viejos): nada", () => {
    expect(sospechasParaMostrar(pack(undefined))).toEqual([]);
  });

  it("con la lista vacía: nada", () => {
    expect(sospechasParaMostrar(pack([]))).toEqual([]);
  });

  it("usa el nombre de la pieza del pack", () => {
    const [s] = sospechasParaMostrar(pack([sosp("ventilador")]));
    expect(s).toEqual({ nombre: "Ventilador", porque: "Porque ventilador.", chequeo: "Mirá ventilador.", destacada: true });
  });

  it("matchea por prefijo del id, y prefiere el id exacto", () => {
    const base = { descripcion: "", ubicacion: "" };
    const p: KnowledgePack = {
      ...knowledgePackEjemplo,
      piezas: [
        { ...base, id: "ventilador_trasero", nombre: "Ventilador de atrás" },
        { ...base, id: "ventilador", nombre: "Ventilador principal" },
      ],
      sospechosas: [sosp("ventilador")],
    };
    expect(sospechasParaMostrar(p)[0].nombre).toBe("Ventilador principal");
    expect(sospechasParaMostrar({ ...p, piezas: [p.piezas[0]] })[0].nombre).toBe("Ventilador de atrás");
  });

  it("si el pack no tiene la pieza: el id legible", () => {
    const [a, b] = sospechasParaMostrar(pack([sosp("fuente_de_poder"), sosp("capacitor")]));
    expect(a.nombre).toBe("Fuente de poder");
    expect(b.nombre).toBe("Capacitor");
  });

  it("respeta el orden y solo la primera va destacada", () => {
    const r = sospechasParaMostrar(pack([sosp("ventilador"), sosp("bateria"), sosp("ssd")]));
    expect(r.map((s) => s.destacada)).toEqual([true, false, false]);
    expect(r.map((s) => s.nombre)).toEqual(["Ventilador", "Batería", "Disco SSD"]);
  });
});
