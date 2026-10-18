import { deflateSync } from "node:zlib";
import type { BrowserContext, Locator, Page, TestInfo } from "@playwright/test";

// ---------- Imágenes de ejemplo (se generan al vuelo: no hay binarios en el repo) ----------

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloque(tipo: string, datos: Buffer) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

type Pintor = (x: number, y: number, ancho: number, alto: number) => [number, number, number];

function png(ancho: number, alto: number, pintar: Pintor): Buffer {
  const filas = Buffer.alloc((ancho * 3 + 1) * alto);
  for (let y = 0; y < alto; y++) {
    const o = y * (ancho * 3 + 1);
    filas[o] = 0; // sin filtro
    for (let x = 0; x < ancho; x++) {
      const [r, g, b] = pintar(x, y, ancho, alto);
      filas[o + 1 + x * 3] = r;
      filas[o + 2 + x * 3] = g;
      filas[o + 3 + x * 3] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // bits
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque("IHDR", ihdr),
    bloque("IDAT", deflateSync(filas)),
    bloque("IEND", Buffer.alloc(0)),
  ]);
}

/** Notebook abierta vista de frente: mesa, base gris, pantalla oscura con brillo. */
const frente: Pintor = (x, y, w, h) => {
  const enPantalla = x > w * 0.2 && x < w * 0.8 && y > h * 0.1 && y < h * 0.55;
  const enBase = x > w * 0.12 && x < w * 0.88 && y > h * 0.55 && y < h * 0.75;
  const teclas = enBase && Math.floor(x / 14) % 2 === 0 && Math.floor(y / 10) % 2 === 0;
  if (enPantalla) return [20 + (x % 40), 30, 60 + (y % 50)];
  if (teclas) return [40, 40, 44];
  if (enBase) return [150, 152, 158];
  return [190 - (y >> 3), 160 - (y >> 4), 120]; // mesa de madera
};

/** Etiqueta de abajo: rectángulo blanco con renglones negros (simula letras) y un código de barras. */
const etiqueta: Pintor = (x, y, w, h) => {
  const enEtiqueta = x > w * 0.15 && x < w * 0.85 && y > h * 0.2 && y < h * 0.8;
  if (!enEtiqueta) return [35, 35, 38]; // plástico de la base
  const renglon = Math.floor((y - h * 0.25) / 22);
  const enTexto = renglon >= 0 && renglon < 5 && (y - h * 0.25) % 22 < 10 && Math.floor(x / 9) % 3 !== 0;
  const enBarras = y > h * 0.62 && y < h * 0.75 && x > w * 0.25 && x < w * 0.75 && (x * 7) % 11 < 5;
  return enTexto || enBarras ? [10, 10, 10] : [245, 245, 240];
};

/** Costado con puertos: franja gris con huecos oscuros. */
const puertos: Pintor = (x, y, w, h) => {
  const enCostado = y > h * 0.4 && y < h * 0.6;
  const enPuerto = enCostado && y > h * 0.46 && y < h * 0.54 && Math.floor(x / 60) % 2 === 1;
  if (enPuerto) return [15, 15, 18];
  if (enCostado) return [160, 162, 168];
  return [200, 190, 175];
};

const PINTORES = { frente, etiqueta, puertos };
export type TipoFoto = keyof typeof PINTORES;

export function fotoDeEjemplo(tipo: TipoFoto, intento = 1) {
  return {
    name: `${tipo}-${intento}.png`,
    mimeType: "image/png",
    buffer: png(800, 600, PINTORES[tipo]),
  };
}

// ---------- Lo que se anota en cada test ----------

export type Hallazgo = { pantalla: string; tipo: "problema" | "observación"; texto: string };

export class Libreta {
  readonly hallazgos: Hallazgo[] = [];
  pantalla = "inicio";
  private vistos = new Set<string>();

  constructor(private info: TestInfo) {}

