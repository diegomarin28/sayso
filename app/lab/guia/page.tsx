import { notFound } from "next/navigation";
import { LabGuia } from "@/components/viewer/guia/LabGuia";

/** Banco de pruebas de <GuiaExperto>. Usa fixtures: solo en desarrollo o con NEXT_PUBLIC_DATOS=fixture. */
export default function Page() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_DATOS !== "fixture") notFound();
  return <LabGuia />;
}
