import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * El navegador de la galería: el chromium sin ventana de la caché de Playwright (`chromium_headless_shell-N`,
 * el más nuevo), nunca el Chrome del sistema: cada vez que se abría dejaba una copia de ~700 MB en
 * /private/var/folders y llenó el disco (18/10). `CHROME` lo cambia, solo a propósito.
 * Si la caché no lo tiene, falla: instalar navegadores puede borrar los de otra versión (pedírselo a Diego).
 */
export function navegadorDeLaGaleria(
  env: Record<string, string | undefined> = process.env,
  casa = homedir(),
  plataforma: NodeJS.Platform = process.platform,
): string {
  if (env.CHROME) return env.CHROME;
  const cache =
    env.PLAYWRIGHT_BROWSERS_PATH ??
    (plataforma === "darwin"
      ? join(casa, "Library", "Caches", "ms-playwright")
      : plataforma === "win32"
        ? join(casa, "AppData", "Local", "ms-playwright")
        : join(casa, ".cache", "ms-playwright"));
  const version = (d: string) => Number(/^chromium_headless_shell-(\d+)$/.exec(d)?.[1] ?? NaN);
  const versiones = (existsSync(cache) ? readdirSync(cache) : []).filter((d) => !Number.isNaN(version(d))).sort((a, b) => version(b) - version(a));
  for (const v of versiones) {
    for (const d of readdirSync(join(cache, v)).filter((d) => d.startsWith("chrome-headless-shell-"))) {
      const ejecutable = join(cache, v, d, plataforma === "win32" ? "chrome-headless-shell.exe" : "chrome-headless-shell");
      if (existsSync(ejecutable)) return ejecutable;
    }
  }
  throw new Error(
    `No está el chromium sin ventana de Playwright en ${cache}. No uses el Chrome del sistema (llena el disco): ` +
      "pedile a Diego que lo instale, o pasá CHROME=<ruta> a propósito.",
  );
}
