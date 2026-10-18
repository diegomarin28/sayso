/** Íconos de línea de los equipos (pantalla 1, "¿Qué equipo es?"). Mismo trazo que el resto de la app. */

const trazo = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export type IconoEquipo = "notebook" | "celular" | "split" | "lavarropas" | "generico" | "otro";

export function IconoDeEquipo({ icono, tam = 36 }: { icono: IconoEquipo; tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 32 32" aria-hidden {...trazo}>
      {icono === "notebook" && (
        <>
          <rect x="7" y="7" width="18" height="12" rx="1.5" />
          <path d="M4 23h24l-2-4H6z" />
        </>
      )}
      {icono === "celular" && (
        <>
          <rect x="10" y="4" width="12" height="24" rx="2.5" />
          <path d="M14.5 7h3M15 24.5h2" />
        </>
      )}
      {icono === "split" && (
        <>
          <rect x="4" y="9" width="24" height="9" rx="2" />
          <path d="M7 15h18M10 22c0 2-1 3-1 3M16 22v3M22 22c0 2 1 3 1 3" />
        </>
      )}
      {icono === "lavarropas" && (
        <>
          <rect x="6" y="4" width="20" height="24" rx="2" />
          <path d="M6 9h20M10 6.5h2" />
          <circle cx="16" cy="18" r="5.5" />
        </>
      )}
      {icono === "generico" && (
        <>
          <path d="M16 5l10 5.5v11L16 27 6 21.5v-11z" />
          <path d="M6 10.5l10 5.5 10-5.5M16 16v11" />
        </>
      )}
      {icono === "otro" && <path d="M16 9v14M9 16h14" />}
    </svg>
  );
}
