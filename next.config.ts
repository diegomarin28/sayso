import type { NextConfig } from "next";

/**
 * Desde qué orígenes se puede usar `npm run dev` además de localhost (el celular por la IP de la Mac).
 * Rangos de red local, no las IPs del momento: esas se leían una sola vez al arrancar y, si cambiaba la
 * red (otro Wi-Fi), el servidor rechazaba la recarga en caliente y la página se recargaba sola cada
 * tanto (B8). Solo en desarrollo; en producción (Vercel) no aplica.
 */
const redLocal = ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"];

const nextConfig: NextConfig = {
  allowedDevOrigins: redLocal,
  // Binario nativo (dibuja páginas del manual a PNG en /api/knowledge): no se empaqueta, se carga de node_modules.
  serverExternalPackages: ["@napi-rs/canvas"],
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
