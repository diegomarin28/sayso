import type { Coreografia } from "../../../shared";
import type { EventoChat, MensajeHistorial } from "./eventos-chat";

/**
 * Reproduce una respuesta del experto, en orden: cada paso se muestra (y se anima) y se
 * espera a que termine de "decirse" antes del siguiente (ver `Reproductor`). Sin React: testeable.
 */
export type EstadoGuia = "esperando" | "pensando" | "buscando" | "hablando" | "bloqueado" | "error";

export type Manejadores = {
  estado: (e: EstadoGuia, detalle?: string) => void;
  /** Muestra la frase y manda la coreografía al visor. `indice`: número de paso en la respuesta. */
  paso: (c: Coreografia, bloqueo: boolean, indice: number) => void;
  /** Espera a que la frase termine (voz real o tiempo de lectura). */
  decir: (texto: string, senal: AbortSignal) => Promise<void>;
};

/** Tiempo para leer una frase si no hay voz: ~55 ms por letra, entre 2,5 y 9 s. */
export function tiempoDeLectura(texto: string): number {
  return Math.min(Math.max(texto.length * 55 + 1200, 2500), 9000);
}

export function esperar(ms: number, senal: AbortSignal): Promise<void> {
  return new Promise((resolver) => {
    if (senal.aborted) return resolver();
    const t = setTimeout(resolver, ms);
    senal.addEventListener("abort", () => (clearTimeout(t), resolver()), { once: true });
  });
}

/** Cómo pasa de un paso al siguiente: "manual" espera que la persona toque Siguiente. */
export type ModoAvance = "manual" | "auto";

/** Lo que necesitan los botones de la guía. */
export type EstadoControles = {
  /** Paso que se está mostrando (-1: todavía ninguno). */
  indice: number;
  /** Pasos recibidos hasta ahora. */
  total: number;
  /** Ya llegaron todos los pasos de la respuesta. */
  completa: boolean;
  pausado: boolean;
  modo: ModoAvance;
  /** Terminó de decir el paso y espera "Siguiente" (o que llegue el próximo paso). */
  esperando: boolean;
  hayAnterior: boolean;
  haySiguiente: boolean;
};

type Recibido = { c: Coreografia; bloqueo: boolean };

/**
 * Reproduce una respuesta del experto con controles: pausar / seguir, paso anterior y siguiente.
 * - Lee la respuesta entera apenas llega (no deja el pedido al servidor abierto mientras la
 *   persona mira un paso) y la reproduce en orden desde esa cola.
 * - El primer paso arranca solo. Entre pasos, en modo "manual" espera "Siguiente"; en "auto",
 *   sigue solo (salvo que esté pausado). El último paso no espera nada.
 * - Pausar corta la voz (aborta la señal de `decir`); Seguir repite la frase desde el principio.
 * - Anterior / Siguiente / irA saltan a un paso ya recibido sin cancelar la respuesta.
 * - Después de un bloqueo no se muestran más pasos. Sin React: testeable.
 */
export class Reproductor {
  private pasos: Recibido[] = [];
  private fin = false;
  private aviso: string | undefined;
  private error: { mensaje?: string; excepcion?: unknown } | null = null;
  private indice = -1;
  private pausado = false;
  private esperando = false;
  private quiereSiguiente = false;
  private salto: number | null = null;
  private activo = false;
  private voz: AbortController | null = null;
  private despertar: (() => void)[] = [];
  private m: Manejadores | null = null;
  private senal: AbortSignal | null = null;
  private modo: ModoAvance;
  private readonly alCambiar?: (e: EstadoControles) => void;

  constructor(o: { modo?: ModoAvance; alCambiar?: (e: EstadoControles) => void } = {}) {
    this.modo = o.modo ?? "manual";
    this.alCambiar = o.alCambiar;
  }

  controles(): EstadoControles {
    const bloqueado = this.pasos[this.indice]?.bloqueo ?? false;
    return {
      indice: this.indice,
      total: this.pasos.length,
      completa: this.fin,
      pausado: this.pausado,
      modo: this.modo,
      esperando: this.esperando,
      hayAnterior: this.indice > 0,
      haySiguiente: !bloqueado && (this.indice + 1 < this.pasos.length || (!this.fin && this.indice >= 0)),
    };
  }

  // ---------- Acciones de la persona ----------

  siguiente(): void {
    if (this.indice + 1 < this.pasos.length) this.irA(this.indice + 1);
    else if (!this.fin) {
      this.quiereSiguiente = true; // todavía no llegó: se muestra apenas llegue
      this.avisar();
    }
  }

  anterior(): void {
    if (this.indice > 0) this.irA(this.indice - 1);
  }

  /** Muestra y dice el paso `i` (ya recibido). */
  irA(i: number): void {
    if (i < 0 || i >= this.pasos.length) return;
    if (this.activo) {
      this.salto = i;
      this.voz?.abort(); // corta la frase actual
      this.avisar();
    } else if (this.m && this.senal && !this.senal.aborted) {
      // La respuesta ya terminó: se repite ese paso solo y queda esperando.
      const { m, senal } = this;
      void this.mostrar(i, m, senal).then((bloqueo) => {
        if (!senal.aborted && this.indice === i) m.estado(bloqueo ? "bloqueado" : "esperando");
      });
    }
  }

  pausar(): void {
    if (this.pausado) return;
    this.pausado = true;
    this.voz?.abort(); // corta la voz; Seguir repite la frase
    this.avisar();
  }

