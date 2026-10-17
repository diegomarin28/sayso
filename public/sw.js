/*
 * Copia de la app para el MODO DEMO (lib/demo/modo.ts): se registra solo con el modo demo prendido.
 * Al instalarse guarda las pantallas, sus scripts, las fotos de ejemplo y las piezas 3D; después
 * todo lo que se abre se va guardando. Sin internet, responde con lo guardado.
 * Primero la red (si hay internet se ve siempre lo último); los archivos con hash de Next, primero lo guardado.
 * Nunca guarda /api: el modo demo no la usa.
 */
const CACHE = "sayso-demo-v1";
const PANTALLAS = ["/", "/fotos", "/ficha", "/preparando", "/experto"];
const FOTOS = ["frente", "etiqueta-movida", "etiqueta", "puertos"].map((f) => `/demo/fotos/${f}.jpg`);
const PIEZAS = "/models/piezas/";

/** Los scripts y estilos que pide cada pantalla (para que anden sin haberlas abierto antes). */
const recursosDe = (html) => [...html.matchAll(/["'](\/_next\/static\/[^"'\s]+)["']/g)].map((m) => m[1]);

async function precargar() {
  const cache = await caches.open(CACHE);
  const urls = new Set([...FOTOS, `${PIEZAS}indice.json`]);
  for (const pantalla of PANTALLAS) {
    const res = await fetch(pantalla, { cache: "reload" });
    if (!res.ok) continue;
    await cache.put(pantalla, res.clone());
    for (const r of recursosDe(await res.text())) urls.add(r);
  }
  const indice = await fetch(`${PIEZAS}indice.json`).then((r) => r.json()).catch(() => null);
  for (const archivo of Object.values(indice?.familias ?? {})) urls.add(PIEZAS + archivo);
  await Promise.all([...urls].map((u) => cache.add(u).catch(() => console.warn("[sw] no pude guardar", u))));
}

self.addEventListener("install", (e) => {
  e.waitUntil(precargar().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith("sayso-demo") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** La navegación del lado del cliente pide la pantalla como RSC (`?_rsc=…`): se guarda aparte del HTML. */
const clave = (req, url) => (req.headers.get("RSC") ? `${url.pathname}?__rsc` : url.pathname + url.search);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  const k = clave(req, url);

  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(k).then(
        (guardada) =>
          guardada ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copia = res.clone();
              caches.open(CACHE).then((c) => c.put(k, copia));
            }
            return res;
          }),
      ),
    );
    return;
  }

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(k, copia));
        }
        return res;
      })
      .catch(async () => {
        const guardada = (await caches.match(k)) ?? (await caches.match(url.pathname));
        if (guardada) return guardada;
        if (req.mode === "navigate") return (await caches.match("/")) ?? Response.error();
        return Response.error();
      }),
  );
});
