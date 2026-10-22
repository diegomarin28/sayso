"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BotonPrincipal, BotonSecundario, DiceExperto, Pantalla } from "./_ui/experto";

/** Si una pantalla se rompe, la persona lo lee en una frase y puede reintentar o volver al inicio. */
export default function ErrorDePantalla({ error, retry }: { error: unknown; retry: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error("[pantalla]", error);
  }, [error]);
  return (
    <Pantalla>
      <div role="alert" className="flex flex-1 flex-col justify-center gap-4">
        <DiceExperto texto="Esta pantalla se trabó." />
        <p className="text-base text-texto-suave">
          No se perdió nada de lo que hiciste. Probá de nuevo o volvé al inicio.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <BotonPrincipal onClick={() => retry()}>Probar de nuevo</BotonPrincipal>
        <BotonSecundario type="button" onClick={() => router.replace("/")}>
          Ir al inicio
        </BotonSecundario>
      </div>
    </Pantalla>
  );
}
