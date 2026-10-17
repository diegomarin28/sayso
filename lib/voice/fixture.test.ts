import { afterEach, describe, expect, it, vi } from "vitest";

/** Con NEXT_PUBLIC_DATOS=fixture no se gasta ElevenLabs ni se guardan casos de prueba en Supabase. */

describe("modo fixture: sin gasto", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("hablar usa la voz del navegador y no llama a /api/voz/hablar", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATOS", "fixture");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const habladas: string[] = [];
    vi.stubGlobal("speechSynthesis", {
      getVoices: () => [],
      cancel: () => {},
      speak: (u: { text: string; onend?: () => void }) => {
        habladas.push(u.text);
        u.onend?.();
      },
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        lang = "";
        voice = null;
        onend?: () => void;
        onerror?: () => void;
        constructor(public text: string) {}
      },
    );
    const { hablar } = await import("./hablar");
    await hablar("hola").termino;
    expect(fetch).not.toHaveBeenCalled();
    expect(habladas).toEqual(["hola"]);
  });

  it("guardar no llama a /api/casos", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATOS", "fixture");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { guardar } = await import("../../app/(screens)/_datos/guardar");
    guardar({ eventos: [] });
    await new Promise((r) => setTimeout(r, 10));
    expect(fetch).not.toHaveBeenCalled();
  });
});
