import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * IPs de esta máquina en la red local (ej. 10.252.61.22), solo en desarrollo. Sin esto,
 * `npm run dev` bloquea sus recursos internos cuando la app se abre desde el celular por la IP:
 * la página no arranca y el 3D queda en negro. En producción (Vercel) no aplica.
 */
const ipsDeRed =
  process.env.NODE_ENV === "production"
    ? []
    : Object.values(networkInterfaces())
        .flat()
        .filter((i) => i && i.family === "IPv4" && !i.internal)
        .map((i) => i!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: ipsDeRed,
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
