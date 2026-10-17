"use client";

import { useEffect, useState } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { IndicePiezas, archivosPara, bibliotecaDesdeEscena, type BibliotecaPiezas } from "../../lib/planogenerator";

/** Piezas genéricas modeladas en Blender (`npm run modelos:piezas`): un GLB por familia + el índice. */
export const URL_PIEZAS = "/models/piezas/";
/** Si tarda más, se arranca con las primitivas: el 3D nunca espera a la red. */
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
    p = new GLTFLoader()
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

/** `undefined` mientras carga lo de estos ids; después la biblioteca o `null`. */
export function useBibliotecaPiezas(ids: string[]): BibliotecaPiezas | null | undefined {
  const clave = [...new Set(ids)].sort().join(",");
  const [estado, setEstado] = useState<{ clave: string; biblioteca: BibliotecaPiezas | null }>();
  useEffect(() => {
    let vivo = true;
    // Lo primero que llega gana (la biblioteca o el plazo): no se arma la escena dos veces.
    const resolver = (b: BibliotecaPiezas | null) =>
      vivo && setEstado((actual) => (actual?.clave === clave ? actual : { clave, biblioteca: b }));
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
