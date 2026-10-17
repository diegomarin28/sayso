"use client";

import { useEffect, useRef, useState } from "react";
import { escuchar, type Escucha } from "./escuchar";

/**
 * Dictado para un campo de texto: tocás el micrófono, hablás, y las frases se van sumando.
 * `parcial` es lo que se está diciendo ahora (para mostrarlo en vivo, todavía sin confirmar).
 */
export function useDictado(alFrase: (texto: string) => void) {
  const [escuchando, setEscuchando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [parcial, setParcial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const escucha = useRef<Escucha | null>(null);
  const alFraseRef = useRef(alFrase);
  useEffect(() => {
    alFraseRef.current = alFrase;
  });

  useEffect(() => () => escucha.current?.detener(), []);

  async function empezar() {
    if (escucha.current || conectando) return;
    setError(null);
    setConectando(true);
    escucha.current = await escuchar({
      onParcial: setParcial,
      onFrase: (t) => {
        setParcial("");
        alFraseRef.current(t);
      },
      onError: setError,
      onFin: () => {
        escucha.current = null;
        setEscuchando(false);
        setParcial("");
      },
    });
    setConectando(false);
    setEscuchando(escucha.current !== null);
  }

  function detener() {
    escucha.current?.detener();
    escucha.current = null;
    setEscuchando(false);
  }

  return {
    escuchando,
    conectando,
    parcial,
    error,
    alternar: () => (escucha.current ? detener() : empezar()),
    detener,
  };
}
