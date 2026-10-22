import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { Libreta, captura, escucharConsola, prepararNavegador, revisarPantalla, sinRedNiIA } from "./ayudas";
import { llegarAlExperto } from "./recorrido";

/**
 * Botón de silencio de la voz de la IA: en el inicio y en el Experto, con nombre accesible, sin
 * pisarse con los otros botones del encabezado (iPhone SE, iPhone 15, Pixel 7 y compu).
 * Todo con NEXT_PUBLIC_DATOS=fixture: sin IA ni internet.
 */

async function abrir(page: Page, context: BrowserContext, info: TestInfo) {
  const libreta = new Libreta(info);
  await prepararNavegador(context);
  await sinRedNiIA(context, libreta);
  escucharConsola(page, libreta);
  return libreta;
}

/** Los botones del encabezado no se superponen entre sí y quedan dentro de la pantalla. */
async function encabezadoSinChoques(page: Page) {
  const cajas = await page.evaluate(() => {
    const cab = document.querySelector("header");
    const ancho = window.innerWidth;
    return [...(cab?.querySelectorAll("button, a[href]") ?? [])]
      .map((el) => {
        const b = el.getBoundingClientRect();
        const nombre = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30);
        return { nombre, x: b.left, r: b.right, y: b.top, d: b.bottom, ancho };
      })
      .filter((c) => c.r > c.x);
  });
  expect(cajas.length).toBeGreaterThan(1);
  for (const c of cajas) {
    expect(c.x, `${c.nombre} dentro por la izquierda`).toBeGreaterThanOrEqual(-1);
    expect(c.r, `${c.nombre} dentro por la derecha`).toBeLessThanOrEqual(c.ancho + 1);
  }
  for (let i = 0; i < cajas.length; i++)
    for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i];
      const b = cajas[j];
      const choca = a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.d - 1 && b.y < a.d - 1;
      expect(choca, `«${a.nombre}» pisa a «${b.nombre}»`).toBe(false);
    }
}

async function alternar(page: Page) {
  const silenciar = page.getByRole("button", { name: "Silenciar la voz" });
  await expect(silenciar).toBeVisible();
  await expect(silenciar).toHaveAttribute("aria-pressed", "false");
  await silenciar.click();
  const activar = page.getByRole("button", { name: "Activar la voz" });
  await expect(activar).toHaveAttribute("aria-pressed", "true");
  return activar;
}

test("Inicio: botón de silencio en el encabezado, sin amontonarse", async ({ page, context }, info) => {
  const libreta = await abrir(page, context, info);
  await page.goto("/");
  libreta.pantalla = "1 · Inicio";
  await encabezadoSinChoques(page);
  const activar = await alternar(page);
  await encabezadoSinChoques(page);
  await captura(page, info, "silencio-inicio");

  // Se recuerda al recargar.
  await page.reload();
  await expect(page.getByRole("button", { name: "Activar la voz" })).toHaveAttribute("aria-pressed", "true");
  await activar.click();
  await expect(page.getByRole("button", { name: "Silenciar la voz" })).toBeVisible();
  await libreta.guardar();
  expect.soft(libreta.hallazgos.filter((h) => h.tipo === "problema"), "Problemas anotados").toEqual([]);
});

test("Experto: el silencio convive con Atrás, repuestos y Terminar", async ({ page, context }, info) => {
  const libreta = await abrir(page, context, info);
  await llegarAlExperto(page);
  libreta.pantalla = "5 · Experto";
  await encabezadoSinChoques(page);
  await expect(page.getByRole("button", { name: "Terminar", exact: true })).toBeVisible();
  await alternar(page);
  await revisarPantalla(page, libreta);
  await captura(page, info, "silencio-experto");
  await libreta.guardar();
  expect.soft(libreta.hallazgos.filter((h) => h.tipo === "problema" && h.pantalla === "5 · Experto"), "Problemas anotados").toEqual([]);
});

test("Experto en compu: el silencio sigue a la vista", async ({ page, context }, info) => {
  const libreta = await abrir(page, context, info);
  await llegarAlExperto(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await encabezadoSinChoques(page);
  await alternar(page);
  await captura(page, info, "silencio-experto-compu");
  await libreta.guardar();
});
