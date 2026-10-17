"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Caso, Ficha, Foto } from "@/shared";

/**
 * Estado del recorrido en memoria del navegador. Al recargar se pierde y se vuelve a
 * la pantalla 1; cuando esté Supabase (C1) el caso se guarda ahí.
 */
type Flujo = {
  caso: Caso | null;
  fotos: Foto[];
  ficha: Ficha | null;
  setCaso: (c: Caso | null) => void;
  agregarFoto: (f: Foto) => void;
  setFicha: (f: Ficha | null) => void;
};

const Contexto = createContext<Flujo | null>(null);

export function ProveedorFlujo({ children }: { children: ReactNode }) {
  const [caso, setCaso] = useState<Caso | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [ficha, setFicha] = useState<Ficha | null>(null);

  return (
    <Contexto.Provider
      value={{
        caso,
        fotos,
        ficha,
        setCaso,
        agregarFoto: (f) => setFotos((prev) => [...prev, f]),
        setFicha,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}

export function useFlujo() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useFlujo fuera de ProveedorFlujo");
  return ctx;
}
