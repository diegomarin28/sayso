"use client";

import { useEffect, useState } from "react";
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
