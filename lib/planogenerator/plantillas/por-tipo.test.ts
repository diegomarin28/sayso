import { describe, expect, it } from "vitest";
import { fichaEjemplo, PlanoDePiezas, type ClaseEquipo, type KnowledgePack } from "../../../shared";
import type { LlamarIA } from "../../ia/claude";
import { claveManual } from "../../knowledge/manuales";
import { cachePlanosEnMemoria } from "../cache";
import { generarPlano } from "../generador";
import { obtenerPlano } from "../obtener";
import { elegirPlantilla, planoDesdePlantillaDeTipo, PLANTILLAS_POR_TIPO } from "./por-tipo";

const pack = (clase: ClaseEquipo, ids: string[], modelo = "Modelo X1"): KnowledgePack => ({
  modelo,
  clase,
  verificado: false,
  fuentes: [{ doc: "guía pública" }],
  piezas: ids.map((id) => ({ id, nombre: id.replace(/_/g, " "), descripcion: "", ubicacion: "" })),
  pasos: [],
  advertencias: [],
  repuestos: [],
});
const plantilla = (id: string) => PLANTILLAS_POR_TIPO.find((p) => p.id === id)!;
/** La IA que no puede ubicar nada: devuelve basura dos veces. */
const iaQueFalla: LlamarIA = async () => "no es json";

describe("elegirPlantilla", () => {
  it("por el tipo de equipo que dijo la recepción (y 'teléfono' no es un televisor)", () => {
    expect(elegirPlantilla(pack("otro", []), "Heladera Samsung no frost")?.id).toBe("heladera");
    expect(elegirPlantilla(pack("otro", []), "Teléfono celular Motorola")?.id).toBe("celular");
    expect(elegirPlantilla(pack("otro", []), "Smart TV 50 pulgadas")?.id).toBe("televisor");
    expect(elegirPlantilla(pack("otro", []), "Lavarropas carga frontal")?.id).toBe("lavarropas");
  });

  it("si no, por la clase del knowledge pack", () => {
    expect(elegirPlantilla(pack("split", []))?.id).toBe("aire");
    expect(elegirPlantilla(pack("lavarropas", []))?.id).toBe("lavarropas");
    expect(elegirPlantilla(pack("notebook", []))?.id).toBe("notebook");
  });

  it("el tipo dicho manda sobre la clase", () => {
    expect(elegirPlantilla(pack("split", []), "microondas")?.id).toBe("microondas");
  });

  it("si no, por las piezas del pack (solo las que distinguen un equipo)", () => {
    expect(elegirPlantilla(pack("otro", ["compresor", "puerta_freezer", "evaporador", "placa_control"]))?.id).toBe("heladera");
    expect(elegirPlantilla(pack("otro", ["tambor", "bomba_desagote", "correa"]))?.id).toBe("lavarropas");
  });

  it("sin señal suficiente no adivina: caja genérica", () => {
    expect(elegirPlantilla(pack("otro", ["placa_control", "cable_alimentacion", "tornillo_tapa"]))).toBeUndefined();
    expect(elegirPlantilla(pack("otro", []), "equipo raro")).toBeUndefined();
  });
});

describe("planoDesdePlantillaDeTipo", () => {
  it("heladera: raíz + piezas del pack por id o por tipo, todas con origen plantilla; lo que no está, avisado", () => {
    const kp = pack("otro", ["compresor", "termostato", "ventilador_freezer", "filtro_agua"]);
    const { plano, avisos } = planoDesdePlantillaDeTipo(kp, plantilla("heladera"));
    expect(() => PlanoDePiezas.parse(plano)).not.toThrow();
    expect(plano.piezas.map((p) => p.pieza).sort()).toEqual(["carcasa_heladera", "compresor", "termostato", "ventilador_freezer"]);
    expect(plano.piezas.every((p) => p.origen === "plantilla")).toBe(true);
    expect(plano.medidas).toEqual({ ancho: "plantilla", prof: "plantilla" });
    expect(plano.piezas.filter((p) => !p.padre).map((p) => p.pieza)).toEqual(["carcasa_heladera"]);
    for (const p of plano.piezas) if (p.padre) expect(p.padre).toBe("carcasa_heladera");
    // El ventilador del pack toma el lugar del ventilador de la plantilla (mismo tipo), con el id del pack.
    const vent = plantilla("heladera").plano.piezas.find((p) => p.pieza === "ventilador_evaporador")!;
    expect(plano.piezas.find((p) => p.pieza === "ventilador_freezer")!.pos).toEqual(vent.pos);
    expect(avisos.join(" ")).toMatch(/filtro_agua.*no aparece/);
  });

  it("cada plantilla, con las mismas piezas que tiene, se arma entera y valida", () => {
    for (const t of PLANTILLAS_POR_TIPO.filter((x) => x.id !== "notebook")) {
      const { plano, avisos } = planoDesdePlantillaDeTipo(pack("otro", t.plano.piezas.map((p) => p.pieza)), t);
      expect(() => PlanoDePiezas.parse(plano), t.id).not.toThrow();
      expect(plano.piezas.length, t.id).toBe(t.plano.piezas.length);
      expect(avisos, t.id).toEqual([]);
    }
  });
});

describe("respaldo de /api/plano cuando la IA no puede ubicar las piezas", () => {
  it("usa la plantilla del tipo, con el aviso de esquema genérico", async () => {
    const kp = pack("otro", ["compresor", "termostato", "condensador"]);
    const r = await generarPlano({ casoId: "c", knowledgePack: kp, tipoEquipo: "heladera" }, iaQueFalla);
    expect(r.origen).toBe("plantilla");
    expect(r.plano.piezas.some((p) => p.pieza === "carcasa_heladera")).toBe(true);
    expect(r.plano.piezas.every((p) => p.origen === "plantilla")).toBe(true);
    expect(r.avisos[0]).toMatch(/plantilla genérica de heladera \(esquema genérico, no es tu modelo exacto\)/);
  });

  it("sin plantilla para ese tipo, la caja genérica de siempre", async () => {
    const r = await generarPlano({ casoId: "c", knowledgePack: pack("otro", ["placa_control", "cable_alimentacion"]) }, iaQueFalla);
    expect(r.origen).toBe("plantilla");
    expect(r.plano.piezas.some((p) => p.pieza === "base")).toBe(true); // la caja
    expect(r.avisos[0]).toMatch(/se usa la plantilla genérica\./);
  });

  it("la plantilla nunca se guarda en la caché como si fuera del modelo", async () => {
    const cache = cachePlanosEnMemoria();
    let llamadas = 0;
    const llamar: LlamarIA = async (p) => (llamadas++, iaQueFalla(p));
    const entrada = { casoId: "c", knowledgePack: pack("otro", ["compresor", "termostato"]), ficha: fichaEjemplo, tipoEquipo: "heladera" };
    const a = await obtenerPlano(entrada, { cache, llamar });
    const b = await obtenerPlano(entrada, { cache, llamar });
    expect([a.origen, b.origen]).toEqual(["plantilla", "plantilla"]);
    expect(b.desdeCache).toBe(false);
    expect(llamadas).toBe(4); // dos intentos por vez: la segunda vez vuelve a probar con la IA
    expect(await cache.get(claveManual(fichaEjemplo.marca.valor, fichaEjemplo.modelo.valor!))).toBeFalsy();
  });
});
