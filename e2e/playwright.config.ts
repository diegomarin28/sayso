import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de punta a punta: recorren el flujo entero como una persona, en tamaños de celular.
 *
 * Correr: `npm run e2e` (levanta su propio `next dev` en el puerto 3100).
 * La primera vez (navegadores adentro del proyecto, ver PLAYWRIGHT_BROWSERS_PATH abajo):
 * `PLAYWRIGHT_BROWSERS_PATH=0 node node_modules/@playwright/test/cli.js install --only-shell chromium webkit`.
 * Tests pendientes (issues sin arreglo fusionado): ver `pendientes.e2e.ts`.
 *
 * Regla de gasto: CERO IA real. El servidor arranca con NEXT_PUBLIC_DATOS=fixture (las pantallas
 * responden con los fixtures de `shared/`) e IA_APAGADA=1 (si algo llegara a /api, el freno corta
 * antes de llamar a Claude). Además cada test aborta cualquier pedido a /api/* o a internet y lo
 * anota como problema (ver `ayudas.ts`).
 *
 * Los iPhone se emulan con Chromium (tamaño, pantalla táctil, user agent), no con Safari real.
 */

const PUERTO = Number(process.env.E2E_PUERTO ?? 3100);

// Los navegadores van adentro del proyecto (node_modules/playwright-core/.local-browsers), no en
// ~/Library/Caches: las limpiezas de disco borran ese caché y los tests no arrancaban.
// Instalarlos con la misma variable: `PLAYWRIGHT_BROWSERS_PATH=0 node node_modules/@playwright/test/cli.js install --only-shell chromium webkit`.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= "0";
/**
 * Nunca el Chrome del sistema (sin `channel: "chrome"`): en Mac, cada vez que se abre Google
 * Chrome.app deja una copia de ~700 MB en /private/var/folders/.../X/com.google.Chrome.code_sign_clone.
 * Se usa el chrome-headless-shell que baja Playwright (un binario suelto, no una .app). Un navegador
 * por proyecto y por ronda (workers: 1); Playwright lo cierra normal al terminar.
 */
const chromium = {
  defaultBrowserType: "chromium" as const,
  // Permite el 3D por software si la máquina (o la CI) no tiene GPU. Solo Chromium: WebKit no la entiende.
  launchOptions: { args: ["--enable-unsafe-swiftshader"] },
};

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
    // Un toque o una navegación que no responde falla a los 15 s (no espera los 4 min del test).
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Sin video: pesa y el disco de la Mac está justo. Para ver una falla alcanza la traza.
    video: "off",
  },
  projects: [
    // Chromium con tamaño, toque y user agent de cada celular: todos los tests.
    { name: "iphone-se", use: { ...devices["iPhone SE"], ...chromium } },
    { name: "iphone-15", use: { ...devices["iPhone 15"], ...chromium } },
    { name: "pixel-7", use: { ...devices["Pixel 7"], ...chromium } },
    // WebKit (el motor de Safari) táctil, como un iPhone de verdad: solo los tests marcados @webkit
    // (ej. #227, el modal que en iPhone no se cerraba). La primera vez: `... install webkit`.
    { name: "iphone-13-webkit", use: { ...devices["iPhone 13"] }, testMatch: "**/pendientes.e2e.ts", grep: /@webkit/ },
    { name: "iphone-se-webkit", use: { ...devices["iPhone SE"] }, testMatch: "**/pendientes.e2e.ts", grep: /@webkit/ },
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
