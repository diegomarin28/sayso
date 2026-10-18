/**
 * Galería del 3D en tamaño iPhone: cada ejemplo del lab (una plantilla por tipo de equipo) cerrado y
 * despiezado, con avisos automáticos (vacío, chico, cortado) y lo que el visor avisa por consola.
 * Sin IA: usa /lab/visor de la app corriendo. Ver README.md.
 *
 *   NEXT_PUBLIC_DATOS=fixture npm run build && npx next start -p 3000      # en otra terminal
 *   npx tsx scripts/galeria3d/galeria.ts [--base http://localhost:3000] [--salida galeria3d] [--solo tv,celular]
 *       [--casos mis-casos.json] [--campus] [--sin-ejemplos]
 *
 * `--casos`: los planos de la caché que arma `scripts/bateria/correr.ts --mis-casos` (sin IA); `--campus`: los
 * objetos de /lab/galeria. Esos se abren en /lab/visor?plano=guardado (ver CLAVE_PLANO_GUARDADO).
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EJEMPLOS } from "../../components/viewer/ejemplos";
import { GALERIA_CAMPUS } from "../../components/viewer/galeria/campus";
import { CLAVE_PLANO_GUARDADO } from "../../components/viewer/lab-guardado";
import { avisos, leerPng, medir, type Aviso } from "./analisis";
import { equiposDeCasos, type Equipo } from "./equipos";
import { navegadorDeLaGaleria } from "./navegador";

/**
 * Cuánto se espera a que el visor tenga las piezas reales, como mucho (antes eran 9 s fijos por equipo). Se
 * corta antes, apenas están (`esperarPiezas`); el visor mismo pasa a primitivas a los 4 s (`ESPERA_MAXIMA_MS`).
 */
const TOPE_CARGA_MS = 4000;
/** Cada cuánto se mira si el lienzo dejó de cambiar. */
const PASO_CARGA_MS = 250;
const ESPERA_DESPIECE_MS = 4500;
/** Un comando al navegador que no responde en este tiempo corta la corrida (antes quedaba colgada con Chrome abierto). */
const PLAZO_COMANDO_MS = 60_000;

type Fila = { id: string; cerrado: Aviso[]; despiezado: Aviso[]; consola: string[] };


