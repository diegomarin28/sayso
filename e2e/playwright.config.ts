import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de punta a punta: recorren el flujo entero como una persona, en tamaños de celular.
 *
 * Correr: `npm run e2e` (levanta su propio `next dev` en el puerto 3100).
 * La primera vez: `node node_modules/@playwright/test/cli.js install chromium`.
 *
 * Regla de gasto: CERO IA real. El servidor arranca con NEXT_PUBLIC_DATOS=fixture (las pantallas
 * responden con los fixtures de `shared/`) e IA_APAGADA=1 (si algo llegara a /api, el freno corta
 * antes de llamar a Claude). Además cada test aborta cualquier pedido a /api/* o a internet y lo
 * anota como problema (ver `ayudas.ts`).
 *
 * Los iPhone se emulan con Chromium (tamaño, pantalla táctil, user agent), no con Safari real.
 */

const PUERTO = Number(process.env.E2E_PUERTO ?? 3100);
const chromium = { defaultBrowserType: "chromium" as const };

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.e2e.ts",
  outputDir: "resultados/artefactos",
  // El flujo tiene esperas simuladas (fotos, chapa, manual) y `next dev` compila cada ruta la primera vez.
  timeout: 240_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "resultados/informe.json" }],
    ["html", { outputFolder: "resultados/html", open: "never" }],
  ],
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: {
      // Permite el 3D por software si la máquina (o la CI) no tiene GPU.
      args: ["--enable-unsafe-swiftshader"],
    },
  },
  projects: [
    { name: "iphone-se", use: { ...devices["iPhone SE"], ...chromium } },
    { name: "iphone-15", use: { ...devices["iPhone 15"], ...chromium } },
    { name: "pixel-7", use: { ...devices["Pixel 7"], ...chromium } },
  ],
  webServer: {
    // `node` directo y no `npx`: npx puede quedarse colgado resolviendo el paquete.
    command: `node node_modules/next/dist/bin/next dev --port ${PUERTO}`,
    cwd: "..",
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      NEXT_PUBLIC_DATOS: "fixture",
      IA_APAGADA: "1",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
