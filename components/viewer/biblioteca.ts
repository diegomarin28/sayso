"use client";

import { useEffect, useState } from "react";
import type { PackParaElegir } from "../../lib/planogenerator/plantillas/por-tipo";
import { IndicePiezas, archivosPara, bibliotecaDesdeEscena, type BibliotecaPiezas } from "../../lib/planogenerator";
import { cargadorGlb } from "../../lib/planogenerator/cargador";

/** Piezas genéricas modeladas en Blender (`npm run modelos:piezas`): un GLB por familia + el índice. */
export const URL_PIEZAS = "/models/piezas/";
/**
 * Si tarda más, se arranca con las primitivas: el 3D nunca espera a la red. Cuando la descarga
 * termina, las piezas reales reemplazan a las primitivas (el visor no pierde cámara ni paso).
 */
const ESPERA_MAXIMA_MS = 4000;

let indice: Promise<IndicePiezas | null> | null = null;
const familias = new Map<string, Promise<BibliotecaPiezas | null>>();

function cargarIndice(): Promise<IndicePiezas | null> {
  indice ??= fetch(`${URL_PIEZAS}indice.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`indice.json: ${r.status}`))))
    .then((json) => IndicePiezas.parse(json))
    .catch((e: unknown) => {
      console.warn("[visor] sin índice de piezas, uso primitivas:", e);
      return null;
    });
  return indice;
}

/** Cada GLB se baja una sola vez por sesión. `null` = no se pudo: esas piezas usan primitivas. */
function cargarFamilia(archivo: string): Promise<BibliotecaPiezas | null> {
  let p = familias.get(archivo);
  if (!p) {
    p = cargadorGlb()
      .loadAsync(URL_PIEZAS + archivo)
      .then((gltf) => bibliotecaDesdeEscena(gltf.scene))
      .catch((e: unknown) => {
        console.warn(`[visor] no cargó ${archivo}, uso primitivas:`, e);
        return null;
      });
    familias.set(archivo, p);
  }
  return p;
}

/** Solo las familias que necesitan estos ids (una heladera no baja las piezas de notebook). `null` = sin índice. */
export async function cargarBiblioteca(ids: string[]): Promise<BibliotecaPiezas | null> {
  const i = await cargarIndice();
  if (!i) return null;
  const partes = await Promise.all(archivosPara(ids, i).map(cargarFamilia));
  const biblioteca: BibliotecaPiezas = new Map();
  for (const p of partes) for (const [nombre, modelo] of p ?? []) biblioteca.set(nombre, modelo);
  return biblioteca;
}

/**
 * Baja y deja listas las formas que probablemente use el 3D, ANTES de abrirlo: con el tipo de equipo
 * (apenas se sabe) y con el pack (cuando llega). Para "preparando", que de todos modos espera a la IA:
 * el visor después las encuentra en memoria y arranca con las piezas reales, sin esperar la red. Elegir
 * la plantilla vive en un módulo aparte (con el índice de piezas), que se baja solo cuando hace falta.
 */
export function precargarPiezas(tipoEquipo?: string | null, pack?: PackParaElegir | null): Promise<unknown> {
  if (!tipoEquipo?.trim() && !pack?.piezas.length) return Promise.resolve();
  return import("../../lib/planogenerator/plantillas/por-tipo")
    .then(({ piezasProbables }) => cargarBiblioteca(piezasProbables(tipoEquipo, pack)))
    .catch((e: unknown) => console.warn("[visor] no se pudo precargar las piezas:", e));
}

/** `precargarPiezas` cada vez que cambia el tipo de equipo o llega el pack. No renderiza nada. */
export function usePrecargaPiezas(tipoEquipo?: string | null, pack?: PackParaElegir | null): void {
  const clase = pack?.clase;
  const ids = pack?.piezas.map((p) => p.id).join(",") ?? "";
  useEffect(() => {
    void precargarPiezas(tipoEquipo, clase !== undefined ? { clase, piezas: ids ? ids.split(",").map((id) => ({ id })) : [] } : null);
  }, [tipoEquipo, clase, ids]);
}

type EstadoBiblioteca = { clave: string; biblioteca: BibliotecaPiezas | null };

/**
 * Qué usa el visor cuando llega algo para `clave`: lo primero que llega (la biblioteca o el plazo);
 * si antes llegó el plazo (primitivas) y después la biblioteca, la biblioteca reemplaza. Una
 * descarga fallida no reemplaza nada.
 */
export function siguienteBiblioteca(actual: EstadoBiblioteca | undefined, clave: string, nueva: BibliotecaPiezas | null): EstadoBiblioteca | undefined {
  if (actual?.clave !== clave) return { clave, biblioteca: nueva };
  if (actual.biblioteca === null && nueva !== null) return { clave, biblioteca: nueva };
  return actual;
}

/** `undefined` mientras carga lo de estos ids (hasta el plazo); después la biblioteca o `null` (primitivas). */
export function useBibliotecaPiezas(ids: string[]): BibliotecaPiezas | null | undefined {
  const clave = [...new Set(ids)].sort().join(",");
  const [estado, setEstado] = useState<EstadoBiblioteca>();
  useEffect(() => {
    let vivo = true;
    const resolver = (b: BibliotecaPiezas | null) => vivo && setEstado((actual) => siguienteBiblioteca(actual, clave, b));
    const plazo = setTimeout(() => resolver(null), ESPERA_MAXIMA_MS);
    void cargarBiblioteca(clave ? clave.split(",") : []).then((b) => {
      clearTimeout(plazo);
      resolver(b);
    });
    return () => {
      vivo = false;
      clearTimeout(plazo);
    };
  }, [clave]);
  return estado?.clave === clave ? estado.biblioteca : undefined;
}
