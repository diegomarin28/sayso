import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorVoz, hablarStream, hayElevenLabs, tokenScribe } from "./elevenlabs";

describe("lib/voice/elevenlabs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sin clave avisa con 503 y no llama a ElevenLabs", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(hayElevenLabs()).toBe(false);
    await expect(tokenScribe()).rejects.toMatchObject({ status: 503 });
    await expect(hablarStream("hola")).rejects.toBeInstanceOf(ErrorVoz);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("pide el token de Scribe con la clave en el encabezado, nunca en la URL", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "clave-de-prueba");
    const fetch = vi.fn().mockResolvedValue(Response.json({ token: "sutkn_1" }));
    vi.stubGlobal("fetch", fetch);
    expect(await tokenScribe()).toBe("sutkn_1");
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe");
    expect(String(url)).not.toContain("clave-de-prueba");
    expect(init.headers["xi-api-key"]).toBe("clave-de-prueba");
  });

  it("habla en español con el modelo Flash", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "k");
    const fetch = vi.fn().mockResolvedValue(new Response("mp3"));
    vi.stubGlobal("fetch", fetch);
    await hablarStream("hola");
    const cuerpo = JSON.parse(fetch.mock.calls[0][1].body);
    expect(cuerpo).toMatchObject({ text: "hola", model_id: "eleven_flash_v2_5", language_code: "es" });
  });

  it("si ElevenLabs falla, error 502 para que el navegador use su voz", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("cuota", { status: 429 })));
    await expect(hablarStream("hola")).rejects.toMatchObject({ status: 502 });
  });
});
