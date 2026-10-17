import { describe, expect, it } from "vitest";
import { Coreografia, Evento, coreografiaEjemplo, planoEjemplo } from "../../shared";
import {
  aplicarAccion,
  aplicarCoreografia,
  desplazamientoDespiece,
  estadoInicial,
  type EstadoEscena,
} from "./reproductor";

const ctx = { casoId: "caso-demo-1" };
const inicial = () => estadoInicial(planoEjemplo.piezas.map((p) => p.pieza));

describe("reproductor de coreografía", () => {
  it("el fixture de coreografía se aplica sin eventos", () => {
    let estado = inicial();
    for (const paso of coreografiaEjemplo) {
      const r = aplicarCoreografia(estado, paso, ctx);
      expect(r.eventos).toEqual([]);
      estado = r.estado;
    }
    const v = estado.piezas.ventilador;
    expect(v.rot[1]).toBeCloseTo(Math.PI);
    expect(v.desp).toEqual([0, 4, 0]);
    // el resaltado del ventilador era del paso 1; en el paso 2 solo quedan los tornillos
    expect(v.resaltada).toBe(false);
    expect(estado.piezas.tornillos_ventilador.resaltada).toBe(true);
    expect(estado.camara).toEqual({ objetivo: "ventilador", zoom: 1.6 });
  });

  it("repetir un paso no acumula giros ni desplazamientos", () => {
    const paso = coreografiaEjemplo[1];
    const una = aplicarCoreografia(inicial(), paso, ctx).estado;
    const dos = aplicarCoreografia(una, paso, ctx).estado;
    expect(dos).toEqual(una);
  });

  it("una pieza que no existe se ignora y genera un evento válido", () => {
    const antes = inicial();
    const r = aplicarAccion(antes, { t: "resaltar", pieza: "condensador_de_flujo" }, ctx);
    expect(r.estado).toBe(antes);
    expect(() => Evento.parse(r.evento)).not.toThrow();
    expect(r.evento).toMatchObject({ agente: "cartografo", tipo: "pieza_desconocida", casoId: "caso-demo-1" });

    const camara = aplicarAccion(antes, { t: "camara", objetivo: "no_existe" }, ctx);
    expect(camara.estado).toBe(antes);
    expect(camara.evento?.tipo).toBe("pieza_desconocida");
  });

  it("la cámara acepta 'general' para ver todo", () => {
    const r = aplicarAccion(inicial(), { t: "camara", objetivo: "general" }, ctx);
    expect(r.evento).toBeUndefined();
    expect(r.estado.camara).toEqual({ objetivo: "general", zoom: 1 });
  });

  it("ocultar, despiezar y restaurar", () => {
    const paso: Coreografia = Coreografia.parse({
      paso: 1,
      dice: "Mirá cómo se separa todo.",
      riesgo: "bajo",
      acciones: [
        { t: "ocultar", pieza: "bateria" },
        { t: "despiezar", cantidad: 0.7 },
        { t: "rotar", pieza: "ssd", eje: "x", grados: 90 },
      ],
    });
    let estado: EstadoEscena = aplicarCoreografia(inicial(), paso, ctx).estado;
    expect(estado.piezas.bateria.visible).toBe(false);
    expect(estado.despiece).toBe(0.7);
    estado = aplicarAccion(estado, { t: "restaurar" }, ctx).estado;
    expect(estado).toEqual(inicial());
  });

  it("no modifica el estado recibido", () => {
    const antes = inicial();
    const copia = structuredClone(antes);
    aplicarCoreografia(antes, coreografiaEjemplo[1], ctx);
    expect(antes).toEqual(copia);
  });
});

describe("desplazamientoDespiece", () => {
  it("no mueve la raíz ni nada con cantidad 0", () => {
    expect(desplazamientoDespiece([5, 1, 5], null, 1)).toEqual([0, 0, 0]);
    expect(desplazamientoDespiece([5, 1, 5], [0, 0, 0], 0)).toEqual([0, 0, 0]);
  });

  it("sube y se aleja del centro del padre", () => {
    const [x, y, z] = desplazamientoDespiece([10, 1, -4], [0, 0, 0], 1);
    expect(y).toBeGreaterThan(0);
    expect(x).toBeGreaterThan(0);
    expect(z).toBeLessThan(0);
  });
});