  anotar(tipo: Hallazgo["tipo"], texto: string) {
    const clave = `${tipo}|${this.pantalla}|${texto}`;
    if (this.vistos.has(clave)) return;
    this.vistos.add(clave);
    this.hallazgos.push({ pantalla: this.pantalla, tipo, texto });
    this.info.annotations.push({ type: tipo, description: `[${this.pantalla}] ${texto}` });
  }

  async guardar() {
    await this.info.attach("hallazgos.json", {
      body: JSON.stringify(this.hallazgos, null, 2),
      contentType: "application/json",
    });
  }
}

// ---------- Sin IA, sin internet ----------

/**
 * Corta todo lo que no sea el servidor local y cualquier /api/* (en modo fixture las pantallas
 * no deberían llamar a ninguna). Lo cortado queda anotado como problema.
 */
export async function sinRedNiIA(context: BrowserContext, libreta: Libreta) {
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!local) {
      libreta.anotar("problema", `Pedido a internet en modo fixture (cortado): ${url.origin}${url.pathname}`);
      return route.abort("blockedbyclient");
    }
    if (url.pathname.startsWith("/api/")) {
      libreta.anotar("problema", `Pedido a ${url.pathname} en modo fixture (cortado: gastaría IA/servicios)`);
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
}

/**
 * Voz del navegador simulada: en Chromium sin pantalla `speechSynthesis` puede no terminar nunca
 * y la guía espera a que cada frase se diga. Lo que "se dijo" queda en `window.__dicho`.
 * También oculta el botón flotante de `next dev` (no existe en producción y tapa la pantalla).
 */
export async function prepararNavegador(context: BrowserContext) {
  await context.addInitScript(() => {
    const dicho: string[] = [];
    (window as unknown as { __dicho: string[] }).__dicho = dicho;
    const falsa = {
      speaking: false,
      pending: false,
      paused: false,
      onvoiceschanged: null,
      getVoices: () => [],
      speak(u: SpeechSynthesisUtterance) {
        if (u.text) dicho.push(u.text);
        // Una voz rápida: termina enseguida.
        setTimeout(() => u.onend?.call(u, new Event("end") as SpeechSynthesisEvent), 30);
      },
      cancel() {},
      pause() {},
      resume() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => true,
    };
    Object.defineProperty(window, "speechSynthesis", { value: falsa, configurable: true });

    const estilo = () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(s);
    };
    if (document.head) estilo();
    else document.addEventListener("DOMContentLoaded", estilo);
  });
}

/** Errores de la consola y excepciones sin atrapar: cada uno es un problema. */
export function escucharConsola(page: Page, libreta: Libreta) {
  page.on("pageerror", (e) => libreta.anotar("problema", `Excepción sin atrapar: ${e.message.slice(0, 200)}`));
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error") {
      // Los pedidos que cortamos a propósito ya están anotados.
      if (/ERR_BLOCKED_BY_CLIENT|net::ERR_FAILED/.test(t)) return;
      libreta.anotar("problema", `Error en consola: ${t.slice(0, 200)}`);
    } else if (m.type() === "warning" && /^\[(visor|guia|api|voz)\]/.test(t)) {
      libreta.anotar("observación", `Aviso en consola: ${t.slice(0, 200)}`);
    }
  });
}

// ---------- Cómo se ve ----------

/**
 * Revisa la pantalla como la vería alguien en el celular:
 * - nada se sale de costado ni hay scroll horizontal (problema; en filas deslizables, observación),
 * - el cartel "Girá el celular" no aparece en vertical (problema),
 * - ningún botón queda tapado por la barra de abajo, otro elemento o el borde (problema),
 * - botones con área de toque menor a 44×44 px (observación: guía de Apple/Google),
 * - texto cortado dentro de su caja (observación).
 */
