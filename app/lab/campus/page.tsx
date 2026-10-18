import { notFound } from "next/navigation";
import { LabGaleria } from "@/components/viewer/galeria/LabGaleria";
import { GALERIA_CAMPUS } from "@/components/viewer/galeria/campus";

/** Solo lab/fixture: no ofrece estos planos como modelos reales del jurado. */
export default function Page() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_DATOS !== "fixture") notFound();
  return <LabGaleria equipos={GALERIA_CAMPUS} campus />;
}
