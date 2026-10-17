import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Experto al lado",
  description: "Guía de reparación con IA, voz y 3D",
};

// Sin fuentes remotas a propósito: el build no debe depender de internet (Wi-Fi del evento).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
