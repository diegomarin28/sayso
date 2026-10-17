import type Anthropic from "@anthropic-ai/sdk";
import { Accion } from "../../shared";

/**
 * El experto escribe frases con marcas de animación al principio:
 *   "[[camara:ssd|1.6]] [[resaltar:ssd]] El SSD está debajo de la tapa, a la izquierda."
 * Acá se corta el stream en frases completas y se convierten las marcas en
 * acciones validadas por Zod. Las marcas con piezas que no existen se descartan.
 */

const MARCA = /\[\[([^\]]*)\]\]/g;

export function parsearMarca(marca: string, piezas: ReadonlySet<string>): Accion | null {
  const [verbo, resto = ""] = marca.split(":").map((s) => s.trim());
  const args = resto.split("|").map((s) => s.trim());
  const pieza = args[0]?.toLowerCase();
  const existe = (p: string | undefined) => !!p && piezas.has(p);
  const num = (s: string | undefined) => (s === undefined || s === "" ? NaN : Number(s.replace(",", ".")));

  let crudo: unknown = null;
  switch (verbo?.toLowerCase()) {
    case "camara":
      if (pieza === "general" || existe(pieza)) {
        crudo = { t: "camara", objetivo: pieza, ...(Number.isFinite(num(args[1])) ? { zoom: num(args[1]) } : {}) };
      }
      break;
    case "resaltar":
    case "ocultar":
      if (existe(pieza)) crudo = { t: verbo.toLowerCase(), pieza };
      break;
    case "rotar":
      if (existe(pieza)) crudo = { t: "rotar", pieza, eje: args[1]?.toLowerCase(), grados: num(args[2]) };
      break;
    case "desplazar": {
      const vec = (args[1] ?? "").split(/[,\s]+/).filter(Boolean).map(Number);
      if (existe(pieza)) crudo = { t: "desplazar", pieza, vec };
      break;
    }
    case "despiezar":
      crudo = { t: "despiezar", cantidad: Math.min(1, Math.max(0, num(args[0]))) };
      break;
    case "restaurar":
      crudo = { t: "restaurar" };
      break;
  }
  const r = Accion.safeParse(crudo);
  return r.success ? r.data : null;
}

export type Segmento = {
  /** Texto para decir y mostrar, sin marcas. */
  texto: string;
  acciones: Accion[];
  citas: Anthropic.TextCitation[];
  /** Pasos del knowledge pack citados con [[paso:N]]. */
  pasos: number[];
};

/** Corta texto que llega de a pedazos en frases completas (fuera de las marcas). */
export class Segmentador {
  private buffer = "";
  private citas: Anthropic.TextCitation[] = [];
  private pendientes: Accion[] = [];
  private pasosPendientes: number[] = [];

  constructor(private readonly piezas: ReadonlySet<string>) {}

  /** Agrega texto; devuelve las frases que quedaron completas. */
  texto(delta: string): Segmento[] {
    this.buffer += delta;
    const listos: Segmento[] = [];
    for (;;) {
      const corte = this.buscarCorte();
      if (corte < 0) break;
      const frase = this.buffer.slice(0, corte);
      this.buffer = this.buffer.slice(corte);
      const s = this.armar(frase);
      if (s) listos.push(s);
    }
    return listos;
  }

  cita(c: Anthropic.TextCitation): void {
    this.citas.push(c);
  }

  /** Lo que quedó al terminar el stream. */
  cerrar(): Segmento[] {
    const s = this.armar(this.buffer, true);
    this.buffer = "";
    return s ? [s] : [];
  }

  /** Índice justo después de un fin de frase que está fuera de una marca, o -1. */
  private buscarCorte(): number {
    let dentro = false;
    for (let i = 0; i < this.buffer.length; i++) {
      if (this.buffer.startsWith("[[", i)) dentro = true;
      else if (this.buffer.startsWith("]]", i)) dentro = false;
      if (dentro) continue;
      const c = this.buffer[i];
      if (c === "\n") return i + 1;
      if (".!?…".includes(c)) {
        const sig = this.buffer[i + 1];
        if (sig === undefined) return -1; // todavía no sabemos si termina acá
        if (/\s/.test(sig)) return i + 1;
      }
    }
    return -1;
  }

  private armar(frase: string, final = false): Segmento | null {
    const acciones: Accion[] = this.pendientes;
    const pasos: number[] = this.pasosPendientes;
    for (const m of frase.matchAll(MARCA)) {
      const ref = /^paso\s*:\s*(\d+)$/i.exec(m[1].trim());
      if (ref) {
        pasos.push(Number(ref[1]));
        continue;
      }
      const a = parsearMarca(m[1], this.piezas);
      if (a) acciones.push(a);
    }
    const texto = frase.replace(MARCA, " ").replace(/\s+/g, " ").trim();
    if (!texto && !final) {
      // Marcas solas en un renglón: van con la próxima frase.
      this.pendientes = acciones;
      this.pasosPendientes = pasos;
      return null;
    }
    this.pendientes = [];
    this.pasosPendientes = [];
    if (!texto && acciones.length === 0) return null;
    const citas = this.citas;
    this.citas = [];
    return { texto, acciones, citas, pasos };
  }
}
