import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { Libreta, captura, escucharConsola, prepararNavegador, revisarPantalla, sinRedNiIA } from "./ayudas";
import { llegarAlExperto } from "./recorrido";

/**
 * Pantalla 6 — Cierre, en cada celular de la matriz y en compu: sin controles cortados ni tapados
 * y sin scroll de más. Todo con NEXT_PUBLIC_DATOS=fixture: sin IA ni internet.
 */

async function abrirCierre(page: Page, context: BrowserContext, info: TestInfo) {
  const libreta = new Libreta(info);
  await prepararNavegador(context);
  await sinRedNiIA(context, libreta);
  escucharConsola(page, libreta);
  await llegarAlExperto(page);
  // La primera vez el experto abre su instructivo y tapa los botones.
  const entendido = page.getByRole("button", { name: "Entendido" });
  if (await entendido.isVisible()) await entendido.click();
  await page.getByRole("button", { name: "Terminar", exact: true }).click();
  const cierre = page.getByRole("dialog", { name: "Terminar el caso" });
  await expect(cierre.getByRole("heading", { name: "¿Cómo quedó?" })).toBeVisible();
  libreta.pantalla = "6 · Cierre";
  return { libreta, cierre };
}

/** Lo que el panel scrollea de más (px) y si el botón de guardar queda dentro de la pantalla. */
async function medir(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>("[role=dialog][aria-label='Terminar el caso']")!;
    const guardar = [...panel.querySelectorAll("button")].find((b) => b.textContent?.includes("Guardar en Mis casos"))!;
    const b = guardar.getBoundingClientRect();
    return {
      sobra: panel.scrollHeight - panel.clientHeight,
      guardarDentro: b.top >= 0 && b.bottom <= window.innerHeight + 1,
    };
  });
}

test("Cierre: opciones, resumen y botón a la vista sin scroll de más", async ({ page, context }, info) => {
  const { libreta, cierre } = await abrirCierre(page, context, info);

  await expect(cierre.getByRole("radio")).toHaveCount(3);
  await expect(cierre.getByText(/pasos? en la guía/)).toBeVisible();
  const guardar = cierre.getByRole("button", { name: "Guardar en Mis casos" });
  await expect(guardar).toBeDisabled(); // sin elegir no se guarda

  await revisarPantalla(page, libreta);
  const m = await medir(page);
  expect(m.guardarDentro, "Guardar en Mis casos dentro de la pantalla").toBe(true);
  expect(m.sobra, "scroll de más con el panel recién abierto").toBeLessThanOrEqual(1);
  await captura(page, info, "cierre-inicial");

  // «Pedí el repuesto» abre el selector de pieza; el botón sigue al alcance.
  await cierre.getByRole("radio", { name: /Pedí el repuesto/ }).click();
  await expect(cierre.getByLabel("¿Qué pieza pediste?")).toBeVisible();
  await expect(guardar).toBeEnabled();
  // Con el selector abierto puede haber que scrollear: el botón fijo tapa lo de abajo hasta el
  // final, así que se revisa con el panel al final, donde nada queda tapado.
  await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>("[role=dialog][aria-label='Terminar el caso']")!;
    panel.scrollTop = panel.scrollHeight;
  });
  await revisarPantalla(page, libreta);
  await captura(page, info, "cierre-repuesto");
  expect((await medir(page)).guardarDentro).toBe(true);

  await libreta.guardar();
  expect.soft(libreta.hallazgos.filter((h) => h.tipo === "problema" && h.pantalla === "6 · Cierre"), "Problemas anotados").toEqual([]);
});

test("Cierre en compu: centrado y sin scroll", async ({ page, context }, info) => {
  const { libreta, cierre } = await abrirCierre(page, context, info);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(cierre.getByRole("radio")).toHaveCount(3);
  const m = await medir(page);
  expect(m.guardarDentro).toBe(true);
  expect(m.sobra).toBeLessThanOrEqual(1);
  await captura(page, info, "cierre-compu");
  await libreta.guardar();
  expect.soft(libreta.hallazgos.filter((h) => h.tipo === "problema" && h.pantalla === "6 · Cierre"), "Problemas anotados").toEqual([]);
});
