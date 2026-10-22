import { expect, test, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { Libreta, captura, detalle3D, escucharConsola, lienzo3D, pantallaCongelada, prepararNavegador, revisarPantalla, sinRedNiIA } from "./ayudas";
import { llegarALaFicha, llegarAlExperto, preguntar } from "./recorrido";

/**
 * Tests de los issues de la prueba real (18/10) cuyo arreglo todavía no está en main.
 * Mientras tanto quedan PENDIENTES (test.fixme: se listan como "skipped/fixme", no fallan la corrida).
 *
 * Cuando se fusione el arreglo de un issue, agregá su número a ARREGLADOS y corré la matriz entera
 * (`npm run e2e`). Para probarlos antes, sin tocar el código:
 *   E2E_PENDIENTES=227,228,231 npm run e2e      (o E2E_PENDIENTES=todos)
 *
 * Todo con NEXT_PUBLIC_DATOS=fixture: sin IA ni internet (ver playwright.config.ts).
 * Los que llevan @webkit también corren en iPhone 13 y iPhone SE con WebKit táctil (Safari).
 */

/** Issues con el arreglo ya fusionado en main: sus tests se corren siempre. */
const ARREGLADOS = new Set<number>([227, 228, 231]);

const pedidos = (process.env.E2E_PENDIENTES ?? "").split(",").map((s) => s.trim());
function pendiente(issue: number) {
  const activo = ARREGLADOS.has(issue) || pedidos.includes("todos") || pedidos.includes(String(issue));
  test.fixme(!activo, `Pendiente hasta que se fusione el arreglo de #${issue} (activar: E2E_PENDIENTES=${issue})`);
}

/** Toque con el dedo (todos los proyectos emulan pantalla táctil). */
const tocar = (l: Locator) => l.tap({ timeout: 5000 });

async function preparar(page: Page, context: BrowserContext, info: TestInfo) {
  const libreta = new Libreta(info);
  await prepararNavegador(context);
  await sinRedNiIA(context, libreta);
  escucharConsola(page, libreta);
  return libreta;
}

/** Al final: lo anotado como problema (pedidos a /api o internet, errores de consola…) también falla. */
async function sinProblemas(libreta: Libreta) {
  await libreta.guardar();
  expect.soft(libreta.hallazgos.filter((h) => h.tipo === "problema"), "Problemas anotados").toEqual([]);
}

// ---------- #227: la conversación se cierra siempre y la pantalla no queda congelada ----------

test("#227 · «Conversación con el experto» se cierra con Cerrar y con atrás, y la pantalla no se congela @webkit", async ({
  page,
  context,
}, info) => {
  pendiente(227);
  const libreta = await preparar(page, context, info);
  await llegarAlExperto(page);
  libreta.pantalla = "5 · Experto";

  const charla = page.getByRole("dialog", { name: "Conversación con el experto" });
  const abrir = async () => {
    await tocar(page.getByRole("button", { name: /^Conversación/ }));
    await expect(charla).toBeVisible();
  };

  // "Siempre": varias veces seguidas con Cerrar…
  for (let vuelta = 1; vuelta <= 3; vuelta++) {
    await test.step(`Cerrar (vuelta ${vuelta})`, async () => {
      await abrir();
      if (vuelta === 1) {
        await revisarPantalla(page, libreta); // los botones del modal no están tapados
        await captura(page, info, "227-conversacion-abierta");
      }
      await tocar(charla.getByRole("button", { name: "Cerrar" }));
      await expect(charla).toBeHidden({ timeout: 3000 });
      expect(await pantallaCongelada(page), "La pantalla responde después de Cerrar").toEqual([]);
    });
  }

  // …y con el botón atrás del celular: cierra el modal y se queda en el experto.
  for (let vuelta = 1; vuelta <= 2; vuelta++) {
    await test.step(`Atrás (vuelta ${vuelta})`, async () => {
      await abrir();
      await page.goBack();
      await expect(charla).toBeHidden({ timeout: 3000 });
      await expect(page, "Atrás cierra el modal y no sale del experto").toHaveURL(/\/experto$/);
      expect(await pantallaCongelada(page), "La pantalla responde después de Atrás").toEqual([]);
    });
  }
  await captura(page, info, "227-despues-de-cerrar");
  await sinProblemas(libreta);
});

// ---------- #228: "Está bien, seguir" en la ficha ----------

test("#228 · la ficha tiene «Está bien, seguir» y con un toque pasa a Preparando", async ({ page, context }, info) => {
  pendiente(228);
  const libreta = await preparar(page, context, info);
  await llegarALaFicha(page);
  libreta.pantalla = "3 · Ficha";

  const todo = page.getByRole("button", { name: /Está bien, seguir/ });
  await expect(todo).toBeVisible();
  await captura(page, info, "228-ficha");
  await tocar(todo); // un solo toque
  await expect(page, "Con un toque en «Está bien, seguir» pasa a Preparando").toHaveURL(/\/preparando$/, { timeout: 5000 });
  await sinProblemas(libreta);
});

test("#228 · lo que la persona edita cuenta como confirmado: editar un dato y «Está bien, seguir» pasa", async ({
  page,
  context,
}, info) => {
  pendiente(228);
  const libreta = await preparar(page, context, info);
  await llegarALaFicha(page);
  libreta.pantalla = "3 · Ficha";

  await tocar(page.getByRole("button", { name: "Completar Año" }));
  await page.getByRole("textbox", { name: "Año" }).fill("2021");
  await tocar(page.getByRole("button", { name: "Guardar" }));
  await expect(page.getByRole("button", { name: "Editar Año" })).toContainText("2021");

  await tocar(page.getByRole("button", { name: /Está bien, seguir/ }));
  await expect(page).toHaveURL(/\/preparando$/, { timeout: 5000 });
  await sinProblemas(libreta);
});

// ---------- #231: una pieza grande resaltada no tapa las de adentro ----------

test("#231 · al resaltar una pieza grande (carcasa) se siguen viendo las piezas de adentro", async ({
  page,
  context,
}, info) => {
  pendiente(231);
  const libreta = await preparar(page, context, info);
  await llegarAlExperto(page);
  libreta.pantalla = "5 · Experto";
  const lienzo = lienzo3D(page);

  // Referencia: una pieza chica resaltada (el interior se ve con todo su detalle).
  await preguntar(page, "¿Dónde está el ventilador?");
  await expect(page.getByText(/^Ventilador: /)).toBeVisible();
  await page.waitForTimeout(2500); // la cámara llega a la pieza
  const chica = await detalle3D(page, lienzo);
  await captura(page, info, "231-pieza-chica");

  // Pieza grande: la carcasa inferior envuelve a todas las demás.
  await preguntar(page, "¿Dónde está la carcasa inferior?");
  await expect(page.getByText(/^Carcasa inferior: /)).toBeVisible();
  await page.waitForTimeout(2500);
  const grande = await detalle3D(page, lienzo);
  await captura(page, info, "231-pieza-grande");
  info.annotations.push({ type: "detalle-3d", description: JSON.stringify({ chica, grande }) });

  expect(chica, "Se pudo medir el 3D").not.toBeNull();
  expect(grande, "Se pudo medir el 3D").not.toBeNull();
  // Relleno opaco = un solo color tapa la imagen y desaparece el detalle de adentro.
  expect.soft(grande!.cian, `Con la carcasa resaltada, el cian no llena el 3D: ${JSON.stringify(grande)}`).toBeLessThan(0.35);
  expect.soft(grande!.dominante, `Con la carcasa resaltada, un solo color no tapa el 3D: ${JSON.stringify(grande)}`).toBeLessThan(0.5);
  expect
    .soft(grande!.bordes, `Con la carcasa resaltada se ven las piezas de adentro (detalle ≥ 50 % del de una pieza chica): chica ${JSON.stringify(chica)} · grande ${JSON.stringify(grande)}`)
    .toBeGreaterThanOrEqual(chica!.bordes * 0.5);
  await sinProblemas(libreta);
});

// ---------- #231: ningún texto de paso termina cortado en "…" / "...." ----------

/**
 * El texto del paso en la tarjeta no se lee cortado:
 * - no termina en "...."/"…" y el navegador no le agrega "…" (line-clamp o text-overflow: ellipsis),
 * - si no entra (el texto largo se recorta y se desvanece), hay "ver más" y al tocarlo se lee entero.
 */
async function textoDelPasoCortado(page: Page): Promise<string | null> {
  const tarjeta = page.locator("[aria-live=polite]").filter({ has: page.locator("p.font-medium") }).first();
  const p = tarjeta.locator("p.font-medium").first();
  await expect(p).toBeVisible();
  // Las palabras aparecen subiendo (transform): mientras se animan el texto mide de más. Se espera a que terminen.
  const quieto = () =>
    p.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => null))));
  /** Oculto de verdad: el texto se pasa de la caja (con margen) y la caja lo recorta. */
  const oculto = () =>
    p.evaluate((el) => {
      const s = getComputedStyle(el);
      return el.scrollHeight > el.clientHeight + 4 && s.overflowY !== "visible";
    });
  await quieto();
  const r = await p.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      texto: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
      recortado: el.scrollHeight > el.clientHeight + 4 && s.overflowY !== "visible",
      // El navegador dibuja "…" solo con estas dos propiedades.
      puntosDelNavegador: s.textOverflow === "ellipsis" || (s.webkitLineClamp !== "none" && s.webkitLineClamp !== ""),
    };
  });
  if (/(\.{3,}|…)$/.test(r.texto)) return `termina en puntos suspensivos: «${r.texto.slice(-60)}»`;
  if (!r.recortado) return null;
  if (r.puntosDelNavegador) return `se corta con «…» del navegador: «${r.texto.slice(0, 80)}»`;
  const verMas = tarjeta.getByRole("button", { name: "ver más" });
  // La app decide "ver más" al medir el texto: se le da un momento.
  const hayVerMas = await verMas.waitFor({ state: "visible", timeout: 2000 }).then(() => true, () => false);
  if (!hayVerMas) return `no entra en la tarjeta y no hay «ver más»: «${r.texto.slice(0, 80)}»`;
  await tocar(verMas);
  await quieto();
  const entero = !(await oculto());
  await tocar(tarjeta.getByRole("button", { name: "ver menos" }));
  return entero ? null : `con «ver más» sigue sin leerse entero: «${r.texto.slice(0, 80)}»`;
}

