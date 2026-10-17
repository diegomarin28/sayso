import type { MetadataRoute } from "next";

/** La app se instala en el celular ("Agregar a inicio") y se usa siempre en vertical. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Experto al lado",
    short_name: "Experto",
    description: "Guía de reparación con IA, voz y 3D",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1c1f24",
    theme_color: "#1c1f24",
    lang: "es",
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
