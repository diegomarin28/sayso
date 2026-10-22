import { expect, type Page } from "@playwright/test";
import { fotoDeEjemplo, type TipoFoto } from "./ayudas";

/**
 * Atajos para llegar a una pantalla como lo haría una persona, sin las revisiones del recorrido
 * completo (flujo.e2e.ts). Todo con NEXT_PUBLIC_DATOS=fixture: sin IA ni internet.
 * Funcionan con o sin los arreglos pendientes (ej. la ficha con o sin "Está bien, seguir").
 */

export const SINTOMA = "Mi notebook se apaga sola a los diez minutos";

/** Lo que dice el experto en las pantallas 1–4 (el título h1, palabra por palabra; #397). */
export const dice = (page: Page) => page.locator("main h1[aria-live=polite]").first();

export async function subirFoto(page: Page, tipo: TipoFoto, intento = 1, boton = "Elegir de la galería") {
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    // Con solo un ícono (la galería) el nombre está en aria-label; "Elegir otra" tiene texto.
    page.getByLabel(boton, { exact: true }).or(page.getByText(boton, { exact: true })).first().click(),
  ]);
  await selector.setFiles(fotoDeEjemplo(tipo, intento));
}

/** Pantalla 1 → fotos → ficha (con la ficha ya leída). */
export async function llegarALaFicha(page: Page) {
  await page.goto("/");
  await expect(page.locator(".inicio")).toBeHidden(); // pantalla de carga (~2 s)
  await page.getByRole("textbox", { name: "Lo que pasó" }).fill(SINTOMA);
  await page.getByRole("button", { name: /Seguir/ }).click();
  await page.getByRole("button", { name: /Sí, (sigamos|es mi )/ }).click();
  await expect(page).toHaveURL(/\/fotos$/);

  // Fixture: frente aceptada; la primera etiqueta sale movida y se elige otra.
  await subirFoto(page, "frente");
  await expect(dice(page)).toContainText("Dala vuelta");
  await subirFoto(page, "etiqueta", 1);
  await expect(page.getByText("Esta foto no sirve")).toBeVisible();
  await subirFoto(page, "etiqueta", 2, "Elegir otra");
  await page.getByRole("button", { name: /Leer la etiqueta|Reconocer el equipo/ }).click();
  await expect(page).toHaveURL(/\/ficha$/);
  await expect(dice(page)).toContainText("Revisá lo que leí");
}

/**
 * Confirma la ficha como la persona: con "Está bien, seguir" si existe (#228); si no, "Correcto" en
 * cada dato y "Sí, es este".
 */
export async function confirmarFicha(page: Page) {
  const todo = page.getByRole("button", { name: /Está bien, seguir/ });
  if (await todo.isVisible()) {
    await todo.click();
  } else {
    // De a uno y siempre el primero: al tocar "Correcto" ese botón desaparece y los demás se corren.
    const correcto = page.getByRole("button", { name: / correcto$/ });
    for (let i = 0; i < 6 && (await correcto.count()) > 0; i++) await correcto.first().click();
    await page.getByRole("button", { name: /Sí, es este/ }).click();
  }
  await expect(page).toHaveURL(/\/preparando$/);
}

/** Hasta el experto 3D, con el primer paso de la guía a la vista. */
export async function llegarAlExperto(page: Page) {
  await llegarALaFicha(page);
  await confirmarFicha(page);
  await page.getByRole("button", { name: /Ver al experto/ }).click();
  await expect(page).toHaveURL(/\/experto$/);
  await cerrarAyudaDelExperto(page);
  await expect(page.getByText(/^Paso 1 de \d+$/)).toBeVisible();
}

/** La primera vez que se entra al experto, «Así se usa esta pantalla» tapa todo: se cierra con «Entendido». */
export async function cerrarAyudaDelExperto(page: Page) {
  const ayuda = page.getByRole("dialog", { name: "Así se usa esta pantalla" });
  await expect(ayuda).toBeVisible();
  // El 3D por software ocupa el hilo mientras carga: el toque puede tardar más que los 15 s de siempre.
  await ayuda.getByRole("button", { name: "Entendido" }).click({ timeout: 60_000 });
  await expect(ayuda).toBeHidden();
}

/** El chat (uno solo) se abre con el ícono de mensajes, que suma las preguntas hechas: «Hablar con el experto (N)». */
export const botonChat = (page: Page) => page.getByRole("button", { name: /^Hablar con el experto/ });
export const chat = (page: Page) => page.getByRole("dialog", { name: "Hablar con el experto" });

/**
 * Hace una pregunta por texto: abre el chat, escribe y pregunta. En el celular el chat se cierra solo
 * al preguntar (para ver la respuesta en la hoja y el 3D).
 */
export async function preguntar(page: Page, pregunta: string) {
  await botonChat(page).click({ timeout: 60_000 });
  const campo = chat(page).getByRole("textbox", { name: "Pregunta para el experto" });
  await campo.fill(pregunta);
  await chat(page).getByRole("button", { name: "Preguntar", exact: true }).click();
  await expect(chat(page)).toBeHidden();
}