export async function revisarPantalla(page: Page, libreta: Libreta) {
  // El ancho del celular, no `innerWidth`: en celular, si algo es más ancho que la pantalla, el
  // navegador agranda la página entera (innerWidth crece) y el desborde no se vería.
  const anchoCelular = page.viewportSize()?.width ?? 0;
  const r = await page.evaluate((anchoCelular) => {
    const vw = anchoCelular || window.innerWidth;
    const nombreDe = (el: Element) =>
      (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.tagName)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 50);
    const visible = (el: Element) => {
      const s = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05 && b.width > 2 && b.height > 2;
    };
    /** Dentro de una fila que se desliza de costado: salirse del borde es a propósito. */
    const enCarrusel = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if ((o === "auto" || o === "scroll") && p.scrollWidth > p.clientWidth) return true;
      }
      return false;
    };
    const fuera: string[] = [];
    const deslizar: string[] = [];
    const chicos: string[] = [];
    const cortados: string[] = [];
    const medidor = document.createElement("canvas").getContext("2d")!;
    for (const el of document.querySelectorAll("button, a, input, textarea, [role=button]")) {
      if (!visible(el) || el.closest("[aria-hidden=true]")) continue;
      const b = el.getBoundingClientRect();
      if (b.left < -1 || b.right > vw + 1) {
        const dato = `${nombreDe(el)} (x ${Math.round(b.left)}→${Math.round(b.right)} de ${vw})`;
        (enCarrusel(el) ? deslizar : fuera).push(dato);
      }
      // Placeholder que no entra en su caja (se lee cortado).
      if (el instanceof HTMLInputElement && el.placeholder && !el.value) {
        const s = getComputedStyle(el);
        medidor.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
        const libre = el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
        if (medidor.measureText(el.placeholder).width > libre + 1)
          cortados.push(`${el.placeholder} (placeholder, ${Math.round(libre)}px de ancho)`);
      }
      if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA" && (b.height < 44 || b.width < 44))
        chicos.push(`${nombreDe(el)} (${Math.round(b.width)}×${Math.round(b.height)})`);
    }
    for (const el of document.querySelectorAll("p, span, button, dt, dd, li, h1, h2")) {
      if (!visible(el) || el.children.length > 3) continue;
      const s = getComputedStyle(el);
      const corta = s.overflow === "hidden" || s.textOverflow === "ellipsis" || s.overflowX === "hidden";
      if (corta && el.scrollWidth > el.clientWidth + 2 && (el.textContent ?? "").trim().length > 3)
        cortados.push(nombreDe(el));
    }
    const girar = document.querySelector(".solo-vertical");
    return {
      vw,
      desborde: Math.max(document.documentElement.scrollWidth, window.innerWidth) - vw,
      fuera,
      deslizar,
      chicos,
      cortados,
      cartelGirar: !!girar && getComputedStyle(girar).display !== "none",
    };
  }, anchoCelular);
  if (r.desborde > 1) libreta.anotar("problema", `Scroll horizontal: la página mide ${r.desborde}px más que la pantalla (${r.vw}px)`);
  for (const f of r.fuera) libreta.anotar("problema", `Se sale de la pantalla: ${f}`);
  for (const f of r.deslizar) libreta.anotar("observación", `Hay que deslizar de costado para verlo: ${f}`);
  if (r.cartelGirar) libreta.anotar("problema", `Aparece "Girá el celular a vertical" estando en vertical`);
  for (const t of await botonesTapados(page)) libreta.anotar("problema", `Botón tapado: ${t}`);
  for (const c of r.chicos) libreta.anotar("observación", `Área de toque menor a 44×44 px: ${c}`);
  for (const c of r.cortados) libreta.anotar("observación", `Texto cortado: "${c}"`);
}

/** El botón principal se ve sin hacer scroll (pensado para el pulgar). */
export async function alAlcance(page: Page, boton: Locator, libreta: Libreta, nombre: string) {
  const b = await boton.boundingBox();
  const alto = page.viewportSize()?.height ?? 0;
  if (b && b.y + b.height > alto + 1)
    libreta.anotar("observación", `"${nombre}" queda debajo del borde: hay que hacer scroll para verlo (${Math.round(b.y + b.height)}px de ${alto}px)`);
}