function opcion(nombre: string, porDefecto?: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : porDefecto;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const base = opcion("base", "http://localhost:3000")!;
  const salida = opcion("salida", "galeria3d")!;
  const solo = opcion("solo")?.split(",");
  const casos = opcion("casos");
  const equipos: Equipo[] = [
    ...(process.argv.includes("--sin-ejemplos") ? [] : Object.keys(EJEMPLOS).map((id) => ({ id }))),
    ...(casos ? equiposDeCasos(JSON.parse(readFileSync(casos, "utf8"))) : []),
    ...(process.argv.includes("--campus") ? GALERIA_CAMPUS.map((e) => ({ id: `campus-${e.id}`, plano: e.plano, tipoEquipo: e.tipoEquipo })) : []),
  ].filter((e) => !solo || solo.includes(e.id));
  mkdirSync(salida, { recursive: true });

  // El perfil de Chrome se borra al terminar (también si se corta la corrida): cada corrida dejaba uno y llenaron el disco.
  const navegador = navegadorDeLaGaleria();
  const perfil = mkdtempSync(join(tmpdir(), "galeria3d-"));
  const chrome = spawn(
    navegador,
    [
      // Puerto libre que elige el navegador (lo escribe en su perfil): con uno fijo, dos sesiones con la galería a
      // la vez se conectaban al navegador de la otra y capturaban su equipo (#304).
      "--headless=new", "--remote-debugging-port=0", "--hide-scrollbars",
      "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
      `--user-data-dir=${perfil}`, "about:blank",
    ],
    { stdio: "ignore" },
  );
  const cortar = () => {
    chrome.kill();
    rmSync(perfil, { recursive: true, force: true });
    process.exit(130);
  };
  process.once("SIGINT", cortar);
  process.once("SIGTERM", cortar);
  try {
    let destino: { webSocketDebuggerUrl: string } | undefined;
    for (let i = 0; i < 50 && !destino; i++) {
      await esperar(200);
      try {
        const puerto = readFileSync(join(perfil, "DevToolsActivePort"), "utf8").split("\n")[0];
        destino = ((await (await fetch(`http://127.0.0.1:${puerto}/json`)).json()) as Array<{ type: string; webSocketDebuggerUrl: string }>).find((t) => t.type === "page");
      } catch {}
    }
    if (!destino) throw new Error(`no arrancó el navegador (${navegador})`);
    const ws = new WebSocket(destino.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let n = 0;
    const pendientes = new Map<number, (r: Record<string, unknown>) => void>();
    let consola: string[] = [];
    // Lo que el visor está bajando de la biblioteca (el índice y los GLB; true = GLB): `esperarPiezas` espera a que
    // haya bajado algún GLB y no quede nada en camino (entre el índice y los GLB, la lista queda vacía un instante).
    const bajando = new Map<string, boolean>();
    let glbBajado = false;
    ws.onmessage = (m) => {
      const d = JSON.parse(String(m.data));
      const pieza = d.method === "Network.requestWillBeSent" && /\/models\/piezas\/.*\.(glb|json)(\?|$)/.exec(d.params.request.url);
      if (pieza) bajando.set(d.params.requestId, pieza[1] === "glb");
      if ((d.method === "Network.loadingFinished" || d.method === "Network.loadingFailed") && bajando.has(d.params.requestId)) {
        if (bajando.get(d.params.requestId) && d.method === "Network.loadingFinished") glbBajado = true;
        bajando.delete(d.params.requestId);
      }
      if (d.id && pendientes.has(d.id)) {
        pendientes.get(d.id)!(d.result ?? {});
        pendientes.delete(d.id);
      }
      if (d.method === "Runtime.consoleAPICalled") {
        const texto = d.params.args.map((a: { value?: unknown; description?: string }) => a.value ?? a.description).join(" ");
        if (/\[visor\]|formas simples|no existe|error/i.test(texto)) consola.push(texto);
      }
      if (d.method === "Runtime.exceptionThrown") consola.push("excepción: " + d.params.exceptionDetails.exception?.description);
    };
    const cmd = (method: string, params = {}) =>
      new Promise<Record<string, unknown>>((r, rechazar) => {
        const id = ++n;
        const plazo = setTimeout(() => rechazar(new Error(`el navegador no respondió ${method} en ${PLAZO_COMANDO_MS / 1000} s`)), PLAZO_COMANDO_MS);
        pendientes.set(id, (x) => (clearTimeout(plazo), r(x)));
        ws.send(JSON.stringify({ id, method, params }));
      });
    const evaluar = async (expr: string) => ((await cmd("Runtime.evaluate", { expression: expr, returnByValue: true })).result as { value: unknown }).value;
    await cmd("Runtime.enable");
    await cmd("Page.enable");
    await cmd("Network.enable");
    await cmd("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

    /**
     * El rectángulo del lienzo del 3D, con lo que el visor pone encima oculto ("Vista isométrica", el origen de
     * las ubicaciones, las etiquetas, el medidor de fps del lab): no es el equipo.
     */
    const lienzo = async () =>
      (await evaluar(`(() => {
        const lienzo = document.querySelector("canvas");
        if (!lienzo) return null;
        const c = lienzo.getBoundingClientRect();
        for (const el of document.querySelectorAll("body *")) {
          if (el.contains(lienzo) || !["absolute", "fixed"].includes(getComputedStyle(el).position)) continue;
          const e = el.getBoundingClientRect();
          if (e.top < c.bottom && e.bottom > c.top && e.left < c.right && e.right > c.left) el.style.visibility = "hidden";
        }
        return [c.x, c.y, c.width, c.height];
      })()`)) as number[] | null;

    /** Captura solo el lienzo del 3D, la guarda y la mide. */
    const capturar = async (archivo: string): Promise<Aviso[]> => {
      const r = await lienzo();
      if (!r) return ["vacio"];
      const [x, y, width, height] = r;
      const { data } = (await cmd("Page.captureScreenshot", { format: "png", clip: { x, y, width, height, scale: 1 } })) as { data: string };
      const png = Buffer.from(data, "base64");
      writeFileSync(join(salida, archivo), png);
      return avisos(medir(leerPng(png)));
    };

    /**
     * Espera a que el visor tenga las piezas reales, mirándolo desde afuera (sin tocar el visor): bajó lo que pidió
     * de la biblioteca (algún GLB y nada en camino) y el lienzo dejó de cambiar (la escena armada, la cámara quieta). Con tope
     * `TOPE_CARGA_MS`. Devuelve en cuánto quedó lista, o "tope".
     */
    const esperarPiezas = async (desde: number): Promise<string> => {
      let antes = "";
      while (Date.now() - desde < TOPE_CARGA_MS) {
        await esperar(PASO_CARGA_MS);
        if (!glbBajado || bajando.size) continue;
        const r = await lienzo();
        if (!r) continue;
        const { data } = (await cmd("Page.captureScreenshot", { format: "png", clip: { x: r[0], y: r[1], width: r[2], height: r[3], scale: 0.25 } })) as { data: string };
        if (Date.now() - desde >= TOPE_CARGA_MS) break;
        if (data === antes) return `${((Date.now() - desde) / 1000).toFixed(1)} s`;
        antes = data;
      }
      return "tope";
    };

    const filas: Fila[] = [];
    await cmd("Page.navigate", { url: `${base}/lab/visor` }); // el localStorage es por origen
    await esperar(1500);
    for (const { id, plano, tipoEquipo } of equipos) {
      consola = [];
      glbBajado = false;
      bajando.clear();
      if (plano) await evaluar(`localStorage.setItem(${JSON.stringify(CLAVE_PLANO_GUARDADO)}, ${JSON.stringify(JSON.stringify({ plano, tipoEquipo }))})`);
      // Sin caché: cada equipo baja lo suyo, como la primera vez (si no, el índice ya estaría y no se esperaría nada).
      await cmd("Network.clearBrowserCache");
      await cmd("Page.navigate", { url: `${base}/lab/visor?plano=${plano ? "guardado" : encodeURIComponent(id)}` });
      // El lienzo arranca en 300 × 150 hasta que toma el tamaño del visor; recién ahí corre la espera.
      for (let i = 0; i < 60 && !(await evaluar(`(document.querySelector("canvas")?.getBoundingClientRect().height ?? 0) > 200`)); i++) await esperar(250);
      const listo = await esperarPiezas(Date.now());
      const cerrado = await capturar(`${id}-cerrado.png`);
      await evaluar(`[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Despiezar")?.click()`);
      await esperar(ESPERA_DESPIECE_MS);
      const despiezado = await capturar(`${id}-despiezado.png`);
      filas.push({ id, cerrado, despiezado, consola: [...new Set(consola)] });
      const marca = (a: Aviso[]) => (a.length ? a.join(", ") : "ok");
      console.log(`${id.padEnd(16)} listo: ${listo.padEnd(6)} cerrado: ${marca(cerrado).padEnd(14)} despiezado: ${marca(despiezado).padEnd(14)} ${consola.length ? "consola: " + consola.length : ""}`);
    }
    ws.close();
    writeFileSync(join(salida, "index.html"), hoja(filas));
    const conAvisos = filas.filter((f) => f.cerrado.length || f.despiezado.length || f.consola.length);
    console.log(`\n${filas.length} equipos, ${conAvisos.length} con avisos. Hoja: ${join(salida, "index.html")}`);
  } finally {
    process.off("SIGINT", cortar);
    process.off("SIGTERM", cortar);
    chrome.kill();
    await esperar(500);
    rmSync(perfil, { recursive: true, force: true });
  }
}

function hoja(filas: Fila[]): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const chip = (a: Aviso[]) => (a.length ? a.map((x) => `<span class="aviso">${x}</span>`).join(" ") : `<span class="ok">ok</span>`);
  const tarjetas = filas
    .map(
      (f) => `<section><h2>${esc(f.id)}</h2><div class="par">
  <figure><img src="${esc(f.id)}-cerrado.png" alt="${esc(f.id)} cerrado"><figcaption>cerrado ${chip(f.cerrado)}</figcaption></figure>
  <figure><img src="${esc(f.id)}-despiezado.png" alt="${esc(f.id)} despiezado"><figcaption>despiezado ${chip(f.despiezado)}</figcaption></figure>
</div>${f.consola.length ? `<pre>${esc(f.consola.join("\n"))}</pre>` : ""}</section>`,
    )
    .join("\n");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Galería 3D</title>
<style>body{margin:0;padding:16px;background:#14171b;color:#e8eaed;font:14px system-ui,sans-serif}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
section{background:#1f2328;border-radius:12px;padding:12px}h2{margin:0 0 8px;font-size:15px}.par{display:grid;grid-template-columns:1fr 1fr;gap:8px}
figure{margin:0}img{width:100%;border-radius:8px;display:block}figcaption{margin-top:4px;font-size:12px;color:#a7acb5}
.aviso{background:#5a1d1d;color:#ffb4b4;border-radius:6px;padding:1px 6px}.ok{color:#3ddc97}pre{white-space:pre-wrap;font-size:11px;color:#f5c542;margin:8px 0 0}</style></head>
<body><h1>Galería 3D (390 × 844)</h1><main>
${tarjetas}
</main></body></html>`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
