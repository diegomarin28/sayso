"use client";

import { useEffect, useRef, useState } from "react";
import { escuchar, type Escucha } from "./escuchar";

/**
 * Dictado con control de la persona: tocás el micrófono y hablás; lo que se transcribe se va
 * juntando (`texto`, en vivo). Al terminar (■) se conserva todo, incluida la frase a medias;
 * al descartar se tira. Si el micrófono se corta solo, se conserva lo que había.
 */
export function useDictado(alTerminar: (texto: string) => void) {
  const [escuchando, setEscuchando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [acumulado, setAcumulado] = useState("");
  const [parcial, setParcial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const escucha = useRef<Escucha | null>(null);
  // Lo transcripto, en un ref para leerlo sin esperar al render (al terminar o si se corta solo).
  const transcripto = useRef({ acumulado: "", parcial: "" });
  const alTerminarRef = useRef(alTerminar);
  useEffect(() => {
    alTerminarRef.current = alTerminar;
  });

  useEffect(() => () => escucha.current?.detener(), []);

  function limpiar() {
    transcripto.current = { acumulado: "", parcial: "" };
    setAcumulado("");
    setParcial("");
  }

  /** Corta el micrófono; con `conservar`, entrega lo transcripto (si hay algo). */
  function cortar(conservar: boolean) {
    const { acumulado: a, parcial: p } = transcripto.current;
    const final = [a, p].filter(Boolean).join(" ").trim();
    limpiar(); // antes de detener: el onFin que dispara detener ya no encuentra nada que entregar
    const e = escucha.current;
    escucha.current = null;
    e?.detener();
    setEscuchando(false);
    if (conservar && final) alTerminarRef.current(final);
  }

  async function empezar() {
    if (escucha.current || conectando) return;
    setError(null);
    limpiar();
    setConectando(true);
    escucha.current = await escuchar({
      onParcial: (t) => {
        transcripto.current.parcial = t;
        setParcial(t);
      },
      onFrase: (t) => {
        const a = [transcripto.current.acumulado, t].filter(Boolean).join(" ");
        transcripto.current = { acumulado: a, parcial: "" };
        setAcumulado(a);
        setParcial("");
      },
      onError: setError,
      // Se cortó solo (error, tiempo máximo): se conserva lo que había.
      onFin: () => {
        if (escucha.current) cortar(true);
      },
    });
    setConectando(false);
    setEscuchando(escucha.current !== null);
  }

  return {
    escuchando,
    conectando,
    /** Lo transcripto hasta ahora, en vivo (frases cerradas + la que se está diciendo). */
    texto: [acumulado, parcial].filter(Boolean).join(" "),
    error,
    empezar,
    /** ■ Terminar: conserva lo transcripto y lo entrega. */
    terminar: () => cortar(true),
    /** Descartar: corta y tira lo transcripto. */
    descartar: () => cortar(false),
    /** Para salir de la pantalla sin entregar nada. */
    detener: () => cortar(false),
  };
}
