"use client";

import { useEffect, useRef, type RefObject } from "react";
import { FOCALIZABLES, destinoTab, esElDeArriba } from "./foco";

/** Diálogos abiertos, del de abajo al de arriba. */
const pila: symbol[] = [];

/**
 * El último elemento con foco fuera de un diálogo: el botón que lo abrió. Hace falta porque un campo con
 * `autoFocus` (el del chat) toma el foco antes de que el hook corra y ya no se sabría adónde volver.
 */
let ultimoFuera: HTMLElement | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "focusin",
    (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && !t.closest('[role="dialog"],[role="alertdialog"]')) ultimoFuera = t;
    },
    true,
  );
}

const visible = (e: HTMLElement) => e.getClientRects().length > 0 && !e.closest("[inert]");

/** Deja inerte (sin foco ni lectura de pantalla) todo lo que no sea el diálogo; devuelve cómo deshacerlo. */
function aislar(dialogo: HTMLElement): () => void {
  const marcados: HTMLElement[] = [];
  let nodo: HTMLElement = dialogo;
  while (nodo.parentElement) {
    const padre: HTMLElement = nodo.parentElement;
    for (const hermano of Array.from(padre.children)) {
      if (hermano === nodo || !(hermano instanceof HTMLElement) || hermano.inert) continue;
      if (hermano.tagName === "SCRIPT" || hermano.tagName === "STYLE") continue;
      hermano.inert = true;
      marcados.push(hermano);
    }
    if (padre === document.body) break;
    nodo = padre;
  }
  return () => marcados.forEach((e) => (e.inert = false));
}

/**
 * Lo que un diálogo modal tiene que hacer con el teclado: llevar el foco adentro al abrir, no dejarlo
 * escapar con Tab, cerrar con Escape y devolver el foco al botón que lo abrió.
 *
 * `ref` es el elemento con `role="dialog"`. `foco`: "primero" (el primer botón o campo) o
 * "contenedor" (el diálogo mismo, para que se lea el título y no salte el scroll en uno largo).
 * `activo` sirve para los que quedan montados y ocultos.
 */
export function useDialogo(
  ref: RefObject<HTMLElement | null>,
  onCerrar: () => void,
  { activo = true, foco = "primero" }: { activo?: boolean; foco?: "primero" | "contenedor" } = {},
) {
  // En un ref: `onCerrar` suele ser una función nueva en cada render y no debe reiniciar el foco.
  const cerrar = useRef(onCerrar);
  useEffect(() => {
    cerrar.current = onCerrar;
  }, [onCerrar]);

  useEffect(() => {
    const dialogo = ref.current;
    if (!activo || !dialogo) return;
    const id = Symbol("dialogo");
    const activo0 = document.activeElement;
    const previo = activo0 instanceof HTMLElement && !dialogo.contains(activo0) ? activo0 : ultimoFuera;
    pila.push(id);
    const deshacer = aislar(dialogo);

    const lista = () => Array.from(dialogo.querySelectorAll<HTMLElement>(FOCALIZABLES)).filter(visible);
    const alContenedor = () => {
      if (!dialogo.hasAttribute("tabindex")) dialogo.tabIndex = -1;
      dialogo.style.outline = "none";
      dialogo.focus();
    };
    // Si algo adentro ya tomó el foco (un campo con autoFocus), se respeta.
    if (!dialogo.contains(document.activeElement)) {
      const primero = foco === "primero" ? lista()[0] : undefined;
      if (primero) primero.focus();
      else alContenedor();
    }

    const alTecla = (e: KeyboardEvent) => {
      if (!esElDeArriba(pila, id)) return;
      if (e.key === "Escape") {
        e.preventDefault(); // quien escuche después (ej. el chat) ya sabe que se atendió
        cerrar.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = lista();
      const destino = destinoTab(items.length, items.indexOf(document.activeElement as HTMLElement), e.shiftKey);
      if (destino === null) return;
      e.preventDefault();
      if (destino < 0) alContenedor();
      else items[destino].focus();
    };
    document.addEventListener("keydown", alTecla, true);

    return () => {
      document.removeEventListener("keydown", alTecla, true);
      pila.splice(pila.indexOf(id), 1);
      deshacer();
      // Después del cierre de verdad: en el doble montaje de React (desarrollo) el diálogo sigue ahí.
      queueMicrotask(() => {
        const sigueAbierto = dialogo.isConnected && dialogo.getClientRects().length > 0;
        if (!sigueAbierto && previo?.isConnected) previo.focus();
      });
    };
  }, [ref, activo, foco]);
}
