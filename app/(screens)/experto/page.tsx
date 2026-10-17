"use client";

import { useFlujo } from "../_estado/flujo";
import { useRequiereCaso } from "../_estado/requiere-caso";
import { DiceExperto, Encabezado, Orbe, Pantalla } from "../_ui/experto";

/** Pantalla 5 — Experto en 3D. Provisoria: el visor y la voz se suman en el próximo bloque (C2/C3). */
export default function Experto() {
  const caso = useRequiereCaso();
  const { preparado } = useFlujo();
  if (!caso) return null;

  return (
    <Pantalla>
      <Encabezado paso={5} />
      <DiceExperto
        texto={`Tengo ${preparado?.pack.pasos.length ?? 0} pasos para tu problema. Enseguida te los muestro en 3D.`}
      />
      <div className="flex flex-1 items-center justify-center">
        <Orbe tam={140} />
      </div>
      <p className="text-center text-xs text-texto-suave">Pantalla 5 en construcción.</p>
    </Pantalla>
  );
}
