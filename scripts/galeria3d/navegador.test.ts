import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { navegadorDeLaGaleria } from "./navegador";

/** Una caché de Playwright de mentira con estas carpetas (y el ejecutable adentro de las de chromium sin ventana). */
let casa = "";
const cacheCon = (...versiones: string[]) => {
  casa = mkdtempSync(join(tmpdir(), "navegador-"));
  const cache = join(casa, "Library", "Caches", "ms-playwright");
  for (const v of versiones) {
    const dir = join(cache, v, "chrome-headless-shell-mac-arm64");
    mkdirSync(dir, { recursive: true });
    if (v.startsWith("chromium_headless_shell")) writeFileSync(join(dir, "chrome-headless-shell"), "");
  }
  return cache;
};
afterEach(() => rmSync(casa, { recursive: true, force: true }));

describe("navegador de la galería (nunca el Chrome del sistema, que llenó el disco)", () => {
  it("usa el chromium sin ventana más nuevo de la caché de Playwright", () => {
    const cache = cacheCon("chromium_headless_shell-1243", "chromium_headless_shell-1248", "ffmpeg-1013");
    expect(navegadorDeLaGaleria({}, casa, "darwin")).toBe(join(cache, "chromium_headless_shell-1248", "chrome-headless-shell-mac-arm64", "chrome-headless-shell"));
  });

  it("sin chromium en la caché falla (no cae al Chrome del sistema)", () => {
    cacheCon("ffmpeg-1013", "webkit-2370");
    expect(() => navegadorDeLaGaleria({}, casa, "darwin")).toThrow(/Chrome del sistema/);
  });

  it("CHROME y PLAYWRIGHT_BROWSERS_PATH lo cambian a propósito", () => {
    const cache = cacheCon("chromium_headless_shell-1248");
    expect(navegadorDeLaGaleria({ CHROME: "/otro/chrome" }, casa, "darwin")).toBe("/otro/chrome");
    expect(navegadorDeLaGaleria({ PLAYWRIGHT_BROWSERS_PATH: cache }, "/no/existe", "linux")).toContain("chromium_headless_shell-1248");
  });
});
