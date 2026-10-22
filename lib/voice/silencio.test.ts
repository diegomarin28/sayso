import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** El silencio de la voz de la IA: sin red, con el navegador simulado. */

function navegador(guardado: Record<string, string> = {}, falla = false) {
  const habladas: string[] = [];
  const cancel = vi.fn();
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => {
        if (falla) throw new Error("bloqueado");
        return guardado[k] ?? null;
      },
      setItem: (k: string, v: string) => {
        if (falla) throw new Error("bloqueado");
        guardado[k] = v;
      },
      removeItem: (k: string) => {
        if (falla) throw new Error("bloqueado");
        delete guardado[k];
      },
    },
  });
  vi.stubGlobal("speechSynthesis", {
    getVoices: () => [],
    cancel,
    speak: (u: { text: string; onend?: () => void }) => {
      habladas.push(u.text);
      u.onend?.();
    },
  });
  vi.stubGlobal("SpeechSynthesisUtterance", class {
    lang = "";
    voice = null;
    onend?: () => void;
    onerror?: () => void;
    constructor(public text: string) {}
  });
  return { habladas, cancel, fetch, guardado };
}

describe("silenciar la voz", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_DATOS", "fixture"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("silenciado, hablar no usa ElevenLabs ni la voz del navegador", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATOS", "");
    const { habladas, fetch } = navegador();
    const { hablar, silenciar } = await import("./hablar");
    silenciar(true);
    await hablar("hola").termino;
    expect(fetch).not.toHaveBeenCalled();
    expect(habladas).toEqual([]);
  });

  it("al activarlo corta lo que está sonando", async () => {
    const { cancel } = navegador();
    const { hablar, silenciar } = await import("./hablar");
    hablar("hola");
    silenciar(true);
    expect(cancel).toHaveBeenCalled();
  });

  it("al quitarlo vuelve a hablar", async () => {
    const { habladas } = navegador();
    const { hablar, silenciar } = await import("./hablar");
    silenciar(true);
    silenciar(false);
    await hablar("hola").termino;
    expect(habladas).toEqual(["hola"]);
  });

  it("se recuerda en localStorage y se lee al arrancar", async () => {
    const { guardado } = navegador();
    const a = await import("./hablar");
    a.silenciar(true);
    expect(Object.values(guardado)).toEqual(["1"]);
    vi.resetModules();
    const b = await import("./hablar");
    expect(b.estaSilenciado()).toBe(true);
    b.silenciar(false);
    expect(guardado).toEqual({});
  });

  it("si localStorage falla, igual funciona en memoria", async () => {
    const { habladas } = navegador({}, true);
    const { estaSilenciado, hablar, silenciar } = await import("./hablar");
    expect(estaSilenciado()).toBe(false);
    silenciar(true);
    expect(estaSilenciado()).toBe(true);
    await hablar("hola").termino;
    expect(habladas).toEqual([]);
  });

  it("avisa a quien escucha el cambio", async () => {
    navegador();
    const { silenciar, suscribirSilencio } = await import("./hablar");
    const oyente = vi.fn();
    const baja = suscribirSilencio(oyente);
    silenciar(true);
    baja();
    silenciar(false);
    expect(oyente).toHaveBeenCalledTimes(1);
  });
});