  seguir(): void {
    if (!this.pausado) return;
    this.pausado = false;
    this.avisar();
  }

  cambiarModo(modo: ModoAvance): void {
    this.modo = modo;
    this.avisar();
  }

  // ---------- Reproducción ----------

  /** Devuelve lo que dijo el experto (para el historial): todos los pasos recibidos. */
  async reproducir(eventos: AsyncIterable<EventoChat>, m: Manejadores, senal: AbortSignal): Promise<MensajeHistorial | null> {
    this.m = m;
    this.senal = senal;
    this.activo = true;
    senal.addEventListener("abort", () => this.avisar(), { once: true });
    m.estado("pensando");
    void this.leer(eventos, senal);

    let objetivo = 0;
    let final: EstadoGuia = "esperando";
    for (;;) {
      // Esperar a que llegue el paso (o el fin de la respuesta). El estado se avisa solo si cambia.
      let avisado = objetivo === 0 ? "pensando" : ""; // al arrancar ya se avisó "pensando"
      while (!senal.aborted && this.pasos.length <= objetivo && !this.fin && this.salto === null) {
        const ahora = this.aviso ? `buscando:${this.aviso}` : "pensando";
        if (ahora !== avisado) m.estado(this.aviso ? "buscando" : "pensando", this.aviso);
        avisado = ahora;
        await this.cambio(senal);
      }
      if (senal.aborted) break;
      if (this.salto !== null) {
        objetivo = this.tomarSalto();
        continue;
      }
      if (this.pasos.length <= objetivo) break; // no hay más

      const bloqueo = await this.mostrar(objetivo, m, senal);
      if (senal.aborted) break;
      if (this.salto !== null) {
        objetivo = this.tomarSalto();
        continue;
      }
      if (bloqueo) {
        final = "bloqueado";
        break; // después de un bloqueo no vienen más pasos
      }
      if (this.fin && objetivo + 1 >= this.pasos.length) break; // era el último: no espera nada

      // Entre pasos: manual espera "Siguiente"; auto sigue solo (salvo pausado).
      this.esperando = true;
      this.avisar();
      while (!senal.aborted && this.salto === null && !this.quiereSiguiente && !(this.modo === "auto" && !this.pausado)) {
        await this.cambio(senal);
      }
      this.esperando = false;
      this.quiereSiguiente = false;
      if (senal.aborted) break;
      objetivo = this.salto !== null ? this.tomarSalto() : objetivo + 1;
    }
    this.activo = false;
    this.avisar();
    if (this.error?.excepcion !== undefined && !senal.aborted) throw this.error.excepcion;
    if (this.error?.mensaje !== undefined && !senal.aborted && final !== "bloqueado") {
      m.estado("error", this.error.mensaje);
    } else if (!senal.aborted) {
      m.estado(final);
    }
    return this.pasos.length ? { rol: "experto", texto: this.pasos.map((p) => p.c.dice).join(" ") } : null;
  }

  /** Lee toda la respuesta en la cola. */
  private async leer(eventos: AsyncIterable<EventoChat>, senal: AbortSignal) {
    try {
      for await (const ev of eventos) {
        if (senal.aborted) break;
        if (ev.tipo === "buscando") this.aviso = ev.texto;
        else if (ev.tipo === "paso" || ev.tipo === "bloqueo") {
          this.pasos.push({ c: ev.coreografia, bloqueo: ev.tipo === "bloqueo" });
          if (ev.tipo === "bloqueo") break;
        } else if (ev.tipo === "error") {
          this.error = { mensaje: ev.mensaje };
          break;
        } else break; // fin
        this.avisar();
      }
    } catch (e) {
      this.error = { excepcion: e };
    }
    this.fin = true;
    this.avisar();
  }

  /** Muestra el paso y lo dice; si se pausa, espera y lo repite. Devuelve si es un bloqueo. */
  private async mostrar(i: number, m: Manejadores, senal: AbortSignal): Promise<boolean> {
    const { c, bloqueo } = this.pasos[i];
    this.indice = i;
    m.estado(bloqueo ? "bloqueado" : "hablando");
    m.paso(c, bloqueo, i);
    this.avisar();
    for (;;) {
      const voz = new AbortController();
      this.voz = voz;
      const cortar = () => voz.abort();
      senal.addEventListener("abort", cortar, { once: true });
      await m.decir(c.dice, voz.signal);
      senal.removeEventListener("abort", cortar);
      this.voz = null;
      if (senal.aborted || this.salto !== null || !this.pausado) break;
      // Pausado: espera Seguir (o un salto) y repite la frase desde el principio.
      while (this.pausado && this.salto === null && !senal.aborted) await this.cambio(senal);
      if (senal.aborted || this.salto !== null) break;
    }
    return bloqueo;
  }

  private tomarSalto(): number {
    const s = this.salto!;
    this.salto = null;
    return s;
  }

  private cambio(senal: AbortSignal): Promise<void> {
    return new Promise((r) => {
      if (senal.aborted) return r();
      this.despertar.push(r);
    });
  }

  private avisar() {
    const d = this.despertar;
    this.despertar = [];
    d.forEach((r) => r());
    this.alCambiar?.(this.controles());
  }
}

/** Reproduce una respuesta entera en modo automático (sin controles). Devuelve lo que dijo el experto. */
export function reproducir(eventos: AsyncIterable<EventoChat>, m: Manejadores, senal: AbortSignal): Promise<MensajeHistorial | null> {
  return new Reproductor({ modo: "auto" }).reproducir(eventos, m, senal);
}