test("#231 · ningún texto de paso termina en «....» ni queda cortado @webkit", async ({ page, context }, info) => {
  pendiente(231);
  const libreta = await preparar(page, context, info);
  await llegarAlExperto(page);
  libreta.pantalla = "5 · Experto";

  const total = Number((await page.getByText(/^Paso 1 de \d+$/).textContent())!.match(/de (\d+)/)![1]);
  const cortados: string[] = [];
  for (let n = 1; n <= total; n++) {
    await expect(page.getByText(new RegExp(`^Paso ${n} de ${total}$`))).toBeVisible();
    const corte = await textoDelPasoCortado(page);
    if (corte) {
      cortados.push(`Paso ${n}: ${corte}`);
      await captura(page, info, `231-paso-${n}-cortado`);
    }
    if (n < total) await tocar(page.getByRole("button", { name: "Paso siguiente" }));
  }
  // También una respuesta a una pregunta.
  await preguntar(page, "¿Dónde está la batería?");
  await expect(page.getByText(/^Batería: /)).toBeVisible();
  const corte = await textoDelPasoCortado(page);
  if (corte) cortados.push(`Respuesta: ${corte}`);

  expect(cortados, "Ningún texto de paso queda cortado").toEqual([]);
  await sinProblemas(libreta);
});
