"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Caso, Evento, Ficha, Foto, PedidoDeFoto } from "@/shared";
import type { Plano, Preparado } from "../_datos/api";
import { guardar } from "../_datos/guardar";
import type { ImagenB64 } from "../_datos/imagen";
import { guardarLocal, idDispositivo, type CasoGuardado, type Cierre } from "../_datos/mis-casos";

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
  /** Sin etiqueta: la foto es de otro lugar con el modelo (ej. "El control remoto"). */
  alternativa?: string;
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
  /** Cómo terminó el caso (resuelto / esperando repuesto / derivado). */
  cierre: Cierre | null;
  cerrarCaso: (c: Cierre) => void;
  /** Última compra que abrió la persona desde "Repuestos" (para "Pedí el repuesto"). */
  ultimaCompra: { pieza: string; url: string } | null;
  setUltimaCompra: (c: { pieza: string; url: string } | null) => void;
  /** Carga un caso de "Mis casos" tal como quedó, sin volver a llamar a la IA. */
  retomar: (c: CasoGuardado) => void;
  /** Deja todo en cero para empezar otro problema (el anterior ya quedó en "Mis casos"). */
  reiniciar: () => void;
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
  const [cierre, setCierre] = useState<Cierre | null>(null);
  const [ultimaCompra, setUltimaCompra] = useState<{ pieza: string; url: string } | null>(null);
  // Las pantallas llaman a los setters desde promesas que empezaron antes (ej. la guía y después el
  // plano): para guardar en "Mis casos" se usan siempre los valores más nuevos, no los de ese render.
  const ultimo = useRef({ caso, preparado, plano });
  useEffect(() => {
    ultimo.current = { caso, preparado, plano };
  }, [caso, preparado, plano]);

  return (
    <Contexto.Provider
      value={{
        caso,
        fotos,
        imagenes,
        ficha,
        eventos,
        preparado,
        setPreparado: (p) => {
          setPreparado(p);
          ultimo.current.preparado = p;
          // La guía y el plano se guardan juntos en "Mis casos" (para retomar sin IA).
          const { caso: c, plano: pl } = ultimo.current;
          if (c && p && pl) guardarLocal({ caso: c, guia: { preparado: p, plano: pl } });
        },
        plano,
        setPlano: (p) => {
          setPlano(p);
          ultimo.current.plano = p;
          const { caso: c, preparado: pr } = ultimo.current;
          if (c && p && pr) guardarLocal({ caso: c, guia: { preparado: pr, plano: p } });
        },
        captura,
        setCaptura,
        guiaIniciada,
        marcarGuiaIniciada: () => setGuiaIniciada(true),
        tipoEquipo,
        setCaso: (c, tipo) => {
          if (tipo !== undefined) setTipoEquipo(tipo);
          // En el mismo caso, si la persona cambió de equipo (volvió a la pantalla 1 y eligió otro),
          // las fotos, la ficha, la guía y el 3D eran del anterior: también arranca de cero (#229-4).
          const otroEquipo =
            !!c &&
            c.id === caso?.id &&
            ((tipo !== undefined && (tipo ?? "") !== (tipoEquipo ?? "")) || c.clase !== caso.clase);
          // Un caso nuevo arranca de cero.
          if (c?.id !== caso?.id || otroEquipo) {
            if (tipo === undefined) setTipoEquipo(null);
            setFotos([]);
            setImagenes({});
            setFicha(null);
            setEventos([]);
            setPreparado(null);
            setPlano(null);
            setCaptura(CAPTURA_VACIA);
            setGuiaIniciada(false);
            setCierre(null);
            setUltimaCompra(null);
          }
          setCaso(c);
          ultimo.current.caso = c;
          if (c) {
            const t = tipo !== undefined ? tipo : c.id === caso?.id ? tipoEquipo : null;
            guardarLocal({ caso: c, tipoEquipo: t });
            guardar({ caso: c, dispositivo: idDispositivo(), tipoEquipo: t });
          }
        },
        agregarFoto: (f, imagen) => {
          setFotos((prev) => [...prev, f]);
          if (imagen && f.aceptada) setImagenes((prev) => ({ ...prev, [f.id]: imagen }));
          guardar({ fotos: [{ foto: f, imagen: f.aceptada ? imagen : undefined }] });
        },
        setFicha: (f) => {
          setFicha(f);
          if (f) guardar({ ficha: f });
          if (f && ultimo.current.caso) guardarLocal({ caso: ultimo.current.caso, ficha: f });
        },
        agregarEventos: (e) => {
          setEventos((prev) => [...prev, ...e]);
          guardar({ eventos: e });
        },
        cierre,
        cerrarCaso: (c) => {
          setCierre(c);
          const actual = ultimo.current.caso;
          if (!actual) return;
          const cerrado = {
            ...actual,
            estado: c.estado === "esperando_repuesto" ? actual.estado : ("cerrado" as const),
          };
          setCaso(cerrado);
          guardarLocal({ caso: cerrado, cierre: c });
          guardar({ caso: cerrado, cierre: c, dispositivo: idDispositivo() });
        },
        ultimaCompra,
        setUltimaCompra,
        reiniciar: () => {
          setCaso(null);
          setTipoEquipo(null);
          setFotos([]);
          setImagenes({});
          setFicha(null);
          setEventos([]);
          setPreparado(null);
          setPlano(null);
          setCaptura(CAPTURA_VACIA);
          setGuiaIniciada(false);
          setCierre(null);
          setUltimaCompra(null);
          ultimo.current = { caso: null, preparado: null, plano: null };
        },
        retomar: (g) => {
          setCaso(g.caso);
          setTipoEquipo(g.tipoEquipo);
          setFicha(g.ficha);
          setPreparado(g.guia?.preparado ?? null);
          setPlano(g.guia?.plano ?? null);
          setCierre(g.cierre);
          setFotos([]);
          setImagenes({});
          setEventos([]);
          setCaptura(CAPTURA_VACIA);
          // Al retomar, la guía no repite la pregunta inicial (la pantalla decide si sigue desde un paso).
          setGuiaIniciada(true);
          setUltimaCompra(null);
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
