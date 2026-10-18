import { describe, expect, it } from "vitest";
import { coreografiaEjemplo, type Coreografia } from "../../../shared";
import type { EventoChat } from "./eventos-chat";
import { guiaPendiente, Reproductor, type EstadoControles, type EstadoGuia, type ModoAvance } from "./reproducir";

const paso = (n: number, extra: Partial<Coreografia> = {}): Coreografia => ({ ...coreografiaEjemplo[0], paso: n, dice: `Paso ${n}.`, ...extra });
const tick = () => new Promise((r) => setTimeout(r, 0));
async function hasta(cond: () => boolean) {
  for (let i = 0; i < 200 && !cond(); i++) await tick();
  if (!cond()) throw new Error("no pasó");
}

/** Stream que entrega los eventos de a uno cuando el test lo pide (o todos de una). */
function stream(eventos: EventoChat[], { deAUno = false } = {}) {
  const pendientes = [...eventos];
  let permisos = 0; // entregas pedidas por el test (aunque el stream todavía no esté esperando)
  let soltar: (() => void) | null = null;
  return {
    entregar: () => {
      permisos++;
      soltar?.();
    },
    iterable: (async function* () {
      while (pendientes.length) {
        if (deAUno) {
          while (permisos === 0) await new Promise<void>((r) => (soltar = r));
          permisos--;
        }
        yield pendientes.shift()!;
      }
    })(),
  };
}

/** Voz de mentira: cada frase queda "diciéndose" hasta `terminar()` o hasta que la cortan. */
function armar(modo: ModoAvance, inicio?: number) {
  const dichos: string[] = [];
  const cortados: string[] = [];
  const mostrados: number[] = [];
  const estados: EstadoGuia[] = [];
  let terminar: (() => void) | null = null;
  let controles: EstadoControles | null = null;
  const r = new Reproductor({ modo, alCambiar: (c) => (controles = c), inicio });
  const m = {
    estado: (e: EstadoGuia) => void estados.push(e),
    paso: (_c: Coreografia, _b: boolean, i: number) => void mostrados.push(i),
    decir: (t: string, senal: AbortSignal) =>
      new Promise<void>((res) => {
        dichos.push(t);
        terminar = () => ((terminar = null), res());
        senal.addEventListener("abort", () => (cortados.push(t), (terminar = null), res()), { once: true });
      }),
  };
  return {
    r,
    m,
    dichos,
    cortados,
    mostrados,
    estados,
    terminar: async () => {
      await hasta(() => terminar !== null);
      terminar!();
      await tick();
    },
    controles: () => controles!,
  };
}

const tres: EventoChat[] = [
  { tipo: "paso", coreografia: paso(1) },
  { tipo: "paso", coreografia: paso(2) },
  { tipo: "paso", coreografia: paso(3) },
  { tipo: "fin", pasos: 3 },
];

