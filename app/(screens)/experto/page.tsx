"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Visor } from "@/components/viewer";
import { useFlujo } from "../_estado/flujo";
import { useRequiereCaso } from "../_estado/requiere-caso";
import { DiceExperto, Encabezado } from "../_ui/experto";

/**
 * Pantalla 5 — Experto en 3D: pantalla negra, 3D al centro que se gira con el dedo.
 *
 * LUGAR PARA <GuiaExperto> (carril B, Diego): cuando esté, reemplaza al <Visor> de abajo y
 * trae el chat, los subtítulos y la cita. Datos que ya tiene el flujo para pasarle:
 *   caso, ficha, preparado.pack, preparado.manualFileId, plano.plano, agregarEventos.
 * El texto que se muestra es siempre el `dice` que devuelve el visor tras el filtro de
 * seguridad, nunca el original de la IA (ahí viene el aviso cuando se bloquea un paso).
 */
export default function Experto() {
  const router = useRouter();
  const caso = useRequiereCaso();
  const { preparado, plano, agregarEventos } = useFlujo();

  useEffect(() => {
    if (caso && !plano) router.replace("/preparando");
  }, [caso, plano, router]);

  if (!caso || !plano) return null;

  return (
    <main className="relative flex h-dvh w-full flex-col bg-black">
      <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-xl flex-col gap-6 px-5 pt-6">
        <div className="pointer-events-auto">
          <Encabezado paso={5} />
        </div>
        {/* Se dice en voz alta que es un esquema, no un escaneo (transparencia, plan §10). */}
        <DiceExperto texto="Este es tu equipo en esquema, con las piezas donde dice el manual. Giralo con el dedo." />
      </div>
      <Visor
        className="absolute inset-0"
        plano={plano.plano}
        piezas={preparado?.pack.piezas}
        casoId={caso.id}
        onEvento={(e) => agregarEventos([e])}
      />
    </main>
  );
}
