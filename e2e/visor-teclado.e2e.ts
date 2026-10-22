import { expect, test } from "@playwright/test";
import { Libreta, escucharConsola, prepararNavegador, sinRedNiIA } from "./ayudas";
import { llegarAlExperto } from "./recorrido";

/**
 * Accesibilidad del visor 3D (#396, #403): región con nombre, cámara por teclado, elegir pieza con Tab
 * y Enter, aviso de la pieza resaltada y menos movimiento. Todo con NEXT_PUBLIC_DATOS=fixture: sin IA ni internet.
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
    for (const tecla of ["ArrowLeft", "ArrowUp", "+", "-"]) await page.keyboard.press(tecla);
    expect(await page.evaluate(() => window.scrollY)).toBe(antes);

    // Tab lleva a la lista de piezas; Enter elige la primera y el aviso lo dice.
    const lista = page.getByRole("list", { name: "Piezas del 3D" });
    await page.keyboard.press("Tab");
    const primera = lista.getByRole("button").first();
    await expect(primera).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(primera).toHaveAttribute("aria-pressed", "true");
    await expect(visor.getByRole("status")).toContainText("Elegida:");

    // Escape suelta la pieza (sigue el foco); el siguiente vuelve a la guía y el último suelta el foco.
    await page.keyboard.press("Escape");
    await expect(primera).toHaveAttribute("aria-pressed", "false");
    await expect(primera).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(primera).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(primera).not.toBeFocused();

    // Tab sigue de largo: desde la última pieza, el foco pasa a los controles del 3D y no queda atrapado.
    await lista.getByRole("button").last().focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /Opciones del 3D/ })).toBeFocused();

    await libreta.guardar();
    expect.soft(libreta.hallazgos.filter((h) => h.tipo === "problema"), "Problemas anotados").toEqual([]);
  });
}
