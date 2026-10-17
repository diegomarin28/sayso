import { Suspense } from "react";
import { notFound } from "next/navigation";
import { LabVisor } from "@/components/viewer/LabVisor";

type Props = { searchParams: Promise<{ plano?: string }> };

/**
 * Página de prueba del carril B (no es una de las 6 pantallas del producto).
 * Usa fixtures: solo en desarrollo o con NEXT_PUBLIC_DATOS=fixture (regla "Nada hardcodeado").
 * `?plano=heladera` (o aire, plantilla, fixture) elige el plano al abrir, para capturas.
 */
export default function Page({ searchParams }: Props) {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_DATOS !== "fixture") notFound();
  return (
    <Suspense fallback={null}>
      <ConPlano searchParams={searchParams} />
    </Suspense>
  );
}

async function ConPlano({ searchParams }: Props) {
  const { plano } = await searchParams;
  return <LabVisor planoInicial={plano} />;
}
