import type { MetadataRoute } from "next";

/** La app se instala en el celular ("Agregar a inicio") y se usa siempre en vertical. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sayso",
    short_name: "Sayso",
    description: "Contale qué se rompió. Te guío con el manual de tu equipo, en 3D.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e1a24",
    theme_color: "#0e1a24",
    lang: "es",
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
