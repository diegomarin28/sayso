import Link from "next/link";

/**
 * Pantalla 1: problemas típicos para arrancar con un toque. Cada uno se manda tal cual, como si la
 * persona lo hubiera escrito: nombran el equipo para que la recepción lo entienda sin repreguntar.
 */
export const PROBLEMAS = [
  "El ventilador de la notebook suena mucho",
  "No me prende el monitor",
  "El aire no se pone en frío",
];

export function ProblemasFrecuentes({ alElegir }: { alElegir: (problema: string) => void }) {
  return (
    <section aria-labelledby="problemas" className="flex flex-col gap-2">
      <h2 id="problemas" className="text-sm text-texto-suave">
        Problemas frecuentes
      </h2>
      <div className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie/85">
        {PROBLEMAS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => alElegir(p)}
            className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-[15px] transition hover:bg-fondo/40 active:bg-fondo/60"
          >
            {p}
            <Chevron />
          </button>
        ))}
        <Link
          href="/como-funciona"
          className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 text-[15px] text-texto-suave transition hover:text-texto"
        >
          ¿Cómo funciona Sayso?
          <Chevron />
        </Link>
      </div>
    </section>
  );
}

function Chevron() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-texto-suave"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
