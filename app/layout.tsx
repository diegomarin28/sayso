import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Experto al lado",
  description: "Guía de reparación con IA, voz y 3D",
  // En iPhone, "Agregar a inicio" la abre como app, sin la barra de Safari.
  appleWebApp: { capable: true, title: "Experto", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#1c1f24",
  viewportFit: "cover", // usa toda la pantalla; los márgenes respetan el notch (safe-area)
};

// Sin fuentes remotas a propósito: el build no debe depender de internet (Wi-Fi del evento).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
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