describe("Reproductor: controles de la guía (B5)", () => {
  it("manual (por defecto): dice el primer paso y espera Siguiente; no avanza solo", async () => {
    const g = armar("manual");
    const fin = g.r.reproducir(stream(tres).iterable, g.m, new AbortController().signal);
    await g.terminar(); // termina de decir el paso 1
    await tick();
    expect(g.mostrados).toEqual([0]);
    expect(g.controles()).toMatchObject({ indice: 0, esperando: true, haySiguiente: true, hayAnterior: false, completa: true });
    g.r.siguiente();
    await g.terminar();
    expect(g.mostrados).toEqual([0, 1]);
    g.r.siguiente();
    await g.terminar(); // el último no espera nada
    expect(await fin).toEqual({ rol: "experto", texto: "Paso 1. Paso 2. Paso 3." });
    expect(g.mostrados).toEqual([0, 1, 2]);
  });

  it("automático: sigue solo después de cada frase", async () => {
    const g = armar("auto");
    const fin = g.r.reproducir(stream(tres).iterable, g.m, new AbortController().signal);
    await g.terminar();
    await g.terminar();
    await g.terminar();
    await fin;
    expect(g.mostrados).toEqual([0, 1, 2]);
  });

  it("pausar corta la voz; seguir repite la frase desde el principio; en auto no avanza mientras está pausado", async () => {
    const g = armar("auto");
    const fin = g.r.reproducir(stream(tres).iterable, g.m, new AbortController().signal);
    await hasta(() => g.dichos.length === 1);
    g.r.pausar();
    await tick();
    expect(g.cortados).toEqual(["Paso 1."]); // la voz se cortó
    expect(g.controles().pausado).toBe(true);
    await tick();
    expect(g.mostrados).toEqual([0]); // pausado: no avanza
    g.r.seguir();
    await hasta(() => g.dichos.length === 2);
    expect(g.dichos).toEqual(["Paso 1.", "Paso 1."]); // repite la frase
    await g.terminar();
    await g.terminar();
    await g.terminar();
    await fin;
    expect(g.mostrados).toEqual([0, 1, 2]);
  });

  it("anterior vuelve a mostrar y decir el paso previo, sin cancelar la respuesta", async () => {
    const g = armar("manual");
    const fin = g.r.reproducir(stream(tres).iterable, g.m, new AbortController().signal);
    await g.terminar();
    g.r.siguiente();
    await hasta(() => g.dichos.length === 2);
    g.r.anterior(); // corta el paso 2 y vuelve al 1
    await hasta(() => g.dichos.length === 3);
    expect(g.cortados).toEqual(["Paso 2."]);
    expect(g.mostrados).toEqual([0, 1, 0]);
    await g.terminar();
    expect(g.controles()).toMatchObject({ indice: 0, esperando: true });
    g.r.irA(2);
    await g.terminar();
    await fin;
    expect(g.mostrados).toEqual([0, 1, 0, 2]);
  });

  it("Siguiente antes de que llegue el paso: se muestra apenas llega", async () => {
    const g = armar("manual");
    const s = stream(tres, { deAUno: true });
    const fin = g.r.reproducir(s.iterable, g.m, new AbortController().signal);
    s.entregar(); // llega el paso 1
    await g.terminar();
    expect(g.controles()).toMatchObject({ total: 1, haySiguiente: true, completa: false });
    g.r.siguiente(); // el 2 todavía no llegó
    await tick();
    expect(g.mostrados).toEqual([0]);
    s.entregar(); // llega el 2
    await hasta(() => g.mostrados.length === 2);
    await g.terminar();
    s.entregar();
    s.entregar();
    g.r.siguiente();
    await g.terminar();
    await fin;
    expect(g.mostrados).toEqual([0, 1, 2]);
  });

  it("después de un bloqueo no hay Siguiente y termina bloqueado", async () => {
    const g = armar("manual");
    const bloqueo = paso(2, { dice: "Acá frenamos.", riesgo: "alto", acciones: [{ t: "restaurar" }] });
    const fin = g.r.reproducir(
      stream([{ tipo: "paso", coreografia: paso(1) }, { tipo: "bloqueo", coreografia: bloqueo, clases: ["bateria"] }]).iterable,
      g.m,
      new AbortController().signal,
    );
    await g.terminar();
    g.r.siguiente();
    await g.terminar();
    await fin;
    expect(g.estados.at(-1)).toBe("bloqueado");
    expect(g.controles().haySiguiente).toBe(false);
  });

  it("una pregunta nueva (abort) corta la voz y termina", async () => {
    const g = armar("manual");
    const ctl = new AbortController();
    const fin = g.r.reproducir(stream(tres).iterable, g.m, ctl.signal);
    await hasta(() => g.dichos.length === 1);
    ctl.abort();
    await fin;
    expect(g.cortados).toEqual(["Paso 1."]);
    expect(g.mostrados).toEqual([0]);
  });
});

describe("Reproductor: después de terminar la respuesta", () => {
  it("se puede volver a un paso: lo muestra, lo dice y queda esperando", async () => {
    const g = armar("auto");
    const fin = g.r.reproducir(stream(tres).iterable, g.m, new AbortController().signal);
    await g.terminar();
    await g.terminar();
    await g.terminar();
    await fin;
    g.r.anterior();
    await g.terminar();
    expect(g.mostrados).toEqual([0, 1, 2, 1]);
    expect(g.estados.at(-1)).toBe("esperando");
    expect(g.controles()).toMatchObject({ indice: 1, hayAnterior: true, haySiguiente: true });
  });
});

describe("Reproductor: retomar una guía después de una pregunta suelta", () => {
  it("con `inicio` arranca en ese paso y sigue desde ahí", async () => {
    const g = armar("manual", 1);
    const fin = g.r.reproducir(stream(tres).iterable, g.m, new AbortController().signal);
    await g.terminar();
    expect(g.mostrados).toEqual([1]);
    g.r.siguiente();
    await g.terminar();
    await fin;
    expect(g.mostrados).toEqual([1, 2]);
  });

  it("guiaPendiente: ofrece retomar a mitad de una guía, no al final, no con un solo paso ni en un bloqueo", async () => {
    const g = armar("manual");
    const ctl = new AbortController();
    void g.r.reproducir(stream(tres).iterable, g.m, ctl.signal);
    await g.terminar(); // dijo el paso 1 y espera Siguiente
    expect(guiaPendiente(g.r)).toEqual({ pasos: [paso(1), paso(2), paso(3)], indice: 0 });
    ctl.abort();

    const fin = armar("auto");
    const terminada = fin.r.reproducir(stream(tres).iterable, fin.m, new AbortController().signal);
    await fin.terminar();
    await fin.terminar();
    await fin.terminar();
    await terminada;
    expect(guiaPendiente(fin.r)).toBeNull(); // llegó al último

    const uno = armar("manual");
    const corta = uno.r.reproducir(stream([{ tipo: "paso", coreografia: paso(1) }, { tipo: "fin", pasos: 1 }]).iterable, uno.m, new AbortController().signal);
    await uno.terminar();
    await corta;
    expect(guiaPendiente(uno.r)).toBeNull(); // respuesta corta: nada que retomar

    const b = armar("manual");
    const bloqueo = paso(1, { riesgo: "alto", dice: "Acá frenamos." });
    const conBloqueo = b.r.reproducir(stream([{ tipo: "bloqueo", coreografia: bloqueo, clases: ["bateria"] }, { tipo: "paso", coreografia: paso(2) }]).iterable, b.m, new AbortController().signal);
    await b.terminar();
    await conBloqueo;
    expect(guiaPendiente(b.r)).toBeNull();
  });
});

