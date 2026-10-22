"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { textoDeFalla } from "./_datos/errores";
import { useEnLinea } from "./_ui/en-linea";
import { BotonPrincipal, BotonSecundario, DiceExperto, Pantalla } from "./_ui/experto";

/** Si una pantalla se rompe, la persona lo lee en una frase y puede reintentar o volver al inicio. */
export default function ErrorDePantalla({ error, retry }: { error: unknown; retry: () => void }) {
  const router = useRouter();
  const { titulo, detalle } = textoDeFalla(useEnLinea(), "Esta pantalla");
  useEffect(() => {
    console.error("[pantalla]", error);
  }, [error]);
  return (
    <Pantalla>
      <div role="alert" className="flex flex-1 flex-col justify-center gap-4">
        <DiceExperto texto={titulo} />
        <p className="text-base text-texto-suave">{detalle}</p>
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
