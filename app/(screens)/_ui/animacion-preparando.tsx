"use client";

/**
 * Animación de la pantalla 4. Muestra lo que de verdad está pasando, en dos actos:
 *  - "manual": un manual que se abre, se lee (franja que barre la página), pasa hojas y marca citas.
 *  - "plano": el equipo de la persona en líneas, que se dibuja solo y enciende sus piezas.
 *    El dibujo depende del equipo (notebook, celular, heladera, lavarropas, aire, TV o genérico).
 * Se dibuja solo el acto que corresponde (no se oculta con CSS: así nunca se superponen).
 * Solo SVG + CSS (clases .prep-* en globals.css); con "reducir movimiento" queda quieta.
 */

export type ActoPreparando = "manual" | "plano" | "listo";

const LINEAS_IZQ = [92, 70, 96, 84, 60, 90, 76];
const LINEAS_DER = [88, 96, 66, 92, 80, 58, 94];

type Dibujo = "notebook" | "celular" | "heladera" | "lavarropas" | "aire" | "tv" | "generico";

/** Elige el dibujo por el tipo de equipo en texto libre (de la IA) o, si no hay, por la clase. */
export function dibujoPara(equipo?: string | null): Dibujo {
  const t = (equipo ?? "").toLowerCase();
  if (/celular|tel[eé]fono|smartphone|iphone|android|tablet|ipad/.test(t)) return "celular";
  if (/heladera|freezer|refrigerador|nevera|congelador/.test(t)) return "heladera";
  if (/lavarropas|lavadora|lavavajillas|secarropas/.test(t)) return "lavarropas";
  if (/aire|split|acondicionado/.test(t)) return "aire";
  if (/notebook|laptop|port[aá]til|computadora|\bpc\b|macbook|chromebook/.test(t)) return "notebook";
  if (/\btv\b|televisor|tele\b|smart tv|monitor|pantalla/.test(t)) return "tv";
  return "generico";
}

export function AnimacionPreparando({ acto, equipo }: { acto: ActoPreparando; equipo?: string | null }) {
  const dibujo = dibujoPara(equipo);
  return (
    <div className="relative mx-auto aspect-[7/5] w-full max-w-sm" aria-hidden>
      {acto === "manual" ? (
        <svg key="manual" viewBox="0 0 280 200" className="aparece absolute inset-0 h-full w-full">
          <Manual />
        </svg>
      ) : (
        <svg
          key={`equipo-${dibujo}`}
          viewBox="0 0 280 200"
          className={`aparece absolute inset-0 h-full w-full ${acto === "listo" ? "prep-listo" : ""}`}
        >
          <Equipo dibujo={dibujo} />
        </svg>
      )}
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
          stroke="var(--dato)"
          strokeWidth="2.4"
          className="prep-pieza"
          style={{ animationDelay: `${p.retraso}s` }}
        />
      ))}
    </g>
  );
}

/** Contorno que se dibuja solo. */
function Trazo({ d, retraso = 0, suave = false }: { d: string; retraso?: number; suave?: boolean }) {
  return (
    <path
      d={d}
      stroke={suave ? "var(--texto-suave)" : "var(--texto)"}
      strokeWidth={suave ? 2 : 2.2}
      pathLength={1}
      className="prep-trazo"
      style={{ animationDelay: `${retraso}s` }}
    />
  );
}

/** Pieza que se enciende en naranja. */
function Pieza({ d, retraso }: { d: string; retraso: number }) {
  return (
    <path
      d={d}
      stroke="var(--dato)"
      strokeWidth="2.4"
      className="prep-pieza"
      style={{ animationDelay: `${retraso}s` }}
    />
  );
}

function Sombra({ rx = 110 }: { rx?: number }) {
  return <ellipse cx="140" cy="186" rx={rx} ry="8" fill="rgb(0 0 0 / 0.35)" />;
}

