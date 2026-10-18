"use client";

import { useState } from "react";
import type { OpcionCompra } from "../../lib/compras/esquemas";
import { MENSAJE_PAUSA } from "../../lib/ia/pausa";
import { ErrorCompras, MENSAJES, type FuenteCompras, type RespuestaCompras } from "./fuente";
import { OpcionesCompra } from "./OpcionesCompra";

/**
 * Banco de pruebas de <OpcionesCompra> con respuestas SIMULADAS (sin IA ni búsquedas): solo /lab.
 * Las publicaciones son de ejemplo y los links van a ejemplo.com, no a tiendas reales.
 */
const opcion = (n: number, cambios: Partial<OpcionCompra>): OpcionCompra => ({
  url: `https://ejemplo.com/publicacion-${n}`,
  titulo: `Ventilador de repuesto para notebook (ejemplo ${n})`,
  tienda: `Tienda de ejemplo ${n}`,
  compatibilidad: "numero_parte",
  precio: { monto: 1290, moneda: "UYU", estado: "confirmado" },
  envio: { monto: 0, estado: "confirmado" },
  totalUyu: 1290,
  ...cambios,
});

const TRES: OpcionCompra[] = [
  opcion(1, {}),
  opcion(2, {
    titulo: "Cooler ventilador interno con disipador, compatible con varios modelos de la misma línea (ejemplo 2, título largo)",
    compatibilidad: "modelo",
    precio: { monto: 1450, moneda: "UYU", estado: "probable" },
    envio: { monto: 290, estado: "probable" },
    totalUyu: 1740,
  }),
  opcion(3, {
    compatibilidad: "no_verificado",
    precio: { monto: 24.9, moneda: "USD", estado: "probable" },
    envio: { monto: null, estado: "desconocido" },
    totalUyu: null,
  }),
];

const respuesta = (opciones: OpcionCompra[]): RespuestaCompras => ({
  opciones,
  cotizacion: null,
  descartados: [],
  costo: { modelo: "simulado", tokensEntrada: 0, tokensSalida: 0, busquedas: 0, usd: 0 },
  eventos: [],
});

const demora = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const CASOS: Record<string, FuenteCompras> = {
  tres: async () => (await demora(800), respuesta(TRES)),
  vacio: async () => (await demora(800), respuesta([])),
  sinConexion: async () => {
    await demora(400);
    throw new ErrorCompras(MENSAJES.sinConexion);
  },
  pausa: async () => {
    await demora(400);
    throw new ErrorCompras(MENSAJE_PAUSA);
  },
  incompleta: async () => (await demora(800), { ...respuesta([]), motivo: "incompleta" }),
  tardo: async () => {
    await demora(400);
    throw new ErrorCompras(MENSAJES.tardo);
  },
  ia: async () => {
    await demora(400);
    throw new ErrorCompras(MENSAJES.ia);
  },
  rota: async () => (await demora(400), { opciones: TRES }) as unknown as RespuestaCompras,
};

/** Piezas de ejemplo: una sin número de parte (se busca por modelo) y una con. */
export const PIEZAS = {
  celular: { pieza: "conector_lightning", nombre: "Conector Lightning de carga", numeroParte: null, modelo: "iPhone 13", marca: "Apple" },
  tv: { pieza: "placa_principal", nombre: "Placa principal", numeroParte: "40-MT56E1-MAB2HG", modelo: "55V6C", marca: "TCL" },
} as const;

export function LabCompras({ casoInicial, piezaInicial }: { casoInicial?: string; piezaInicial?: string }) {
  const [caso, setCaso] = useState(casoInicial && casoInicial in CASOS ? casoInicial : "tres");
  const [pieza, setPieza] = useState<keyof typeof PIEZAS>(piezaInicial && piezaInicial in PIEZAS ? (piezaInicial as keyof typeof PIEZAS) : "celular");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 bg-fondo px-4 py-6 text-texto">
      <div className="flex flex-wrap gap-2">
        {Object.keys(CASOS).map((c) => (
          <button
            key={c}
            onClick={() => setCaso(c)}
            className={`rounded-full border px-3 py-1 text-xs ${c === caso ? "border-acento text-texto" : "border-borde text-texto-suave"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PIEZAS) as Array<keyof typeof PIEZAS>).map((p) => (
          <button
            key={p}
            onClick={() => setPieza(p)}
            className={`rounded-full border px-3 py-1 text-xs ${p === pieza ? "border-acento text-texto" : "border-borde text-texto-suave"}`}
          >
            {PIEZAS[p].nombre}
          </button>
        ))}
      </div>
      <OpcionesCompra key={`${caso}-${pieza}`} {...PIEZAS[pieza]} fuente={CASOS[caso]} buscarAlMontar />
    </main>
  );
}
