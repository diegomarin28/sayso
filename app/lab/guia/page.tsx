import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LabGuia } from "@/components/viewer/guia/LabGuia";

/**
 * Banco de pruebas de <GuiaExperto>. Usa fixtures: solo en desarrollo o con NEXT_PUBLIC_DATOS=fixture.
 * `?equipo=heladera` (o aire, celular, lavarropas…: ver EJEMPLOS) carga otro equipo de ejemplo.
 * Leer la URL es dato del pedido: va dentro de <Suspense> (cacheComponents).
 */
export default function Page({ searchParams }: PageProps<"/lab/guia">) {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_DATOS !== "fixture") notFound();
  return (
    <Suspense>
      <ConEquipo searchParams={searchParams} />
    </Suspense>
  );
}

async function ConEquipo({ searchParams }: Pick<PageProps<"/lab/guia">, "searchParams">) {
  const { equipo } = await searchParams;
  return <LabGuia equipo={typeof equipo === "string" ? equipo : undefined} />;
}
