"use client";

import Link from "next/link";
import { useState } from "react";
import { guardarLocal, type CasoGuardado } from "../../(screens)/_datos/mis-casos";

/** Botón de /lab/demo: deja los equipos de la demo en "Mis casos" de este celular (sin IA). */
export function LabDemo({ casos, faltan }: { casos: CasoGuardado[]; faltan: { id: string; falta: string }[] }) {
  const [cargados, setCargados] = useState(false);

  const cargar = () => {
    // Cada caso de prueba vuelve a empezar: sin cierre, con la guía y el 3D de la caché.
    for (const c of casos) guardarLocal({ ...c, cierre: null });
    setCargados(true);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-fondo px-4 py-6 text-texto">
      <h1 className="text-lg font-semibold">Ensayo de la demo</h1>
      <p className="text-sm text-texto-suave">
        Carga los equipos de la demo en «Mis casos» con lo que ya está guardado (guía y 3D). No usa IA: el chat responde
        simulado.
      </p>

      <ul className="flex flex-col gap-2">
        {casos.map((c) => (
          <li key={c.caso.id} className="rounded-xl border border-borde bg-superficie p-3 text-sm">
            <p className="font-medium">
              {c.ficha?.marca.valor} {c.ficha?.modelo.valor}
            </p>
            <p className="text-texto-suave">
              {c.guia?.preparado.pack.pasos.length ?? 0} pasos · {c.guia?.plano.plano.piezas.length ?? 0} piezas en el 3D
              {c.guia?.preparado.pack.verificado ? " · verificado" : " · no verificado"}
            </p>
          </li>
        ))}
        {faltan.map((f) => (
          <li key={f.id} className="rounded-xl border border-borde p-3 text-sm text-texto-suave">
            Falta {f.id}: {f.falta}
          </li>
        ))}
      </ul>

      {casos.length > 0 && !cargados && (
        <button type="button" onClick={cargar} className="rounded-2xl bg-acento px-4 py-3 font-semibold text-fondo">
          Cargar {casos.length} equipos en Mis casos
        </button>
      )}
      {cargados && (
        <Link href="/casos" className="rounded-2xl bg-acento px-4 py-3 text-center font-semibold text-fondo">
          Listo: abrir Mis casos
        </Link>
      )}
      {casos.length === 0 && (
        <p className="text-sm text-texto-suave">No hay equipos guardados todavía: hay que precalentarlos (gasta IA, con OK de Diego).</p>
      )}
    </main>
  );
}
