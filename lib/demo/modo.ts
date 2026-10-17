/**
 * Modo demo de respaldo — dueño: Diego (integración).
 * La app recorre el flujo completo SIN IA ni internet, con los fixtures de `shared/`: sirve si en la
 * demo se cae la Wi-Fi o se acaban los créditos. Se ve igual que la app real.
 *
 * Se prende de tres formas (cualquiera alcanza):
 * - `NEXT_PUBLIC_DATOS=demo` al compilar;
 * - abrir cualquier pantalla con `?demo=1` (queda guardado en el celular; `?demo=0` lo apaga);
 * - cinco toques seguidos en la barra de pasos del encabezado (prende o apaga).
 *
 * `NEXT_PUBLIC_DATOS=fixture` (desarrollo) también apaga la IA, pero no cambia la cámara ni nada más.
 */

const CLAVE = "sayso:demo";

/** El navegador guardó el modo demo. Sin navegador (servidor, tests sin `window`) no hay. */
function guardado(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

export function modoDemo(): boolean {
  return process.env.NEXT_PUBLIC_DATOS === "demo" || guardado();
}

/** Sin IA ni servicios pagos: modo demo o fixture. Se mira en cada llamada, no al cargar el módulo. */
export function sinIA(): boolean {
  return process.env.NEXT_PUBLIC_DATOS === "fixture" || modoDemo();
}

/** Prende o apaga el modo demo en este navegador (y su copia para andar sin internet). */
export function activarDemo(si: boolean): void {
  try {
    if (si) window.localStorage.setItem(CLAVE, "1");
    else window.localStorage.removeItem(CLAVE);
  } catch {
    // Navegación privada sin almacenamiento: queda el NEXT_PUBLIC_DATOS del build.
  }
  window.dispatchEvent(new Event(EVENTO));
  void sinInternet(si);
}

/** Avisa a las pantallas abiertas que el modo cambió (`useModoDemo`). */
export const EVENTO = "sayso:demo";

/** Lee `?demo=1` / `?demo=0` de la URL. Devuelve si cambió algo. */
export function leerDemoDeUrl(url: string): boolean {
  const valor = new URL(url).searchParams.get("demo");
  if (valor !== "1" && valor !== "0") return false;
  const si = valor === "1";
  if (si === guardado()) return false;
  activarDemo(si);
  return true;
}

/**
 * Copia de la app en el celular (service worker `public/sw.js`): con el modo demo prendido, todo lo
 * que se abre queda guardado y la próxima vez anda sin internet. Solo en producción (en `next dev`
 * molestaría a la recarga en caliente). Al apagar el modo se borra.
 */
export async function sinInternet(si: boolean): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") return;
  try {
    if (si) {
      await navigator.serviceWorker.register("/sw.js");
    } else {
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
      if (typeof caches !== "undefined") for (const k of await caches.keys()) if (k.startsWith("sayso-demo")) await caches.delete(k);
    }
  } catch (e) {
    console.warn("[demo] sin copia para andar sin internet:", e);
  }
}

/** Las dos preguntas de la demo, como botones en la pantalla del experto (no hace falta el micrófono). */
export const PREGUNTAS_DEMO = ["¿Dónde está el SSD?", "¿Puedo abrir la batería?"];

/** Foto de ejemplo para cada pedido de la captura guiada (`public/demo/fotos/`, hechas en Blender). */
export function fotoDeEjemplo(tipo: string, intento: number): string {
  if (tipo === "etiqueta") return intento === 1 ? "/demo/fotos/etiqueta-movida.jpg" : "/demo/fotos/etiqueta.jpg";
  if (tipo === "puertos") return "/demo/fotos/puertos.jpg";
  return "/demo/fotos/frente.jpg";
}
