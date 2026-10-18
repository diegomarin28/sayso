import { expect, test, type Page } from "@playwright/test";
import {
  Libreta,
  alAlcance,
  captura,
  escucharConsola,
  fotoDeEjemplo,
  medir3D,
  prepararNavegador,
  revisarPantalla,
  sinRedNiIA,
  type TipoFoto,
} from "./ayudas";

/**
 * Recorrido completo, como una persona con el celular en la mano:
 * 1 síntoma → 2 fotos → 3 ficha → 4 preparando → 5 experto 3D → una pregunta con respuesta.
 * Todo con NEXT_PUBLIC_DATOS=fixture (ver playwright.config.ts): sin IA ni internet.
 *
 * Lo que rompe el recorrido falla el test. Lo que "se ve mal" se anota (expect.soft + libreta)
 * y queda en el informe, sin cortar el recorrido.
 */

const SINTOMA = "Mi notebook se apaga sola a los diez minutos";
const PREGUNTA = "¿Dónde está la batería?";

/** Lo que dice el experto en las pantallas 1–4 (frase grande, palabra por palabra). */
const dice = (page: Page) => page.locator("main p[aria-live=polite]").first();

async function subirFoto(page: Page, tipo: TipoFoto, intento = 1) {
  // Como la persona: toca "Elegir de la galería" y elige una foto.
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByText("Elegir de la galería").click(),
  ]);
  await selector.setFiles(fotoDeEjemplo(tipo, intento));
}

