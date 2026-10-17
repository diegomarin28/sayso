import { notFound } from "next/navigation";
import { LabGaleria } from "@/components/viewer/galeria/LabGaleria";

/**
 * Galería del carril B para el pitch: los equipos que cubre la biblioteca 3D, con planos de ejemplo.
 * Usa planos del lab: solo en desarrollo o con NEXT_PUBLIC_DATOS=fixture (regla "Nada hardcodeado").
 */
export default function Page() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_DATOS !== "fixture") notFound();
  return <LabGaleria />;
}