function Equipo({ dibujo }: { dibujo: Dibujo }) {
  const comun = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (dibujo) {
    case "notebook":
      return <Notebook />;
    case "celular":
      return (
        <g {...comun}>
          <Sombra rx={60} />
          {/* cuerpo con un poco de profundidad */}
          <Trazo d="M114 18 h56 a12 12 0 0 1 12 12 v140 a12 12 0 0 1 -12 12 h-56 a12 12 0 0 1 -12 -12 v-140 a12 12 0 0 1 12 -12 z" />
          <Trazo d="M182 30 l8 4 v138 a12 12 0 0 1 -12 12 l-8 -2" suave retraso={0.3} />
          {/* placa, cámara, batería, parlante */}
          <Pieza d="M116 32 h52 v22 h-52 z" retraso={0.9} />
          <Pieza
            d="M131 43 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M147 43 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0"
            retraso={1.4}
          />
          <Pieza d="M118 62 h48 v84 h-48 z M138 58 h8" retraso={1.9} />
          <Pieza d="M128 166 h28" retraso={2.5} />
        </g>
      );
    case "heladera":
      return (
        <g {...comun}>
          <Sombra rx={70} />
          <Trazo d="M96 14 h88 v168 h-88 z" />
          <Trazo d="M184 14 l12 6 v158 l-12 4" suave retraso={0.3} />
          <Trazo d="M96 72 h88 M104 30 v28 M104 86 v40" suave retraso={0.5} />
          {/* evaporador, bandejas, compresor, motor del ventilador */}
          <Pieza d="M118 24 h56 v12 h-56 z" retraso={0.9} />
          <Pieza d="M114 104 h62 M114 128 h62" retraso={1.5} />
          <Pieza d="M150 160 h28 v18 h-28 z M156 160 v-4 h16 v4" retraso={2.1} />
          <Pieza
            d="M168 50 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M168 50 l5 -3 M168 50 l-5 3"
            retraso={2.7}
          />
        </g>
      );
    case "lavarropas":
      return (
        <g {...comun}>
          <Sombra rx={80} />
          <Trazo d="M82 34 h116 v148 h-116 z" />
          <Trazo d="M198 34 l12 6 v138 l-12 4" suave retraso={0.3} />
          <Trazo d="M82 60 h116 M168 47 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0" suave retraso={0.5} />
          <Trazo d="M140 120 m-40 0 a40 40 0 1 0 80 0 a40 40 0 1 0 -80 0" retraso={0.6} />
          {/* tambor, motor, bomba, panel */}
          <Pieza
            d="M140 120 m-27 0 a27 27 0 1 0 54 0 a27 27 0 1 0 -54 0 M126 108 l28 24 M154 108 l-28 24"
            retraso={1.1}
          />
          <Pieza d="M96 44 h40 v8 h-40 z" retraso={1.7} />
          <Pieza d="M92 168 h24 v8 h-24 z" retraso={2.3} />
          <Pieza d="M182 170 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0" retraso={2.8} />
        </g>
      );
    case "aire":
      return (
        <g {...comun}>
          <Sombra rx={100} />
          {/* unidad interior */}
          <Trazo d="M40 30 h200 a10 10 0 0 1 10 10 v26 a10 10 0 0 1 -10 10 h-200 a10 10 0 0 1 -10 -10 v-26 a10 10 0 0 1 10 -10 z" />
          <Trazo d="M50 66 h180" suave retraso={0.4} />
          {/* unidad exterior */}
          <Trazo d="M142 112 h104 v68 h-104 z" retraso={0.3} />
          {/* filtro, turbina, cañerías (refrigerante: no se toca), ventilador exterior */}
          <Pieza d="M48 40 h120 v10 h-120 z" retraso={0.9} />
          <Pieza d="M210 48 m-10 0 a10 8 0 1 0 20 0 a10 8 0 1 0 -20 0" retraso={1.5} />
          <Pieza d="M60 76 v60 h82 M70 76 v50 h72" retraso={2.0} />
          <Pieza
            d="M194 146 m-24 0 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0 M194 146 l14 -8 M194 146 l-14 8 M194 146 l-4 16 M194 146 l4 -16"
            retraso={2.6}
          />
        </g>
      );
    case "tv":
      return (
        <g {...comun}>
          <Sombra rx={90} />
          <Trazo d="M34 26 h212 v128 h-212 z" />
          <Trazo d="M120 154 l-10 24 h60 l-10 -24" suave retraso={0.4} />
          {/* retroiluminación, placa principal, fuente, parlantes */}
          <Pieza d="M48 50 h184 M48 76 h184 M48 102 h184 M48 128 h184" retraso={0.9} />
          <Pieza d="M150 60 h56 v40 h-56 z" retraso={1.6} />
          <Pieza d="M74 64 h48 v48 h-48 z" retraso={2.2} />
          <Pieza d="M50 144 h30 M200 144 h30" retraso={2.8} />
        </g>
      );
    default:
      return (
        <g {...comun}>
          <Sombra rx={95} />
          {/* caja genérica en perspectiva con la tapa levantada */}
          <Trazo d="M60 110 L140 78 L220 110 L140 142 Z" />
          <Trazo d="M60 110 v44 L140 186 L220 154 v-44 M140 142 v44" suave retraso={0.3} />
          <Trazo d="M60 110 L60 58 L140 26 L140 78" suave retraso={0.5} />
          {/* placa, conectores, fuente */}
          <Pieza d="M96 112 L140 94 L184 112 L140 130 Z" retraso={1.0} />
          <Pieza d="M118 104 l10 -4 l10 4 l-10 4 z M146 114 l10 -4 l10 4 l-10 4 z" retraso={1.7} />
          <Pieza d="M82 126 l16 -6 l12 6 l-16 6 z" retraso={2.4} />
        </g>
      );
  }
}
