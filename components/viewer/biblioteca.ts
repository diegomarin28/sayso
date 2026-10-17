"use client";

import { useEffect, useState } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { bibliotecaDesdeEscena, type BibliotecaPiezas } from "../../lib/planogenerator";

/** Piezas genéricas modeladas en Blender (`npm run modelos:piezas`). */
export const URL_PIEZAS = "/models/piezas.glb";
/** Si tarda más, se arranca con las primitivas: el 3D nunca espera a la red. */
const ESPERA_MAXIMA_MS = 4000;

let pendiente: Promise<BibliotecaPiezas | null> | null = null;

/** Se descarga una sola vez por sesión. `null` = no se pudo: el visor usa primitivas. */
export function cargarBiblioteca(): Promise<BibliotecaPiezas | null> {
  pendiente ??= new GLTFLoader()
    .loadAsync(URL_PIEZAS)
    .then((gltf) => bibliotecaDesdeEscena(gltf.scene))
    .catch((e: unknown) => {
      console.warn("[visor] sin biblioteca de piezas, uso primitivas:", e);
      return null;
    });
  return pendiente;
}

/** `undefined` mientras carga; después la biblioteca o `null`. */
export function useBibliotecaPiezas(): BibliotecaPiezas | null | undefined {
  const [biblioteca, setBiblioteca] = useState<BibliotecaPiezas | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    const plazo = setTimeout(() => vivo && setBiblioteca((b) => (b === undefined ? null : b)), ESPERA_MAXIMA_MS);
    void cargarBiblioteca().then((b) => {
      clearTimeout(plazo);
      if (vivo) setBiblioteca((actual) => (actual === undefined ? b : actual));
    });
    return () => {
      vivo = false;
      clearTimeout(plazo);
    };
  }, []);
  return biblioteca;
}
