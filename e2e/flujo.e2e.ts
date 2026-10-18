import { expect, test, type Page } from "@playwright/test";
import {
  Libreta,
  alAlcance,
  altoDel3D,
  captura,
  escucharConsola,
  fotoDeEjemplo,
  girar3D,
  lienzo3D,
  medir3D,
  muestrearLadosEtiqueta,
  saltosRapidos,
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

async function subirFoto(page: Page, tipo: TipoFoto, intento = 1, boton = "Elegir de la galería") {
  // Como la persona: toca el botón de la galería y elige una foto.
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByText(boton, { exact: true }).click(),
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
      // La pantalla de carga (logo que se arma, ~2 s) tapa todo hasta que se desvanece.
      await expect(page.locator(".inicio")).toBeHidden();
      await expect(dice(page)).toContainText("Hola. Contame qué se rompió.");
      const campo = page.getByRole("textbox", { name: "Lo que se rompió" });
      await expect(campo).toBeVisible();
      await expect(page.getByRole("button", { name: "Contalo con tu voz" })).toBeVisible();
      // "Seguir" aparece recién cuando hay algo escrito.
      const seguir = page.getByRole("button", { name: /Seguir/ });
      await expect(seguir).toHaveCount(0);
      await revisarPantalla(page, libreta);
      await captura(page, info, "01-problema-vacia");

      await campo.click();
      await campo.pressSequentially(SINTOMA, { delay: 15, timeout: 90_000 });
      await expect(seguir).toBeVisible();
      await alAlcance(page, seguir, libreta, "Seguir");
      await seguir.click();

      await expect(dice(page)).toContainText(
        `Entendí: es tu notebook y “${SINTOMA.toLowerCase()}”. ¿Es así?`,
      );
      await expect(page.getByRole("button", { name: /^Notebook/ })).toHaveAttribute("aria-pressed", "true");
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
      // Notebook que se apaga sola: frente y etiqueta (los puertos solo se piden si el síntoma es de carga o conexión).
      await expect(dice(page)).toContainText("Sacá una foto de frente a tu notebook");
      await expect(page.getByText("Foto 1 de 2")).toBeVisible();
      await revisarPantalla(page, libreta);
      await captura(page, info, "03-fotos-frente");

      await subirFoto(page, "frente");
      await expect(dice(page)).toContainText("Dejame ver si se entiende…");
      await expect(dice(page)).toContainText("Perfecta.");

      // Etiqueta: aviso de seguridad antes de darla vuelta.
      await expect(dice(page)).toContainText("Dala vuelta y sacale una foto de cerca a la etiqueta de abajo.");
      await expect(page.getByText("Apagala y desenchufala antes de darla vuelta.")).toBeVisible();
      await expect(page.getByText("Foto 2 de 2")).toBeVisible();
      await revisarPantalla(page, libreta);
      await captura(page, info, "04-fotos-etiqueta");

      await subirFoto(page, "etiqueta", 1);
      await expect(dice(page)).toContainText("Esa foto no me sirve. Te explico abajo qué sacar.");
      await expect(page.getByText("Esta foto no sirve")).toBeVisible();
      await expect(page.getByText("La foto salió movida; no se lee el número de serie.")).toBeVisible();
      const reintentar = page.getByText("Reintentar esta foto");
      await expect(reintentar).toBeVisible();
      await alAlcance(page, reintentar, libreta, "Reintentar esta foto");
      await revisarPantalla(page, libreta);
      await captura(page, info, "05-fotos-etiqueta-rechazada");
      await subirFoto(page, "etiqueta", 2, "Elegir otra");
      await expect(dice(page)).toContainText("Perfecta.");

      await expect(dice(page)).toContainText("Listo, ya tengo lo que necesito. Vamos a leer la etiqueta.");
      // Las dos miniaturas quedan con su tilde.
      await expect(page.locator("ol li img")).toHaveCount(2);
      const leer = page.getByRole("button", { name: /Leer la etiqueta/ });
      await alAlcance(page, leer, libreta, "Leer la etiqueta");
      await revisarPantalla(page, libreta);
      await captura(page, info, "06-fotos-listas");
      await leer.click();
      await expect(page).toHaveURL(/\/ficha$/);
    });

    // ---------- 3. Ficha ----------
    libreta.pantalla = "3 · Ficha";
    await test.step("3 · revisa la ficha, completa el año y confirma", async () => {
      await expect(dice(page)).toContainText("Leyendo la etiqueta…");
      await expect(dice(page)).toContainText("Esto leí en la etiqueta.");
      await expect(page.getByRole("button", { name: "Editar Marca" })).toContainText("EJEMPLO");
      await expect(page.getByRole("button", { name: "Editar Modelo" })).toContainText("NB-15 (ficticio)");
      await expect(page.getByRole("button", { name: "Editar N.º de serie" })).toContainText("SN-0000-DEMO");
      // Lo que leyó la IA no queda confirmado hasta que la persona lo revisa.
      await expect(page.locator("dt", { hasText: "Marca" })).toContainText("Leído · revisalo");
      await expect(page.locator("dt", { hasText: "N.º de serie" })).toContainText("Probable");
      await expect(page.locator("dt", { hasText: "Año" })).toContainText("No se sabe");
      // Un solo botón confirma todo lo que está a la vista (#228); editar es solo si un dato está mal.
      const es = page.getByRole("button", { name: /Confirmar todo/ });
      await expect(es).toBeEnabled();
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

      await expect(es).toBeEnabled();
      await alAlcance(page, es, libreta, "Confirmar todo");
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
      await expect(page.getByText("No abras ni perfores la batería.")).toBeVisible();
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
      const lienzo = lienzo3D(page);
      await expect(lienzo).toBeVisible();

      // Arranca solo con el síntoma de la pantalla 1: el paso a paso sale del pack del caso (fixture).
      const primerPaso = "Apagá, desenchufá y quitá la tapa inferior.";
      await expect(page.locator("[aria-live=polite]").getByText(primerPaso).first()).toBeVisible();
      // La cantidad de pasos la decide la guía: solo se mira que sea "Paso 1 de N".
      await expect(page.getByText(/^Paso 1 de \d+$/)).toBeVisible();
      await expect(page.locator("[aria-live=polite]").getByText("Manual ✓ p. 52").first()).toBeVisible();
      await revisarPantalla(page, libreta);
      await captura(page, info, "11a-experto-paso-1");

      // La guía no avanza sola: la persona toca "Siguiente".
      const siguiente = page.getByRole("button", { name: "Paso siguiente" });
      await expect(siguiente).toBeEnabled();
      await siguiente.click();
      await expect(page.getByText(/^Paso 2 de \d+$/)).toBeVisible();
      await expect(page.locator("[aria-live=polite]").getByText(primerPaso)).toHaveCount(0);

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
      if (!dicho.some((t) => t.includes("Apagá, desenchufá")))
        libreta.anotar("problema", "El experto no dijo en voz alta el primer paso");

      await revisarPantalla(page, libreta);
      await captura(page, info, "11-experto");

      // A 390×844 (un celular común) el 3D ocupa al menos la mitad del alto.
      const tamOriginal = page.viewportSize()!;
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(800); // el visor y la guía se acomodan al tamaño nuevo
      const alto = await altoDel3D(page);
      info.annotations.push({ type: "alto-3d-390x844", description: JSON.stringify(alto) });
      await captura(page, info, "11b-experto-390x844");
      const ocupa = !!alto && alto.fraccion >= 0.5;
      if (!ocupa)
        libreta.anotar(
          "problema",
          `A 390×844 el 3D que se ve ocupa ${alto ? Math.round(alto.fraccion * 100) : 0}% del alto (${alto?.visible ?? 0} de 844 px; mínimo 50%)`,
        );
      expect.soft(ocupa, `A 390×844 el 3D ocupa al menos el 50% del alto: ${JSON.stringify(alto)}`).toBe(true);
      await page.setViewportSize(tamOriginal);
      await page.waitForTimeout(800);
    });

    // ---------- 5b. La etiqueta de la pieza no salta de lado ----------
    libreta.pantalla = "5 · Experto";
    await test.step("5b · la etiqueta de la pieza no cambia de lado más de una vez por segundo", async () => {
      const lienzo = lienzo3D(page);
      // 3 s mirando de qué lado está cada etiqueta mientras la persona gira el 3D con el dedo.
      const [muestra] = await Promise.all([muestrearLadosEtiqueta(page, 3000, 100), girar3D(page, lienzo, 2800)]);
      info.annotations.push({ type: "lados-etiqueta", description: JSON.stringify(muestra) });
      if (muestra.etiquetas.length === 0) libreta.anotar("problema", "No hay ninguna etiqueta de pieza a la vista para medir");
      expect.soft(muestra.etiquetas.length, "Hay al menos una etiqueta de pieza a la vista").toBeGreaterThan(0);
      const saltos = saltosRapidos(muestra.cambios);
      for (const s of saltos) libreta.anotar("problema", `La etiqueta salta de lado: ${s}`);
      expect.soft(saltos, "Ninguna etiqueta cambia de lado más de una vez por segundo").toEqual([]);
      await captura(page, info, "11c-experto-girado");
    });

    // ---------- 6. Pregunta ----------
    libreta.pantalla = "6 · Pregunta";
    // Después de girar, la guía puede haber quedado esperando: la pregunta nueva la reemplaza.
    await test.step("6 · pregunta por texto y recibe respuesta", async () => {
      const campo = page.getByRole("textbox", { name: "Pregunta para el experto" });
      await expect(campo).toBeVisible();
      await expect(campo).toBeInViewport();
      await campo.click();
      await campo.pressSequentially(PREGUNTA, { delay: 15, timeout: 90_000 });
      const preguntar = page.getByRole("button", { name: "Preguntar", exact: true });
      await expect(preguntar).toBeEnabled();
      await preguntar.click();
      await expect(campo).toHaveValue("");

      await expect(page.getByText("Batería: parte delantera. Te la marco en el 3D.")).toBeVisible();
      // Mientras llega dice "El experto dice"; cuando terminó, "Paso 1 de 1".
      await expect(page.getByText(/^(El experto dice|Paso 1 de 1)$/)).toBeVisible();
      await expect(page.getByRole("button", { name: /Conversación/ })).toBeVisible();
      await page.waitForTimeout(1_500); // la cámara va a la pieza
      await revisarPantalla(page, libreta);
      await captura(page, info, "12-experto-respuesta");

      const medida = await medir3D(page, lienzo3D(page));
      info.annotations.push({ type: "medida-3d-respuesta", description: JSON.stringify(medida) });
      if (!medida || medida.fraccionNoNegra <= 0.03)
        libreta.anotar("problema", `Después de la respuesta el 3D se ve negro (${JSON.stringify(medida)})`);

      // La conversación queda guardada.
      await page.getByRole("button", { name: /Conversación/ }).click();
      const charla = page.getByRole("dialog", { name: "Conversación con el experto" });
      await expect(charla).toBeVisible();
      await expect(charla).toContainText(PREGUNTA);
      await expect(charla).toContainText("Batería: parte delantera.");
      await captura(page, info, "13-conversacion");
      // Cerrarla (Cerrar y botón atrás) y que no quede congelada lo prueba pendientes.e2e.ts (#227).
    });
  } finally {
    await libreta.guardar();
  }

  // Lo anotado como problema hace fallar el test (después de recorrer todo).
  const problemas = libreta.hallazgos.filter((h) => h.tipo === "problema");
  expect.soft(problemas, "Problemas encontrados en el recorrido").toEqual([]);
});
