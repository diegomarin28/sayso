"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Caso, Evento, Ficha, Foto } from "@/shared";
import { guardar } from "../_datos/guardar";
import type { ImagenB64 } from "../_datos/imagen";

/**
 * Estado del recorrido en memoria del navegador. Cada cambio también se guarda en
 * Supabase en segundo plano (`guardar`); al recargar se vuelve a la pantalla 1.
 */
type Flujo = {
  caso: Caso | null;
  fotos: Foto[];
  /** Imagen de cada foto aceptada (por id de Foto), para mandarla a leer la chapa. */
  imagenes: Record<string, ImagenB64>;
  ficha: Ficha | null;
  /** Feed de actividad: lo que devuelve cada ruta de la API. */
  eventos: Evento[];
  setCaso: (c: Caso | null) => void;
  agregarFoto: (f: Foto, imagen?: ImagenB64) => void;
  setFicha: (f: Ficha | null) => void;
  agregarEventos: (e: Evento[]) => void;
};

const Contexto = createContext<Flujo | null>(null);

export function ProveedorFlujo({ children }: { children: ReactNode }) {
  const [caso, setCaso] = useState<Caso | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [imagenes, setImagenes] = useState<Record<string, ImagenB64>>({});
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);

  return (
    <Contexto.Provider
      value={{
        caso,
        fotos,
        imagenes,
        ficha,
        eventos,
        setCaso: (c) => {
          // Un caso nuevo arranca de cero.
          if (c?.id !== caso?.id) {
            setFotos([]);
            setImagenes({});
            setFicha(null);
            setEventos([]);
          }
          setCaso(c);
          if (c) guardar({ caso: c });
        },
        agregarFoto: (f, imagen) => {
          setFotos((prev) => [...prev, f]);
          if (imagen && f.aceptada) setImagenes((prev) => ({ ...prev, [f.id]: imagen }));
          guardar({ fotos: [{ foto: f, imagen: f.aceptada ? imagen : undefined }] });
        },
        setFicha: (f) => {
          setFicha(f);
          if (f) guardar({ ficha: f });
        },
        agregarEventos: (e) => {
          setEventos((prev) => [...prev, ...e]);
          guardar({ eventos: e });
        },
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
