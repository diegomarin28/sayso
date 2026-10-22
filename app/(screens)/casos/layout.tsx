import type { Metadata } from "next";

// El título de la pestaña cambia con cada pantalla: un lector de pantalla anuncia el cambio al navegar.
export const metadata: Metadata = { title: "Mis casos · Sayso" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