test("recorrido completo: síntoma, fotos, ficha, preparando, experto 3D y una pregunta", async ({
  page,
  context,
}, info) => {
  const libreta = new Libreta(info);
  await prepararNavegador(context);
  await sinRedNiIA(context, libreta);
  escucharConsola(page, libreta);

  try {
    // ---------- 1. Problema ----------
    libreta.pantalla = "1 · Problema";
    await test.step("1 · escribe el síntoma", async () => {
      await page.goto("/");
      await expect(dice(page)).toContainText("Hola. Contame qué se rompió.");
      const campo = page.getByPlaceholder("Ej.: mi notebook se apaga sola a los diez minutos…");
      await expect(campo).toBeVisible();
      const seguir = page.getByRole("button", { name: /Seguir/ });
      await expect(seguir).toBeDisabled();
      await revisarPantalla(page, libreta);
      await captura(page, info, "01-problema-vacia");

      await campo.click();
      await campo.pressSequentially(SINTOMA, { delay: 15 });
      await expect(seguir).toBeEnabled();
      await alAlcance(page, seguir, libreta, "Seguir");
      await seguir.click();

      await expect(dice(page)).toContainText(
        `Entendí: es una notebook y “${SINTOMA.toLowerCase()}”. ¿Es así?`,
      );
      await expect(page.getByRole("button", { name: "Notebook" })).toHaveAttribute("aria-pressed", "true");
      const si = page.getByRole("button", { name: /Sí, sigamos/ });
      await alAlcance(page, si, libreta, "Sí, sigamos");
      await revisarPantalla(page, libreta);
      await captura(page, info, "02-problema-entendido");
      await si.click();
      await expect(page).toHaveURL(/\/fotos$/);
    });

    // ---------- 2. Fotos ----------
    libreta.pantalla = "2 · Fotos";
    await test.step("2 · sube las fotos (la etiqueta sale movida y la saca de nuevo)", async () => {
      await expect(dice(page)).toContainText("Sacale una foto de frente, con la tapa abierta.");
      await expect(page.getByText("Foto 1 de 3")).toBeVisible();
      await revisarPantalla(page, libreta);
      await captura(page, info, "03-fotos-frente");

      await subirFoto(page, "frente");
      await expect(dice(page)).toContainText("Dejame ver si se entiende…");
      await expect(dice(page)).toContainText("Perfecta.");

      // Etiqueta: aviso de seguridad antes de darla vuelta.
      await expect(dice(page)).toContainText("Dala vuelta y sacale una foto a la etiqueta de abajo.");
      await expect(page.getByText("⚠ Apagala y desenchufala antes de darla vuelta.")).toBeVisible();
      await expect(page.getByText("Foto 2 de 3")).toBeVisible();
      await revisarPantalla(page, libreta);
      await captura(page, info, "04-fotos-etiqueta");

      await subirFoto(page, "etiqueta", 1);
      await expect(dice(page)).toContainText("La foto salió movida");
      await expect(dice(page)).toContainText("Sacala de nuevo.");
      await revisarPantalla(page, libreta);
      await captura(page, info, "05-fotos-etiqueta-rechazada");
      await subirFoto(page, "etiqueta", 2);
      await expect(dice(page)).toContainText("Perfecta.");

      await expect(dice(page)).toContainText("Ahora los costados, donde están los puertos.");
      await expect(page.getByText("Foto 3 de 3")).toBeVisible();
      await subirFoto(page, "puertos");

      await expect(dice(page)).toContainText("Listo, ya tengo lo que necesito. Vamos a leer la chapa.");
      // Las tres miniaturas quedan con su tilde.
      await expect(page.locator("ol li img")).toHaveCount(3);
      const leer = page.getByRole("button", { name: /Leer la chapa/ });
      await alAlcance(page, leer, libreta, "Leer la chapa");
      await revisarPantalla(page, libreta);
      await captura(page, info, "06-fotos-listas");
      await leer.click();
      await expect(page).toHaveURL(/\/ficha$/);
    });

    // ---------- 3. Ficha ----------
    libreta.pantalla = "3 · Ficha";
    await test.step("3 · revisa la ficha, completa el año y confirma", async () => {
      await expect(dice(page)).toContainText("Leyendo la chapa…");
      await expect(dice(page)).toContainText("Esto leí en la chapa.");
      await expect(page.getByRole("button", { name: "Editar Marca" })).toContainText("EJEMPLO");
      await expect(page.getByRole("button", { name: "Editar Modelo" })).toContainText("NB-15 (ficticio)");
      await expect(page.getByRole("button", { name: "Editar N.º de serie" })).toContainText("SN-0000-DEMO");
      await expect(page.locator("dt", { hasText: "Marca" })).toContainText("Confirmado");
      await expect(page.locator("dt", { hasText: "N.º de serie" })).toContainText("Probable");
      await expect(page.locator("dt", { hasText: "Año" })).toContainText("No se sabe");
      await revisarPantalla(page, libreta);
      await captura(page, info, "07-ficha");

      await page.getByRole("button", { name: "Completar Año" }).click();
      const anio = page.getByRole("textbox", { name: "Año" });
      await expect(anio).toBeFocused();
      await anio.fill("2021");
      await revisarPantalla(page, libreta);
      await captura(page, info, "08-ficha-editando");
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByRole("button", { name: "Editar Año" })).toContainText("2021");
      await expect(page.locator("dt", { hasText: "Año" })).toContainText("Confirmado");

      const es = page.getByRole("button", { name: /Sí, es este/ });
      await alAlcance(page, es, libreta, "Sí, es este");
      await es.click();
      await expect(page).toHaveURL(/\/preparando$/);
    });

    // ---------- 4. Preparando ----------
    libreta.pantalla = "4 · Preparando";
    await test.step("4 · espera mientras busca el manual y ubica las piezas", async () => {
      await expect(dice(page)).toContainText("Busco el manual oficial de tu EJEMPLO NB-15 (ficticio)");
      await revisarPantalla(page, libreta);
      await captura(page, info, "09-preparando-buscando");
      await expect(dice(page)).toContainText(
        "Listo. Tengo el manual de tu EJEMPLO NB-15 (ficticio) y las piezas ubicadas.",
      );
      await expect(page.getByText("Manual de mantenimiento (ficticio)").first()).toBeVisible();
      await expect(page.getByText("⚠ No abras ni perfores la batería.")).toBeVisible();
      const ver = page.getByRole("button", { name: /Ver al experto/ });
      await alAlcance(page, ver, libreta, "Ver al experto");
      await revisarPantalla(page, libreta);
      await captura(page, info, "10-preparando-listo");
      await ver.click();
      await expect(page).toHaveURL(/\/experto$/);
    });

    // ---------- 5. Experto 3D ----------
    libreta.pantalla = "5 · Experto";
    await test.step("5 · el experto arranca solo y el 3D dibuja algo", async () => {
      const lienzo = page.locator("canvas").first();
      await expect(lienzo).toBeVisible();

      // Arranca solo con el síntoma de la pantalla 1 (fixture: dos pasos del manual).
      await expect(page.getByText("Este es el ventilador. Es el que suena fuerte.")).toBeVisible();
      await expect(page.getByText("Aflojá los dos tornillos y levantalo despacio.")).toBeVisible();
      await expect(page.getByText("Paso 2 de 2")).toBeVisible();
      await expect(page.getByText("Manual p. 54 ✓")).toBeVisible();

      // Que el 3D no quede en negro: espera a que carguen las piezas y mide los píxeles.
      await page.waitForTimeout(5_000);
      for (const aviso of [
        "Este navegador no puede mostrar el 3D",
        "No pude mostrar el 3D en este equipo",
        "El 3D tuvo un problema",
      ]) {
        const visible = await page.getByText(aviso).isVisible();
        expect.soft(visible, `Aviso del visor: "${aviso}"`).toBe(false);
        if (visible) libreta.anotar("problema", `El visor muestra "${aviso}…" en vez del 3D`);
      }
      const medida = await medir3D(page, lienzo);
      info.annotations.push({ type: "medida-3d", description: JSON.stringify(medida) });
      const dibuja = !!medida && medida.fraccionNoNegra > 0.03 && medida.colores > 8;
      if (!dibuja) libreta.anotar("problema", `El 3D se ve negro o vacío (${JSON.stringify(medida)})`);
      expect.soft(dibuja, `El 3D dibuja algo: ${JSON.stringify(medida)}`).toBe(true);

      const dicho = await page.evaluate(() => (window as unknown as { __dicho: string[] }).__dicho);
      if (!dicho.some((t) => t.includes("Este es el ventilador")))
        libreta.anotar("problema", "El experto no dijo en voz alta el primer paso");

      await revisarPantalla(page, libreta);
      await captura(page, info, "11-experto");
    });

    // ---------- 6. Pregunta ----------
    libreta.pantalla = "6 · Pregunta";
    await test.step("6 · pregunta por texto y recibe respuesta", async () => {
      const campo = page.getByRole("textbox", { name: "Pregunta para el experto" });
      await expect(campo).toBeVisible();
      await expect(campo).toBeInViewport();
      await campo.click();
      await campo.pressSequentially(PREGUNTA, { delay: 15 });
      const preguntar = page.getByRole("button", { name: "Preguntar", exact: true });
      await expect(preguntar).toBeEnabled();
      await preguntar.click();
      await expect(campo).toHaveValue("");

      await expect(page.getByText("Batería: parte delantera. Te la marco en naranja.")).toBeVisible();
      // Mientras llega dice "El experto dice"; cuando terminó, "Paso 1 de 1".
      await expect(page.getByText(/^(El experto dice|Paso 1 de 1)$/)).toBeVisible();
      await expect(page.getByRole("button", { name: /Conversación/ })).toBeVisible();
      await page.waitForTimeout(1_500); // la cámara va a la pieza
      await revisarPantalla(page, libreta);
      await captura(page, info, "12-experto-respuesta");

      const medida = await medir3D(page, page.locator("canvas").first());
      info.annotations.push({ type: "medida-3d-respuesta", description: JSON.stringify(medida) });
      if (!medida || medida.fraccionNoNegra <= 0.03)
        libreta.anotar("problema", `Después de la respuesta el 3D se ve negro (${JSON.stringify(medida)})`);

      // La conversación queda guardada.
      await page.getByRole("button", { name: /Conversación/ }).click();
      const charla = page.getByRole("dialog", { name: "Conversación con el experto" });
      await expect(charla).toBeVisible();
      await expect(charla).toContainText(PREGUNTA);
      await expect(charla).toContainText("Batería: parte delantera.");
      await revisarPantalla(page, libreta);
      await captura(page, info, "13-conversacion");
    });
  } finally {
    await libreta.guardar();
  }

  // Lo anotado como problema hace fallar el test (después de recorrer todo).
  const problemas = libreta.hallazgos.filter((h) => h.tipo === "problema");
  expect.soft(problemas, "Problemas encontrados en el recorrido").toEqual([]);
});
