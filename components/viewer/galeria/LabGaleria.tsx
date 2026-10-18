"use client";

import { useEffect, useRef, useState } from "react";
import type { Coreografia } from "../../../shared";
import { Visor } from "../Visor";
import { Cerrar } from "../guia/iconos";
import { FORMAS_EN_LA_BIBLIOTECA, GALERIA, pasoDespiece, pasoInicial, type EquipoGaleria } from "./galeria";

/**
 * /lab/galeria, para el pitch: grilla de los equipos que cubre la biblioteca 3D. Cada tarjeta muestra
 * su 3D (solo mientras está a la vista: los celulares tienen pocos lienzos WebGL) y al tocarla se abre
 * en grande con "Despiezar". Fondo negro y títulos grandes: se lee igual en un celular y en un proyector.
 */
export function LabGaleria() {
  const [abierto, setAbierto] = useState<EquipoGaleria | null>(null);
  const grupos = [
    { titulo: "Equipos", equipos: GALERIA.filter((e) => e.grupo === "equipos") },
    { titulo: "Dispositivos", equipos: GALERIA.filter((e) => e.grupo === "dispositivos") },
    { titulo: "En la mano", equipos: GALERIA.filter((e) => e.grupo === "en_la_mano") },
  ];

  return (
    <main className="min-h-dvh bg-black px-4 pt-8 pb-16 text-white sm:px-8 lg:px-12">
      <header className="mx-auto max-w-[1600px]">
        <p className="text-sm font-semibold tracking-[0.2em] text-acento uppercase sm:text-base">Experto al lado</p>
        <h1 className="mt-2 text-4xl leading-tight font-bold sm:text-6xl lg:text-7xl">Lo arma en 3D, pieza por pieza</h1>
        <p className="mt-3 max-w-3xl text-lg text-white/70 sm:text-2xl">
          {GALERIA.length} tipos de equipo · {FORMAS_EN_LA_BIBLIOTECA} formas de piezas. Tocá uno para verlo en grande.
        </p>
      </header>

      {grupos.map((g) => (
        <section key={g.titulo} className="mx-auto mt-10 max-w-[1600px]">
          <h2 className="mb-4 text-2xl font-semibold text-white/80 sm:text-3xl">{g.titulo}</h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 2xl:grid-cols-4">
            {g.equipos.map((e) => (
              <li key={e.id}>
                <Tarjeta equipo={e} onAbrir={() => setAbierto(e)} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {abierto && <EnGrande equipo={abierto} onCerrar={() => setAbierto(null)} />}
    </main>
  );
}

/**
 * La tarjeta no se puede girar (así en el celular la página se desliza): tocarla la abre en grande.
 * El botón va encima del 3D (no lo envuelve: el visor tiene sus propios botones y no se anidan).
 */
function Tarjeta({ equipo, onAbrir }: { equipo: EquipoGaleria; onAbrir: () => void }) {
  const [ref, aLaVista] = useALaVista<HTMLDivElement>();
  const [inicial] = useState(() => pasoInicial(equipo));
  return (
    <div
      ref={ref}
      className="group relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.03] transition hover:border-acento/70 has-[:focus-visible]:border-acento"
    >
      <div className="pointer-events-none relative aspect-[4/3] w-full bg-black">
        {aLaVista && (
          <Visor
            className="h-full w-full"
            plano={equipo.plano}
            tipoEquipo={equipo.tipoEquipo}
            casoId={`galeria-${equipo.id}`}
            coreografia={inicial}
            efectos="no"
            controles={false}
          />
        )}
      </div>
      <div className="flex items-end justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-2xl font-semibold sm:text-3xl">{equipo.titulo}</h3>
          <p className="mt-1 truncate text-base text-white/60">{equipo.detalle}</p>
        </div>
        <span className="shrink-0 text-sm text-white/50">{equipo.plano.piezas.length} piezas</span>
      </div>
      <button
        type="button"
        onClick={onAbrir}
        aria-label={`Abrir ${equipo.titulo} en grande`}
        className="absolute inset-0 z-10 rounded-3xl focus-visible:outline-none active:bg-white/5"
      />
    </div>
  );
}

/** El equipo en pantalla completa, para girarlo con el dedo o el mouse, con "Despiezar" / "Armar". */
function EnGrande({ equipo, onCerrar }: { equipo: EquipoGaleria; onCerrar: () => void }) {
  const [despiezado, setDespiezado] = useState(false);
  const [paso, setPaso] = useState<Coreografia | null>(() => pasoInicial(equipo));
  const cambiar = () => {
    setPaso(pasoDespiece(!despiezado, equipo));
    setDespiezado(!despiezado);
  };

  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => ev.key === "Escape" && onCerrar();
    window.addEventListener("keydown", tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = antes;
    };
  }, [onCerrar]);

  return (
    <div role="dialog" aria-modal="true" aria-label={equipo.titulo} className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex shrink-0 items-start justify-between gap-4 px-4 pt-5 pb-3 sm:px-8 sm:pt-8">
        <div className="min-w-0">
          <h2 className="text-4xl leading-tight font-bold sm:text-6xl">{equipo.titulo}</h2>
          <p className="mt-1 text-lg text-white/60 sm:text-2xl">{equipo.detalle}</p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 active:scale-95 sm:h-14 sm:w-14"
        >
          <Cerrar size={26} />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <Visor
          className="h-full w-full"
          plano={equipo.plano}
          tipoEquipo={equipo.tipoEquipo}
          casoId={`galeria-${equipo.id}`}
          coreografia={paso}
        />
      </div>
      <div className="flex shrink-0 justify-center px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-8">
        <button
          type="button"
          onClick={cambiar}
          className="h-14 min-w-56 rounded-2xl bg-acento px-10 text-xl font-semibold text-black active:scale-95 sm:h-16 sm:text-2xl"
        >
          {despiezado ? "Armar" : "Despiezar"}
        </button>
      </div>
    </div>
  );
}

/**
 * ¿El elemento está en pantalla o cerca? Con margen grande: el 3D ya está al llegar y no se desarma y
 * rearma con cada deslizada (los celulares tienen pocos lienzos WebGL; lejos de la vista se sueltan).
 */
function useALaVista<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, visible];
}
