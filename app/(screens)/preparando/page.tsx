"use client";

import { useFlujo } from "../_estado/flujo";
import { useRequiereCaso } from "../_estado/requiere-caso";
import { DiceExperto, Encabezado, Orbe, Pantalla } from "../_ui/experto";

/** Pantalla 4 — Preparando. Provisoria: el feed y los estados de carga son la tarea C4. */
export default function Preparando() {
  const caso = useRequiereCaso();
  const { ficha } = useFlujo();
  if (!caso) return null;

  return (
    <Pantalla>
      <Encabezado paso={4} orbe="pensando" />
      <DiceExperto texto={`Preparando a tu experto para la ${ficha?.marca.valor ?? ""} ${ficha?.modelo.valor ?? ""}…`} />
      <div className="flex flex-1 items-center justify-center">
        <Orbe estado="pensando" tam={140} />
      </div>
      <p className="text-center text-xs text-texto-suave">Pantalla 4 en construcción (C4).</p>
    </Pantalla>
  );
}
