/**
 * Marca de Sayso: una tuerca hexagonal (reparación) con tres barras de voz adentro (lo que la
 * persona cuenta hablando). Mientras el experto piensa, las barras se mueven como si hablara.
 * Los colores salen de las variables de globals.css (--acento, --dato).
 */

export type EstadoMarca = "quieto" | "pensando";

export const NOMBRE_PRODUCTO = "Sayso";
export const LEMA = "Contale qué se rompió. Te guío con el manual de tu equipo, en 3D.";

/** El símbolo solo (para el encabezado, el ícono de la app y las cargas). */
export function Simbolo({ estado = "quieto", tam = 44 }: { estado?: EstadoMarca; tam?: number }) {
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 48 48"
      fill="none"
      className="marca shrink-0"
      data-estado={estado}
      aria-hidden
    >
      {/* tuerca */}
      <path
        d="M24 3.5 41.8 13.75v20.5L24 44.5 6.2 34.25v-20.5z"
        stroke="var(--acento)"
        strokeWidth="3.2"
        strokeLinejoin="round"
        fill="var(--superficie)"
      />
      {/* barras de voz */}
      <g fill="var(--dato)">
        <rect
          className="marca-barra"
          x="15.2"
          y="19"
          width="4"
          height="10"
          rx="2"
          style={{ animationDelay: "0ms" }}
        />
        <rect
          className="marca-barra"
          x="22"
          y="14.5"
          width="4"
          height="19"
          rx="2"
          style={{ animationDelay: "140ms" }}
        />
        <rect
          className="marca-barra"
          x="28.8"
          y="18"
          width="4"
          height="12"
          rx="2"
          style={{ animationDelay: "280ms" }}
        />
      </g>
    </svg>
  );
}

/** Nombre, con o sin símbolo (sin símbolo cuando ya está en el encabezado de la misma pantalla). */
export function Marca({ tam = 40, conSimbolo = true }: { tam?: number; conSimbolo?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {conSimbolo && <Simbolo tam={tam} />}
      <span
        className="leading-none font-extrabold tracking-tight lowercase"
        style={{ fontSize: tam * 0.75 }}
      >
        {NOMBRE_PRODUCTO.toLowerCase()}
      </span>
    </span>
  );
}
