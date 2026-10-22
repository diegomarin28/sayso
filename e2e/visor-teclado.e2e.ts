import { expect, test } from "@playwright/test";
import { Libreta, escucharConsola, prepararNavegador, sinRedNiIA } from "./ayudas";
import { llegarAlExperto } from "./recorrido";

/**
 * Accesibilidad del visor 3D (#396): región con nombre, cámara por teclado, aviso de la pieza
 * resaltada y menos movimiento. Todo con NEXT_PUBLIC_DATOS=fixture: sin IA ni internet.
 */

for (const reducido of [false, true]) {
  test(`Visor 3D por teclado${reducido ? " con menos movimiento" : ""}`, async ({ page, context }, info) => {
    const libreta = new Libreta(info);
    await prepararNavegador(context);
    await sinRedNiIA(context, libreta);
    escucharConsola(page, libreta);
    if (reducido) await page.emulateMedia({ reducedMotion: "reduce" });
    await llegarAlExperto(page);

    const visor = page.getByRole("group", { name: /Modelo 3D del equipo/ });
    await expect(visor).toBeVisible();
    await expect(visor).toHaveAttribute("tabindex", "0");
    await expect(visor.locator("canvas")).toBeAttached();
    // El lienzo no se lee: lo dice la región.
    await expect(visor.locator("[aria-hidden=true] canvas")).toHaveCount(1);
    await expect(visor.getByRole("status")).toBeAttached();

    // Las teclas llegan al visor cuando tiene el foco y no se escapan a la página.
    await visor.focus();
    await expect(visor).toBeFocused();
    const antes = await page.evaluate(() => window.scrollY);
    for (const tecla of ["ArrowLeft", "ArrowUp", "+", "-", "Escape"]) await page.keyboard.press(tecla);
    expect(await page.evaluate(() => window.scrollY)).toBe(antes);

    // Tab sigue de largo: el visor no atrapa el foco.
    await page.keyboard.press("Tab");
    await expect(visor).not.toBeFocused();

    await libreta.guardar();
    expect.soft(libreta.hallazgos.filter((h) => h.tipo === "problema"), "Problemas anotados").toEqual([]);
  });
}