export async function captura(page: Page, info: TestInfo, nombre: string) {
  const ruta = info.outputPath(`${nombre}.png`);
  await page.screenshot({ path: ruta, fullPage: true, animations: "disabled" });
  await info.attach(nombre, { path: ruta, contentType: "image/png" });
}

// ---------- El 3D dibuja algo ----------

/**
 * Saca una foto del centro del lienzo 3D (sin la tarjeta del paso de arriba ni los botones de
 * abajo a la izquierda) y mide qué parte de los píxeles no es negra y cuántos colores distintos
 * hay. Lo hace el propio navegador (Image + canvas 2D), así no hace falta una librería de PNG.
 */
export async function medir3D(page: Page, lienzo: Locator) {
  const caja = await lienzo.boundingBox();
  if (!caja) return null;
  const clip = {
    x: caja.x + caja.width * 0.15,
    y: caja.y + caja.height * 0.4,
    width: caja.width * 0.7,
    height: caja.height * 0.42,
  };
  const foto = await page.screenshot({ clip, animations: "disabled" });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let claros = 0;
    let total = 0;
    const colores = new Set<number>();
    for (let i = 0; i < d.length; i += 4 * 3) {
      total++;
      const luz = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      if (luz > 24) claros++;
      colores.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4));
    }
    return { fraccionNoNegra: claros / total, colores: colores.size };
  }, foto.toString("base64"));
}

// ---------- Botones tapados ----------

/**
 * Ningún botón queda tapado por la barra de abajo, otro elemento o el borde de la pantalla.
 * A cada botón visible lo lleva a la vista (como haría la persona al scrollear) y mira qué hay
 * arriba en 5 puntos del botón: si es otra cosa, está tapado. Al terminar deja el scroll como estaba.
 * Devuelve la lista de tapados: cada uno es un problema.
 */
export async function botonesTapados(page: Page): Promise<string[]> {
  const ancho = page.viewportSize()?.width ?? 0;
  const alto = page.viewportSize()?.height ?? 0;
  return page.evaluate(
    ({ ancho, alto }) => {
      const vw = ancho || window.innerWidth;
      const vh = alto || window.innerHeight;
      const nombreDe = (el: Element) =>
        (el.getAttribute("aria-label") || el.textContent || el.tagName).replace(/\s+/g, " ").trim().slice(0, 50);
      const describir = (el: Element) => {
        const t = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30);
        return `${el.tagName.toLowerCase()}${t ? ` "${t}"` : ""}`;
      };
      // Para dejar todo como estaba: posición de scroll de la página y de las filas que se deslizan.
      const guardados = new Map<Element, [number, number]>();
      const guardar = (el: Element) => {
        for (let p: Element | null = el.parentElement; p; p = p.parentElement)
          if (!guardados.has(p)) guardados.set(p, [p.scrollLeft, p.scrollTop]);
      };
      const ventana: [number, number] = [window.scrollX, window.scrollY];

      // Con un modal abierto (ej. la conversación) lo de atrás queda tapado a propósito: solo se miran sus botones.
      const modal = [...document.querySelectorAll("[aria-modal=true]")].at(-1) ?? document;
      const candidatos = [
        ...modal.querySelectorAll("button, a[href], [role=button], label:has(> input[type=file])"),
      ].filter((el) => {
        const s = getComputedStyle(el);
        const b = el.getBoundingClientRect();
        return (
          s.visibility !== "hidden" &&
          s.display !== "none" &&
          Number(s.opacity) > 0.05 &&
          b.width > 2 &&
          b.height > 2 &&
          !el.closest("[aria-hidden=true], [inert]")
        );
      });

      const tapados: string[] = [];
      for (const el of candidatos) {
        guardar(el);
        el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
        const b = el.getBoundingClientRect();
        if (b.top < -1 || b.left < -1 || b.bottom > vh + 1 || b.right > vw + 1) {
          tapados.push(
            `${nombreDe(el)}: se sale por el borde (${Math.round(b.left)},${Math.round(b.top)} → ${Math.round(b.right)},${Math.round(b.bottom)} en ${vw}×${vh})`,
          );
          continue;
        }
        const puntos: Array<[number, number]> = [
          [0.5, 0.5],
          [0.25, 0.5],
          [0.75, 0.5],
          [0.5, 0.25],
          [0.5, 0.75],
        ];
        for (const [fx, fy] of puntos) {
          const x = b.left + b.width * fx;
          const y = b.top + b.height * fy;
          const arriba = document.elementFromPoint(x, y);
          if (arriba && arriba !== el && !el.contains(arriba) && !arriba.contains(el)) {
            tapados.push(`${nombreDe(el)}: lo tapa ${describir(arriba)}`);
            break;
          }
        }
      }

      for (const [el, [l, t]] of guardados) {
        el.scrollLeft = l;
        el.scrollTop = t;
      }
      window.scrollTo({ left: ventana[0], top: ventana[1], behavior: "instant" });
      return tapados;
    },
    { ancho, alto },
  );
}

