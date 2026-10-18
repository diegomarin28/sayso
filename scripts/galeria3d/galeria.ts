/**
 * Galería del 3D en tamaño iPhone: cada ejemplo del lab (una plantilla por tipo de equipo) cerrado y
 * despiezado, con avisos automáticos (vacío, chico, cortado) y lo que el visor avisa por consola.
 * Sin IA: usa /lab/visor de la app corriendo. Ver README.md.
 *
 *   NEXT_PUBLIC_DATOS=fixture npm run build && npx next start -p 3000      # en otra terminal
 *   npx tsx scripts/galeria3d/galeria.ts [--base http://localhost:3000] [--salida galeria3d] [--solo tv,celular]
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EJEMPLOS } from "../../components/viewer/ejemplos";
import { avisos, leerPng, medir, type Aviso } from "./analisis";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PUERTO = 9338;
const ESPERA_CARGA_MS = 9000;
const ESPERA_DESPIECE_MS = 4500;

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
  const ids = Object.keys(EJEMPLOS).filter((id) => !solo || solo.includes(id));
  mkdirSync(salida, { recursive: true });

  const chrome = spawn(
    CHROME,
    [
      "--headless=new", `--remote-debugging-port=${PUERTO}`, "--hide-scrollbars",
      "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
      `--user-data-dir=${mkdtempSync(join(tmpdir(), "galeria3d-"))}`, "about:blank",
    ],
    { stdio: "ignore" },
  );
  try {
    let destino: { webSocketDebuggerUrl: string } | undefined;
    for (let i = 0; i < 50 && !destino; i++) {
      await esperar(200);
      try {
        destino = ((await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json()) as Array<{ type: string; webSocketDebuggerUrl: string }>).find((t) => t.type === "page");
      } catch {}
    }
    if (!destino) throw new Error("no arrancó Chrome (¿está en CHROME?)");
    const ws = new WebSocket(destino.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let n = 0;
    const pendientes = new Map<number, (r: Record<string, unknown>) => void>();
    let consola: string[] = [];
    ws.onmessage = (m) => {
      const d = JSON.parse(String(m.data));
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
      new Promise<Record<string, unknown>>((r) => {
        pendientes.set(++n, r);
        ws.send(JSON.stringify({ id: n, method, params }));
      });
    const evaluar = async (expr: string) => ((await cmd("Runtime.evaluate", { expression: expr, returnByValue: true })).result as { value: unknown }).value;
    await cmd("Runtime.enable");
    await cmd("Page.enable");
    await cmd("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

    /**
     * Captura solo el lienzo del 3D, la guarda y la mide. Antes oculta los botones y chips que el visor
     * pone encima ("Vista isométrica", el origen de las ubicaciones): no son el equipo.
     */
    const capturar = async (archivo: string): Promise<Aviso[]> => {
      const r = (await evaluar(`(() => {
        const lienzo = document.querySelector("canvas");
        if (!lienzo) return null;
        const c = lienzo.getBoundingClientRect();
        for (const el of document.querySelectorAll("button, p")) {
          const e = el.getBoundingClientRect();
          if (getComputedStyle(el).position === "absolute" && e.top < c.bottom && e.bottom > c.top) el.style.visibility = "hidden";
        }
        return [c.x, c.y, c.width, c.height];
      })()`)) as number[] | null;
      if (!r) return ["vacio"];
      const [x, y, width, height] = r;
      const { data } = (await cmd("Page.captureScreenshot", { format: "png", clip: { x, y, width, height, scale: 1 } })) as { data: string };
      const png = Buffer.from(data, "base64");
      writeFileSync(join(salida, archivo), png);
      return avisos(medir(leerPng(png)));
    };

    const filas: Fila[] = [];
    for (const id of ids) {
      consola = [];
      await cmd("Page.navigate", { url: `${base}/lab/visor?plano=${encodeURIComponent(id)}` });
      // El lienzo arranca en 300 × 150 hasta que toma el tamaño del visor; recién ahí corre la espera.
      for (let i = 0; i < 60 && !(await evaluar(`(document.querySelector("canvas")?.getBoundingClientRect().height ?? 0) > 200`)); i++) await esperar(250);
      await esperar(ESPERA_CARGA_MS);
      const cerrado = await capturar(`${id}-cerrado.png`);
      await evaluar(`[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Despiezar")?.click()`);
      await esperar(ESPERA_DESPIECE_MS);
      const despiezado = await capturar(`${id}-despiezado.png`);
      filas.push({ id, cerrado, despiezado, consola: [...new Set(consola)] });
      const marca = (a: Aviso[]) => (a.length ? a.join(", ") : "ok");
      console.log(`${id.padEnd(16)} cerrado: ${marca(cerrado).padEnd(14)} despiezado: ${marca(despiezado).padEnd(14)} ${consola.length ? "consola: " + consola.length : ""}`);
    }
    ws.close();
    writeFileSync(join(salida, "index.html"), hoja(filas));
    const conAvisos = filas.filter((f) => f.cerrado.length || f.despiezado.length || f.consola.length);
    console.log(`\n${filas.length} equipos, ${conAvisos.length} con avisos. Hoja: ${join(salida, "index.html")}`);
  } finally {
    chrome.kill();
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
