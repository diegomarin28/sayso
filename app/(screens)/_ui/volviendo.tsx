"use client";

import { useRouter } from "next/navigation";
import { BotonPrincipal, DiceExperto, Flecha, Orbe, Pantalla } from "./experto";

/**
 * Lo que se ve mientras una pantalla intermedia manda a otra (por ejemplo, al recargar sin caso):
 * nunca una pantalla en blanco. Si el celular tarda en navegar, el botón lleva al inicio.
 */
export function Volviendo({
  texto = "Un segundo, te llevo al inicio…",
  destino = "/",
  boton = "Ir al inicio",
}: {
  texto?: string;
  destino?: string;
  boton?: string;
}) {
  const router = useRouter();
  return (
    <Pantalla>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <Orbe estado="pensando" tam={56} />
        <DiceExperto texto={texto} />
      </div>
      <BotonPrincipal onClick={() => router.replace(destino)}>
        {boton} <Flecha />
      </BotonPrincipal>
    </Pantalla>
  );
}
