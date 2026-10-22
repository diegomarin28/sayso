import { describe, expect, it } from "vitest";
import { Coreografia, Evento, coreografiaEjemplo, planoEjemplo } from "../../shared";
import {
  OBJETIVO_GENERAL,
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

describe("cerrado / abierto (arranca cerrado, se abre cuando la guía lo indica)", () => {
  const ctx = { casoId: "c" };
  const ids = ["carcasa_heladera", "puerta_freezer", "compresor"];
  const cubiertas = { carcasa_heladera: "raiz", puerta_freezer: "tapa" } as const;
  const paso = (acciones: Coreografia["acciones"]): Coreografia => ({ paso: 1, dice: "x", acciones, riesgo: "bajo" });
  const con = (acciones: Coreografia["acciones"], desde = estadoInicial(ids, cubiertas)) => aplicarCoreografia(desde, paso(acciones), ctx).estado;

  it("arranca cerrado", () => {
    expect(estadoInicial(ids, cubiertas).abierto).toBe(false);
  });

  it("se abre al sacar, correr o girar una tapa, o al despiezar", () => {
    expect(con([{ t: "ocultar", pieza: "puerta_freezer" }]).abierto).toBe(true);
    expect(con([{ t: "desplazar", pieza: "puerta_freezer", vec: [0, 0, 10] }]).abierto).toBe(true);
    expect(con([{ t: "rotar", pieza: "puerta_freezer", eje: "y", grados: 90 }]).abierto).toBe(true);
    expect(con([{ t: "despiezar", cantidad: 1 }]).abierto).toBe(true);
  });

  it("no se abre por girar la carcasa raíz (girar el equipo no es abrirlo) ni por resaltar una pieza", () => {
    expect(con([{ t: "rotar", pieza: "carcasa_heladera", eje: "y", grados: 180 }]).abierto).toBe(false);
    expect(con([{ t: "resaltar", pieza: "compresor" }, { t: "camara", objetivo: "compresor" }]).abierto).toBe(false);
  });

  it("se cierra al armar, al restaurar y con un paso que solo vuelve a la vista general (las tapas vuelven a su lugar)", () => {
    const abierto = con([{ t: "ocultar", pieza: "puerta_freezer" }, { t: "rotar", pieza: "carcasa_heladera", eje: "y", grados: 180 }, { t: "despiezar", cantidad: 1 }]);
    expect(con([{ t: "despiezar", cantidad: 0 }], abierto).abierto).toBe(false);
    const restaurado = con([{ t: "restaurar" }], abierto);
    expect(restaurado.abierto).toBe(false);
    expect(restaurado.cubiertas).toEqual(cubiertas);
    const general = con([{ t: "camara", objetivo: OBJETIVO_GENERAL }], abierto);
    expect(general.abierto).toBe(false);
    expect(general.despiece).toBe(0);
    expect(general.piezas.puerta_freezer.visible).toBe(true);
    expect(general.piezas.carcasa_heladera.rot[1]).toBeCloseTo(Math.PI); // el equipo sigue girado: solo se cierra
  });

  it("un paso que abre y después encuadra lo general no se cierra", () => {
    expect(con([{ t: "ocultar", pieza: "puerta_freezer" }, { t: "camara", objetivo: OBJETIVO_GENERAL }]).abierto).toBe(true);
  });
});

describe("un paso que no mira ni resalta nada vuelve a la vista general", () => {
  const ctx = { casoId: "c" };
  const paso = (n: number, acciones: Coreografia["acciones"]): Coreografia => ({ paso: n, dice: "…", acciones, riesgo: "bajo" });
  it.each([
    ["sin acciones", []],
    ["solo mueve una pieza", [{ t: "rotar", pieza: "tapa_inferior", eje: "x", grados: -100 }]],
  ] as const)("%s: cámara en la vista general y sin el resaltado anterior", (_, acciones) => {
    const inicio = estadoInicial(["base", "bateria", "tapa_inferior"]);
    const enfocado = aplicarCoreografia(inicio, paso(1, [{ t: "camara", objetivo: "bateria", zoom: 1.4 }, { t: "resaltar", pieza: "bateria" }]), ctx).estado;
    expect(enfocado.camara).toEqual({ objetivo: "bateria", zoom: 1.4 });
    const siguiente = aplicarCoreografia(enfocado, paso(2, [...acciones]), ctx).estado;
    expect(siguiente.camara).toEqual({ objetivo: "general", zoom: 1 });
    expect(siguiente.piezas.bateria.resaltada).toBe(false);
  });

  it("un paso que resalta sin mover la cámara la deja donde estaba", () => {
    const enfocado = aplicarCoreografia(estadoInicial(["base", "bateria"]), paso(1, [{ t: "camara", objetivo: "bateria" }]), ctx).estado;
    expect(aplicarCoreografia(enfocado, paso(2, [{ t: "resaltar", pieza: "bateria" }]), ctx).estado.camara.objetivo).toBe("bateria");
  });
});
