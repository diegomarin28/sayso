import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { prepararNavegador, sinRedNiIA, Libreta } from "./ayudas";
import { llegarAlExperto } from "./recorrido";

/**
 * Accesibilidad con teclado: los diálogos del experto reciben el foco, no lo dejan escapar, se
 * cierran con Escape y el foco vuelve al botón que los abrió; y cada pantalla tiene un solo <h1>.
 * Todo con NEXT_PUBLIC_DATOS=fixture: sin IA ni internet (ver playwright.config.ts).
 */

const activo = (page: Page) =>
  page.evaluate(() => {
    const e = document.activeElement as HTMLElement | null;
    return { etiqueta: e?.getAttribute("aria-label") || e?.textContent?.trim() || e?.tagName || "", dentro: !!e?.closest("[role=dialog]") };
  });

async function irAlExperto(page: Page, context: BrowserContext, info: TestInfo) {
  await prepararNavegador(context);
  await sinRedNiIA(context, new Libreta(info));
  await llegarAlExperto(page);
  const ayuda = page.getByRole("dialog", { name: "Así se usa esta pantalla" });
  if (await ayuda.isVisible()) await page.getByRole("button", { name: "Entendido" }).click();
  await expect(ayuda).toBeHidden();
}

test("la ayuda del experto toma el foco y se cierra con Escape", async ({ page, context }, info) => {
  await prepararNavegador(context);
  await sinRedNiIA(context, new Libreta(info));
  await llegarAlExperto(page);
  const ayuda = page.getByRole("dialog", { name: "Así se usa esta pantalla" });
  await expect(ayuda).toBeVisible();
  expect((await activo(page)).dentro).toBe(true);
  await page.keyboard.press("Escape");
  await expect(ayuda).toBeHidden();
});

test("el chat con el experto se usa con teclado: el foco queda adentro, Escape cierra y el foco vuelve al botón", async ({ page, context }, info) => {
  await irAlExperto(page, context, info);
  const boton = page.getByRole("button", { name: /^Hablar con el experto/ });
  const dialogo = page.getByRole("dialog", { name: "Hablar con el experto" });
  const lateral = !(await dialogo.count()) && (page.viewportSize()?.width ?? 0) >= 768;

  await boton.focus();
  await page.keyboard.press("Enter");
  if (lateral) {
    // Pantalla ancha: el chat es un panel a la derecha, no un diálogo modal.
    await expect(page.getByRole("complementary", { name: "Hablar con el experto" })).toBeVisible();
  } else {
    await expect(dialogo).toBeVisible();
    expect((await activo(page)).dentro).toBe(true);
    // Tab no sale del diálogo, ni hacia adelante ni hacia atrás.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect((await activo(page)).dentro, `Tab ${i + 1}`).toBe(true);
    }
    await page.keyboard.press("Shift+Tab");
    expect((await activo(page)).dentro).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  await expect(boton).toBeFocused();
});

for (const [nombre, boton, dialogo] of [
  ["repuestos", /^Ver dónde comprar repuestos/, "Repuestos"],
  ["«¿De dónde sale esto?»", /^¿De dónde sale esto\?/, "De dónde sale esto"],
  ["terminar el caso", /^Terminar$/, "Terminar el caso"],
] as const) {
  test(`${nombre}: foco adentro, Escape cierra y el foco vuelve al botón`, async ({ page, context }, info) => {
    await irAlExperto(page, context, info);
    const abridor = page.getByRole("button", { name: boton });
    await abridor.focus();
    await page.keyboard.press("Enter");
    const hoja = page.getByRole("dialog", { name: dialogo });
    await expect(hoja).toBeVisible();
    expect((await activo(page)).dentro).toBe(true);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      expect((await activo(page)).dentro, `Tab ${i + 1}`).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(hoja).toBeHidden();
    await expect(abridor).toBeFocused();
  });
}

test("cada pantalla tiene un solo título de nivel 1 y su título de pestaña", async ({ page, context }, info) => {
  await prepararNavegador(context);
  await sinRedNiIA(context, new Libreta(info));
  for (const [ruta, titulo] of [
    ["/", /Sayso/],
    ["/casos", /Mis casos · Sayso/],
    ["/cuenta", /Tu cuenta · Sayso/],
    ["/como-funciona", /Cómo funciona · Sayso/],
    ["/ruta-que-no-existe", /Sayso/],
  ] as const) {
    await page.goto(ruta);
    await expect(page.locator(".inicio")).toBeHidden();
    await expect(page.locator("h1:visible"), ruta).toHaveCount(1);
    await expect(page, ruta).toHaveTitle(titulo);
  }
  await llegarAlExperto(page);
  await expect(page.locator("h1:visible")).toHaveCount(1);
  await expect(page).toHaveTitle("Experto · Sayso");
});
