"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Caso, Evento, Ficha, Foto, PedidoDeFoto } from "@/shared";
import type { Plano, Preparado } from "../_datos/api";
import { guardar } from "../_datos/guardar";
import type { ImagenB64 } from "../_datos/imagen";

/**
 * Estado del recorrido en memoria del navegador. Cada cambio también se guarda en
 * Supabase en segundo plano (`guardar`); al recargar se vuelve a la pantalla 1.
 *
 * Todo lo que cuesta una llamada a la IA se guarda acá y no en la pantalla, así ir atrás
 * y adelante nunca la repite: solo un caso nuevo (o "Probar de nuevo") vuelve a llamar.
 */

/** Una foto pedida en la captura guiada: lo que se sacó y qué dijo el control de calidad. */
export type Toma = {
  url?: string;
  revisando: boolean;
  intentos: number;
  resultado?: Foto;
  salteada?: boolean;
  error?: string;
};

export type Captura = { pedidos: PedidoDeFoto[] | null; actual: number; tomas: Record<number, Toma> };
const CAPTURA_VACIA: Captura = { pedidos: null, actual: 0, tomas: {} };

type Flujo = {
  caso: Caso | null;
  fotos: Foto[];
  /** Imagen de cada foto aceptada (por id de Foto), para mandarla a leer la chapa. */
  imagenes: Record<string, ImagenB64>;
  ficha: Ficha | null;
  /** Feed de actividad: lo que devuelve cada ruta de la API. */
  eventos: Evento[];
  /** Guía del equipo armada en la pantalla 4 (pack, manual para /api/chat). */
  preparado: Preparado | null;
  setPreparado: (p: Preparado | null) => void;
  /** Plano 3D de las piezas (pantalla 4), lo que monta el visor. */
  plano: Plano | null;
  setPlano: (p: Plano | null) => void;
  /** Pantalla 2: fotos pedidas (Haiku), en cuál va y cómo salió cada una. */
  captura: Captura;
  setCaptura: (cambio: (c: Captura) => Captura) => void;
  /** La guía ya hizo la pregunta inicial (no repetirla al volver a la pantalla 5). */
  guiaIniciada: boolean;
  marcarGuiaIniciada: () => void;
  /** Qué equipo es, en texto libre (de /api/intake/entender, ej. "heladera no frost"). */
  tipoEquipo: string | null;
  /** `tipoEquipo` solo cambia si se pasa; un caso nuevo sin tipo lo borra. */
  setCaso: (c: Caso | null, tipoEquipo?: string | null) => void;
  agregarFoto: (f: Foto, imagen?: ImagenB64) => void;
  setFicha: (f: Ficha | null) => void;
  agregarEventos: (e: Evento[]) => void;
};

const Contexto = createContext<Flujo | null>(null);

export function ProveedorFlujo({ children }: { children: ReactNode }) {
  const [caso, setCaso] = useState<Caso | null>(null);
  const [tipoEquipo, setTipoEquipo] = useState<string | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [imagenes, setImagenes] = useState<Record<string, ImagenB64>>({});
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [preparado, setPreparado] = useState<Preparado | null>(null);
  const [plano, setPlano] = useState<Plano | null>(null);
  const [captura, setCaptura] = useState<Captura>(CAPTURA_VACIA);
  const [guiaIniciada, setGuiaIniciada] = useState(false);

  return (
    <Contexto.Provider
      value={{
        caso,
        fotos,
        imagenes,
        ficha,
        eventos,
        preparado,
        setPreparado,
        plano,
        setPlano,
        captura,
        setCaptura,
        guiaIniciada,
        marcarGuiaIniciada: () => setGuiaIniciada(true),
        tipoEquipo,
        setCaso: (c, tipo) => {
          if (tipo !== undefined) setTipoEquipo(tipo);
          // Un caso nuevo arranca de cero.
          if (c?.id !== caso?.id) {
            if (tipo === undefined) setTipoEquipo(null);
            setFotos([]);
            setImagenes({});
            setFicha(null);
            setEventos([]);
            setPreparado(null);
            setPlano(null);
            setCaptura(CAPTURA_VACIA);
            setGuiaIniciada(false);
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
