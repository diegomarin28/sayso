"use client";

import { useRef, useState } from "react";
import { useDialogo } from "../../../lib/a11y/useDialogo";
import type { FuenteChat, EventoChat } from "../../../components/viewer";
import { Coreografia, type KnowledgePack, type PlanoDePiezas } from "../../../shared";
import type { Cierre, EstadoCierre } from "../_datos/mis-casos";
import { Encabezado } from "../_ui/experto";

/**
 * Cierre del caso (pantalla 6) y retomar un caso que esperaba el repuesto.
 * El experto sigue desde el paso de cambiar la pieza con la guía guardada: no se llama a la IA.
 */

const OPCIONES: { estado: EstadoCierre; titulo: string; detalle: string; icono: string }[] = [
  { estado: "resuelto", titulo: "Lo resolví", detalle: "Quedó andando.", icono: "m5 12.5 4.5 4.5L19 7.5" },
  {
    estado: "esperando_repuesto",
    titulo: "Pedí el repuesto",
    detalle: "Cuando llegue, retomás desde “Mis casos”.",
    icono: "M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Zm0 0 8 4.5 8-4.5M12 12v9",
  },
  {
    estado: "derivado",
    titulo: "Lo llevo a un técnico",
    detalle: "Queda anotado como derivado.",
    icono: "M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17v3h3l5.2-5.2a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.5-.5-.5-2.5 2.5-2.5Z",
  },
];

/**
 * Pantalla 6 — Cierre. Va encima del experto (que sigue montado: al volver no se pierde el chat ni
 * el 3D). Se elige cómo quedó y recién "Guardar en Mis casos" cierra el caso.
 */
