import { Suspense } from "react";
import { notFound } from "next/navigation";
import { LabCompras } from "@/components/compras/LabCompras";

type Props = { searchParams: Promise<{ caso?: string }> };

/**
 * Página de prueba de <OpcionesCompra> (no es una de las 6 pantallas). Respuestas simuladas: no gasta IA.
 * Solo en desarrollo o con NEXT_PUBLIC_DATOS=fixture. `?caso=tres|vacio|sinConexion|pausa|rota`.
 */
export default function Page({ searchParams }: Props) {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_DATOS !== "fixture") notFound();
  return (
    <Suspense fallback={null}>
      <ConCaso searchParams={searchParams} />
    </Suspense>
  );
}

async function ConCaso({ searchParams }: Props) {
  const { caso } = await searchParams;
  return <LabCompras casoInicial={caso} />;
}