// ---------- Alto del 3D ----------

/**
 * Qué fracción del alto de la pantalla ocupa el 3D QUE SE VE: el lienzo puede estar detrás de
 * todo (encabezado, tarjeta del paso, barra de abajo), así que su alto no dice nada. Recorre de
 * arriba abajo 3 columnas (25 %, 50 %, 75 % del ancho) y cuenta en qué puntos lo de arriba es el
 * lienzo. Lo que no recibe toques (degradés, etiquetas) no tapa.
 */
export async function altoDel3D(page: Page) {
  return page.evaluate(() => {
    // Hay más de un <canvas> (el fondo animado de Sayso ocupa toda la pantalla): el del 3D es el del visor.
    const lienzo = document.querySelector('div[style*="touch-action: none"] canvas');
    if (!lienzo) return null;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const columnas = [0.25, 0.5, 0.75];
    const PASO = 4;
    const area = (r: DOMRect) => r.width * r.height;
    const areaLienzo = area(lienzo.getBoundingClientRect());
    // R3F envuelve el lienzo en un div que recibe los toques: ese div (del mismo tamaño) también es "el 3D".
    const esEl3D = (el: Element | null) =>
      !!el && (el === lienzo || (el.contains(lienzo) && area(el.getBoundingClientRect()) <= areaLienzo * 1.05));
    let filasConTresD = 0;
    let filas = 0;
    for (let y = PASO / 2; y < vh; y += PASO) {
      filas++;
      // Una fila cuenta si en la mayoría de las columnas se ve el 3D.
      const visibles = columnas.filter((fx) => esEl3D(document.elementFromPoint(vw * fx, y))).length;
      if (visibles >= 2) filasConTresD++;
    }
    const b = lienzo.getBoundingClientRect();
    // Qué hay arriba en el centro a distintas alturas (para entender la medida si falla).
    const arriba = [0.1, 0.3, 0.5, 0.7, 0.9].map((fy) => {
      const el = document.elementFromPoint(vw / 2, vh * fy);
      if (!el) return `${fy}: nada`;
      const clase = (el.getAttribute("class") ?? "").split(/\s+/).slice(0, 4).join(".");
      return `${fy}: ${el.tagName.toLowerCase()}${clase ? `.${clase}` : ""}${esEl3D(el) ? " (3D)" : ""}`;
    });
    return {
      arriba,
      pantalla: vh,
      lienzo: Math.round(b.height),
      visible: Math.round((filasConTresD / filas) * vh),
      fraccion: filasConTresD / filas,
    };
  });
}

// ---------- La etiqueta no salta de lado ----------

export type CambioDeLado = { pieza: string; t: number; de: string; a: string };

