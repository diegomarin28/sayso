import { notFound } from "next/navigation";
import { LabVisor } from "@/components/viewer/LabVisor";

/**
 * Página de prueba del carril B (no es una de las 6 pantallas del producto).
 * Usa fixtures: solo en desarrollo o con NEXT_PUBLIC_DATOS=fixture (regla "Nada hardcodeado").
 */
export default function Page() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_DATOS !== "fixture") notFound();
  return <LabVisor />;
}
