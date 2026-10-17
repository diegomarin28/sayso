"use client";

/**
 * Animación de la pantalla 4. Muestra lo que de verdad está pasando, en dos actos:
 *  - "manual": un manual que se abre, se lee (franja que barre la página), pasa hojas y marca citas.
 *  - "plano": una notebook en líneas que se dibuja sola y enciende sus piezas una por una.
 * Solo SVG + CSS (clases .prep-* en globals.css); con "reducir movimiento" queda quieta.
 */

export type ActoPreparando = "manual" | "plano" | "listo";

const LINEAS_IZQ = [92, 70, 96, 84, 60, 90, 76];
const LINEAS_DER = [88, 96, 66, 92, 80, 58, 94];

export function AnimacionPreparando({ acto }: { acto: ActoPreparando }) {
  return (
    <div className="relative mx-auto aspect-[7/5] w-full max-w-sm" aria-hidden>
      <svg
        viewBox="0 0 280 200"
        className={`prep-acto absolute inset-0 h-full w-full ${acto === "manual" ? "" : "prep-oculto"}`}
      >
        <Manual />
      </svg>
      <svg
        viewBox="0 0 280 200"
        className={`prep-acto absolute inset-0 h-full w-full ${acto === "manual" ? "prep-oculto" : ""} ${
          acto === "listo" ? "prep-listo" : ""
        }`}
      >
        <Notebook />
      </svg>
    </div>
  );
}

function Manual() {
  return (
    <g fill="none" strokeLinecap="round">
      {/* sombra y tapas */}
      <ellipse cx="140" cy="186" rx="118" ry="8" fill="rgb(0 0 0 / 0.35)" />
      <path
        d="M20 34 Q80 24 140 36 Q200 24 260 34 V178 Q200 168 140 180 Q80 168 20 178 Z"
        fill="var(--superficie)"
        stroke="var(--borde)"
        strokeWidth="2"
      />
      <path d="M140 36 V180" stroke="var(--borde)" strokeWidth="2" />

      {/* líneas de texto que se escriben */}
      {LINEAS_IZQ.map((w, i) => (
        <path
          key={`i${i}`}
          d={`M34 ${54 + i * 16} h${w}`}
          stroke="var(--texto-suave)"
          strokeOpacity="0.55"
          strokeWidth="4"
          pathLength={1}
          className="prep-linea"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
      {LINEAS_DER.map((w, i) => (
        <path
          key={`d${i}`}
          d={`M154 ${54 + i * 16} h${w}`}
          stroke="var(--texto-suave)"
          strokeOpacity="0.55"
          strokeWidth="4"
          pathLength={1}
          className="prep-linea"
          style={{ animationDelay: `${1.3 + i * 0.18}s` }}
        />
      ))}

      {/* franja que "lee" la página derecha */}
      <rect
        x="150"
        y="44"
        width="100"
        height="14"
        rx="4"
        fill="var(--acento)"
        opacity="0.22"
        className="prep-lectura"
      />

      {/* citas que aparecen en el margen */}
      <g className="prep-cita" style={{ animationDelay: "0.9s" }}>
        <rect x="96" y="80" width="38" height="16" rx="8" fill="var(--acento)" />
        <text x="115" y="91.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#000">
          p. 54
        </text>
      </g>
      <g className="prep-cita" style={{ animationDelay: "2.4s" }}>
        <rect x="214" y="128" width="38" height="16" rx="8" fill="var(--acento)" />
        <text x="233" y="139.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#000">
          p. 61
        </text>
      </g>

      {/* hoja que pasa */}
      <path
        d="M140 36 Q200 24 260 34 V178 Q200 168 140 180 Z"
        fill="var(--superficie)"
        stroke="var(--borde)"
        strokeWidth="2"
        className="prep-hoja"
      />
    </g>
  );
}

/** Piezas que se encienden, en orden, sobre la base de la notebook (vista isométrica). */
const PIEZAS = [
  // ventilador
  {
    d: "M178 118 m-16 0 a16 9 0 1 0 32 0 a16 9 0 1 0 -32 0 M178 118 l10 -4 M178 118 l-10 4 M178 118 l3 6 M178 118 l-3 -6",
    retraso: 0.9,
  },
  // SSD
  { d: "M96 128 l30 -12 l18 9 l-30 12 Z", retraso: 1.5 },
  // memoria RAM
  { d: "M120 104 l34 -14 l8 4 l-34 14 Z M130 110 l34 -14 l8 4 l-34 14 Z", retraso: 2.1 },
  // batería
  { d: "M76 146 l60 -24 l26 13 l-60 24 Z", retraso: 2.7 },
];

function Notebook() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="140" cy="182" rx="110" ry="9" fill="rgb(0 0 0 / 0.35)" />
      {/* tapa (pantalla) */}
      <path
        d="M54 140 L54 66 L174 18 L174 92"
        stroke="var(--texto-suave)"
        strokeWidth="2"
        pathLength={1}
        className="prep-trazo"
      />
      {/* base */}
      <path
        d="M54 140 L174 92 L238 124 L118 172 Z"
        stroke="var(--texto)"
        strokeWidth="2.2"
        pathLength={1}
        className="prep-trazo"
        style={{ animationDelay: "0.2s" }}
      />
      <path
        d="M54 140 v8 L118 180 L238 132 v-8 M118 172 v8"
        stroke="var(--texto-suave)"
        strokeWidth="2"
        pathLength={1}
        className="prep-trazo"
        style={{ animationDelay: "0.5s" }}
      />
      {/* piezas internas */}
      {PIEZAS.map((p, i) => (
        <path
          key={i}
          d={p.d}
          stroke="var(--acento)"
          strokeWidth="2.4"
          className="prep-pieza"
          style={{ animationDelay: `${p.retraso}s` }}
        />
      ))}
    </g>
  );
}