/**
 * Muestrea durante `ms` (cada `cada` ms) de qué lado de su pieza está cada etiqueta del 3D
 * (derecha/izquierda y arriba/abajo, respecto del punto de la pieza). Devuelve los cambios de
 * lado con su momento, para ver si alguna salta más de una vez por segundo.
 * Mientras tanto se puede mover el 3D (ver `girar3D`).
 */
export async function muestrearLadosEtiqueta(page: Page, ms = 3000, cada = 100) {
  return page.evaluate(
    ({ ms, cada }) =>
      new Promise<{ muestras: number; etiquetas: string[]; cambios: CambioDeLado[] }>((listo) => {
        const ultimo = new Map<string, string>();
        const cambios: CambioDeLado[] = [];
        const vistas = new Set<string>();
        let muestras = 0;
        const t0 = performance.now();
        const mirar = () => {
          muestras++;
          // El recuadro de la etiqueta está junto al punto de la pieza (svg con un círculo, en 0,0).
          for (const caja of document.querySelectorAll<HTMLElement>("div.whitespace-nowrap.rounded-md")) {
            const ancla = caja.parentElement?.querySelector(":scope > svg circle");
            if (!ancla || caja.offsetWidth === 0) continue;
            const pieza = (caja.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
            vistas.add(pieza);
            const h = caja.offsetLeft + caja.offsetWidth / 2 >= 0 ? "derecha" : "izquierda";
            const v = caja.offsetTop + caja.offsetHeight / 2 < 0 ? "arriba" : "abajo";
            const lado = `${v}-${h}`;
            const antes = ultimo.get(pieza);
            if (antes && antes !== lado) cambios.push({ pieza, t: Math.round(performance.now() - t0), de: antes, a: lado });
            ultimo.set(pieza, lado);
          }
        };
        mirar();
        const id = setInterval(mirar, cada);
        setTimeout(() => {
          clearInterval(id);
          mirar();
          listo({ muestras, etiquetas: [...vistas], cambios });
        }, ms);
      }),
    { ms, cada },
  );
}

/** Dos cambios de lado de la misma etiqueta a menos de 1 s: salta de lado más de una vez por segundo. */
export function saltosRapidos(cambios: CambioDeLado[], ventanaMs = 1000): string[] {
  const porPieza = new Map<string, CambioDeLado[]>();
  for (const c of cambios) porPieza.set(c.pieza, [...(porPieza.get(c.pieza) ?? []), c]);
  const saltos: string[] = [];
  for (const [pieza, lista] of porPieza)
    for (let i = 1; i < lista.length; i++)
      if (lista[i].t - lista[i - 1].t < ventanaMs)
        saltos.push(
          `"${pieza}" cambió de lado 2 veces en ${lista[i].t - lista[i - 1].t} ms (${lista[i - 1].de} → ${lista[i - 1].a} → ${lista[i].a})`,
        );
  return saltos;
}

/** Gira el 3D despacio arrastrando de un lado al otro (como una persona con el dedo), durante ~`ms`. */
export async function girar3D(page: Page, lienzo: Locator, ms = 2800) {
  const b = await lienzo.boundingBox();
  if (!b) return;
  const y = b.y + b.height * 0.7;
  const x0 = b.x + b.width * 0.3;
  const x1 = b.x + b.width * 0.7;
  const pasos = 28;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= pasos; i++) {
    // Ida y vuelta: primero a la derecha, después vuelve.
    const f = i <= pasos / 2 ? i / (pasos / 2) : 2 - i / (pasos / 2);
    await page.mouse.move(x0 + (x1 - x0) * f, y, { steps: 2 });
    await page.waitForTimeout(ms / pasos);
  }
  await page.mouse.up();
}

/** El lienzo del visor 3D: el `<canvas>` que está dentro del visor (fondo negro, `touch-action: none`), no otros de la página. */
export function lienzo3D(page: Page): Locator {
  return page.locator('div[style*="touch-action: none"] canvas').first();
}
