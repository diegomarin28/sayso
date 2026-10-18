import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fuentes guardadas en el repo (app/fuentes): el build no depende de internet (Wi-Fi del evento).
// Títulos con carácter técnico, texto muy legible en el celular y los datos en monoespaciada.
const titulo = localFont({
  src: "./fuentes/space-grotesk-latin-wght-normal.woff2",
  variable: "--fuente-titulo",
  weight: "300 700",
  display: "swap",
});
const texto = localFont({
  src: "./fuentes/inter-latin-wght-normal.woff2",
  variable: "--fuente-texto",
  weight: "100 900",
  display: "swap",
});
const datos = localFont({
  src: "./fuentes/jetbrains-mono-latin-wght-normal.woff2",
  variable: "--fuente-datos",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sayso",
  description: "Contale qué se rompió. Te guío con el manual de tu equipo, en 3D.",
  // En iPhone, "Agregar a inicio" la abre como app, sin la barra de Safari.
  appleWebApp: { capable: true, title: "Sayso", statusBarStyle: "black-translucent" },
  // Vista previa del link (la imagen es app/opengraph-image.tsx).
  openGraph: {
    title: "Sayso",
    description: "Contale qué se rompió. Te guío con el manual de tu equipo, en 3D.",
    siteName: "Sayso",
    locale: "es_AR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e1a24",
  viewportFit: "cover", // usa toda la pantalla; los márgenes respetan el notch (safe-area)
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${titulo.variable} ${texto.variable} ${datos.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        {/* Es una app vertical: si el celular se gira, se pide volver a ponerlo derecho
            (iPhone no respeta el bloqueo de orientación del manifest). */}
        <div className="solo-vertical" role="alert">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="7" y="2" width="10" height="20" rx="2" />
            <path d="M11 18h2" />
          </svg>
          <p>Girá el celular a vertical para seguir.</p>
        </div>
      </body>
    </html>
  );
}