export function PanelCierre({
  pack,
  equipo,
  sintoma,
  piezaSugerida,
  compra,
  onCerrar,
  onCancelar,
}: {
  pack: KnowledgePack;
  /** Marca y modelo de la ficha, si la persona la confirmó. */
  equipo: string | null;
  sintoma: string;
  /** La pieza que el experto dijo de cambiar o la de la última compra abierta. */
  piezaSugerida: string | null;
  compra: { pieza: string; url: string } | null;
  onCerrar: (c: Cierre) => void;
  onCancelar: () => void;
}) {
  const [elegido, setElegido] = useState<EstadoCierre | null>(null);
  const [pieza, setPieza] = useState<string>(compra?.pieza ?? piezaSugerida ?? pack.piezas[0]?.id ?? "");
  const url = compra && compra.pieza === pieza ? compra.url : undefined;
  const ref = useRef<HTMLDivElement>(null);
  useDialogo(ref, onCancelar);

  function guardar() {
    if (!elegido) return;
    onCerrar({
      estado: elegido,
      ...(elegido === "esperando_repuesto" && pieza ? { pieza, ...(url ? { compraUrl: url } : {}) } : {}),
      ts: new Date().toISOString(),
    });
  }

  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Terminar el caso" className="fixed inset-0 z-[65] overflow-y-auto bg-fondo">
      {/* La cuadrícula de las otras pantallas (body::before queda tapada por este fondo). */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgb(79_209_224/0.07)_1px,transparent_1px),linear-gradient(90deg,rgb(79_209_224/0.07)_1px,transparent_1px)] bg-[size:22px_22px] [mask-image:linear-gradient(to_bottom,#000,transparent_62%)]"
      />
      <div className="aparece relative mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 [@media(max-height:700px)]:gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 md:max-w-2xl md:pt-6">
        <Encabezado paso={6} alVolver={onCancelar} />

        <div className="mt-2 flex flex-col gap-2 [@media(max-height:700px)]:mt-0 [@media(max-height:700px)]:gap-1 md:mt-6">
          <h1 className="font-titulo text-[clamp(1.75rem,7vw,2.25rem)] [@media(max-height:700px)]:text-[1.625rem] leading-[1.15] font-semibold tracking-tight">
            ¿Cómo quedó?
          </h1>
          <p className="text-base text-texto-suave [@media(max-height:700px)]:text-sm">
            Lo guardo en “Mis casos” para que lo retomes cuando quieras.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-borde bg-superficie px-3.5 py-3 [@media(max-height:700px)]:py-2">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
            className="shrink-0 text-texto-suave"
            aria-hidden
          >
            <rect x="5" y="5" width="14" height="10" rx="1.5" />
            <path d="M2.5 18.5h19" />
          </svg>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono text-sm font-medium uppercase">
              {equipo ?? "Tu equipo"}
            </span>
            <span className="line-clamp-2 [@media(max-height:700px)]:line-clamp-1 text-[0.8125rem] text-texto-suave">{sintoma}</span>
            <span className="block text-[0.8125rem] text-texto-suave">
              {pack.pasos.length} {pack.pasos.length === 1 ? "paso" : "pasos"} en la guía
            </span>
          </span>
        </div>

        <div role="radiogroup" aria-label="Cómo quedó" className="flex flex-col gap-2.5 [@media(max-height:700px)]:gap-2">
          {OPCIONES.map((o) => {
            const activa = elegido === o.estado;
            return (
              <div key={o.estado} className="flex flex-col gap-2.5 [@media(max-height:700px)]:gap-2">
                <button
                  type="button"
                  role="radio"
                  aria-checked={activa}
                  onClick={() => setElegido(o.estado)}
                  className={`flex min-h-[4.75rem] [@media(max-height:700px)]:min-h-[3.75rem] items-center gap-3.5 rounded-2xl border p-3.5 [@media(max-height:700px)]:p-2.5 text-left transition active:scale-[0.99] ${
                    activa ? "border-2 border-acento bg-acento/10" : "border-borde bg-superficie hover:border-texto-suave"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fondo ${
                      activa ? "text-acento" : "text-texto-suave"
                    }`}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d={o.icono} />
                    </svg>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold">{o.titulo}</span>
                    <span className="text-sm text-texto-suave">{o.detalle}</span>
                  </span>
                </button>

                {activa && o.estado === "esperando_repuesto" && (
                  <div className="flex flex-col gap-2 rounded-2xl border border-dato/40 p-3.5">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-texto-suave">¿Qué pieza pediste?</span>
                      <select
                        value={pieza}
                        onChange={(e) => setPieza(e.target.value)}
                        className="h-12 rounded-xl border border-borde bg-superficie px-3 text-base"
                      >
                        {pack.piezas.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="text-xs text-texto-suave">
                      {url ? (
                        <>
                          Compra guardada:{" "}
                          <a href={url} target="_blank" rel="noopener noreferrer" className="break-all underline">
                            {new URL(url).hostname}
                          </a>
                        </>
                      ) : (
                        "Si la compraste desde “Repuestos”, el link queda guardado solo."
                      )}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 mt-auto -mx-4 bg-gradient-to-t from-fondo from-70% to-transparent px-4 pt-4 [@media(max-height:700px)]:pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] [@media(max-height:700px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6">
          <button
            type="button"
            onClick={guardar}
            disabled={!elegido}
            className="flex h-14 [@media(max-height:700px)]:h-12 w-full items-center justify-center rounded-2xl bg-acento text-[1.0625rem] font-semibold text-black transition active:scale-[0.98] disabled:bg-borde disabled:text-texto-suave"
          >
            Guardar en Mis casos
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pregunta con la que arranca la guía al retomar un caso que esperaba el repuesto. */
export function preguntaAlRetomar(pack: KnowledgePack, pieza: string): string {
  const nombre = pack.piezas.find((p) => p.id === pieza)?.nombre ?? pieza;
  return `Ya llegó el repuesto: ${nombre.toLowerCase()}. Sigamos con el cambio.`;
}

/**
 * Pasos para seguir desde el cambio de `pieza`, armados con la guía guardada (los pasos del pack
 * con su cita). Solo usa piezas que existen en el plano; un paso de riesgo alto corta como bloqueo.
 * La bienvenida va al principio del primer paso, que conserva su cita: un paso aparte salía con el
 * sello «Guía pública» sin ser de ninguna guía. Si ese paso es de riesgo alto, no hay bienvenida
 * ("sigamos con el cambio" contradice el bloqueo).
 */
export function pasosAlRetomar(pack: KnowledgePack, plano: PlanoDePiezas, pieza: string): EventoChat[] {
  const enPlano = new Set(plano.piezas.map((p) => p.pieza));
  const nombre = pack.piezas.find((p) => p.id === pieza)?.nombre ?? pieza;
  const pasos = [...pack.pasos].sort((a, b) => a.orden - b.orden);
  let desde = pasos.findIndex((p) => p.piezas.includes(pieza));
  if (desde < 0) desde = pasos.findIndex((p) => p.texto.toLowerCase().includes(nombre.toLowerCase()));
  if (desde < 0) desde = 0;

  const acciones = (piezas: string[]) => {
    const visibles = piezas.filter((p) => enPlano.has(p));
    return [
      { t: "restaurar" as const },
      ...(visibles[0] ? [{ t: "camara" as const, objetivo: visibles[0], zoom: 1.4 }] : []),
      ...visibles.map((p) => ({ t: "resaltar" as const, pieza: p })),
    ];
  };

  const bienvenida = `Ya tenés el repuesto (${nombre.toLowerCase()}): sigamos desde el cambio.`;
  const siguen = pasos.slice(desde);
  // Sin pasos guardados, solo la bienvenida (no hay cita que conservar).
  if (!siguen.length)
    return [
      {
        tipo: "paso",
        coreografia: Coreografia.parse({ paso: 1, dice: bienvenida, acciones: acciones([pieza]), riesgo: "bajo" }),
      },
      { tipo: "fin", pasos: 1 },
    ];

  const eventos: EventoChat[] = [];
  for (const [i, p] of siguen.entries()) {
    const c = Coreografia.parse({
      paso: i + 1,
      dice: i === 0 && p.riesgo !== "alto" ? `${bienvenida} ${p.texto}` : p.texto,
      ...(p.cita ? { cita: p.cita } : {}),
      acciones: acciones(p.piezas),
      riesgo: p.riesgo,
    });
    if (p.riesgo === "alto") {
      eventos.push({ tipo: "bloqueo", coreografia: c, clases: [] });
      break;
    }
    eventos.push({ tipo: "paso", coreografia: c });
  }
  eventos.push({ tipo: "fin", pasos: eventos.length });
  return eventos;
}

/**
 * Fuente del chat que, para la pregunta de retomar, responde con los pasos guardados (sin IA) y
 * para todo lo demás usa la fuente normal.
 */
export function fuenteConRetomar(base: FuenteChat, pregunta: string, eventos: EventoChat[]): FuenteChat {
  return (pedido, senal) => {
    if (pedido.pregunta !== pregunta) return base(pedido, senal);
    return (async function* () {
      for (const e of eventos) {
        if (senal.aborted) return;
        yield e;
      }
    })();
  };
}

/**
 * La pieza candidata a cambiar según la guía guardada: la primera pieza del último paso que
 * existe en el plano (la que se trabajó al final). Null si la guía no nombra ninguna.
 */
export function piezaCandidata(pack: KnowledgePack, plano: PlanoDePiezas): string | null {
  const enPlano = new Set(plano.piezas.map((p) => p.pieza));
  const pasos = [...pack.pasos].sort((a, b) => b.orden - a.orden);
  for (const p of pasos) {
    const pieza = p.piezas.find((x) => enPlano.has(x));
    if (pieza) return pieza;
  }
  return null;
}

/**
 * Los pasos con que termina la guía, para que "Siguiente" llegue hasta el final: probar el equipo
 * (si anda, se terminó) y, si sigue igual, la pieza a cambiar (abre "Ver dónde comprar"). Si el
 * experto ya dijo qué cambiar, solo queda probar.
 */
export function pasosDeCierre(
  pack: KnowledgePack,
  plano: PlanoDePiezas,
  desde: number,
  yaDijoCambiar: boolean,
): Coreografia[] {
  const probar = Coreografia.parse({
    paso: desde,
    dice: "Ahora volvé a armar todo como estaba, prendé el equipo y probalo. Si ya anda bien, quedó resuelto: tocá Terminar.",
    acciones: [{ t: "restaurar" }],
    riesgo: "bajo",
  });
  const pieza = yaDijoCambiar ? null : piezaCandidata(pack, plano);
  if (!pieza) return [probar];
  const nombre = pack.piezas.find((p) => p.id === pieza)?.nombre ?? pieza;
  return [
    probar,
    Coreografia.parse({
      paso: desde + 1,
      dice: `Si sigue igual, lo más probable es que haya que cambiar esta pieza: ${nombre.toLowerCase()}. Te muestro dónde comprarla.`,
      acciones: [
        { t: "restaurar" },
        { t: "camara", objetivo: pieza, zoom: 1.4 },
        { t: "resaltar", pieza },
      ],
      riesgo: "bajo",
      cambiar: pieza,
    }),
  ];
}

/**
 * Fuente que, a la respuesta de `pregunta` (la guía del síntoma), le suma los pasos de cierre
 * antes del "fin". Si la respuesta se bloqueó por seguridad, no suma nada.
 */
export function fuenteConCierre(
  base: FuenteChat,
  pregunta: string,
  pack: KnowledgePack,
  plano: PlanoDePiezas,
): FuenteChat {
  return (pedido, senal) => {
    if (pedido.pregunta !== pregunta) return base(pedido, senal);
    return (async function* () {
      let ultimo = 0;
      let bloqueada = false;
      let cambiar = false;
      for await (const e of base(pedido, senal)) {
        if (e.tipo === "paso") {
          ultimo = Math.max(ultimo, e.coreografia.paso);
          cambiar ||= !!e.coreografia.cambiar;
        }
        if (e.tipo === "bloqueo") bloqueada = true;
        if (e.tipo === "fin" && !bloqueada && ultimo > 0) {
          const extra = pasosDeCierre(pack, plano, ultimo + 1, cambiar);
          for (const c of extra) {
            if (senal.aborted) return;
            yield { tipo: "paso", coreografia: c } satisfies EventoChat;
          }
          yield { ...e, pasos: (e.pasos ?? ultimo) + extra.length };
          continue;
        }
        yield e;
      }
    })();
  };
}
