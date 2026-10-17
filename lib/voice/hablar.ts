/**
 * Texto a voz en el navegador: ElevenLabs vía /api/voz/hablar y, si no está, la voz del
 * navegador (speechSynthesis). Solo una voz a la vez: hablar de nuevo corta la anterior.
 *
 * iPhone/Safari solo deja sonar audio si la persona tocó algo en ese momento. Por eso hay un
 * único reproductor: `desbloquearAudio()` se llama en un toque (ej. "Ver al experto") y lo
 * habilita con un silencio; después ese mismo reproductor puede hablar solo.
 */

import { sinIA } from "../demo/modo";

export type Hablando = { detener: () => void; termino: Promise<void> };

/** Modo de prueba o demo (lib/demo/modo.ts): voz del navegador, no gasta ElevenLabs ni usa internet. Se mira en cada llamada. */
const SIN_ELEVENLABS = sinIA;

let actual: Hablando | null = null;
let reproductor: HTMLAudioElement | null = null;

function obtenerReproductor(): HTMLAudioElement {
  reproductor ??= new Audio();
  return reproductor;
}

/** Llamar dentro de un toque de la persona, antes de que el experto hable por su cuenta. */
export function desbloquearAudio() {
  if (typeof window === "undefined") return;
  const r = obtenerReproductor();
  if (!r.src || r.src.startsWith("data:")) {
    r.src = SILENCIO;
    r.play().catch(() => {}); // si ya estaba habilitado o no hace falta, no pasa nada
  }
  // La voz del navegador también necesita un primer toque en iOS.
  if (typeof speechSynthesis !== "undefined") speechSynthesis.speak(new SpeechSynthesisUtterance(""));
}

/** WAV de 0,05 s en silencio (8 kHz, 8 bits), para habilitar el reproductor sin que se oiga nada. */
const SILENCIO = (() => {
  const muestras = 400;
  const b = new Uint8Array(44 + muestras);
  const v = new DataView(b.buffer);
  const txt = (o: number, t: string) => [...t].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  txt(0, "RIFF");
  v.setUint32(4, 36 + muestras, true);
  txt(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  txt(36, "data");
  v.setUint32(40, muestras, true);
  b.fill(128, 44); // 128 = silencio en 8 bits
  let bin = "";
  b.forEach((x) => (bin += String.fromCharCode(x)));
  return `data:audio/wav;base64,${typeof btoa === "function" ? btoa(bin) : ""}`;
})();

export function callar() {
  actual?.detener();
  actual = null;
}

export function hablar(texto: string): Hablando {
  callar();
  const control = new AbortController();
  let audio: HTMLAudioElement | null = null;
  let detenido = false;

  const termino = (async () => {
    if (SIN_ELEVENLABS()) return hablarConNavegador(texto, () => detenido);
    try {
      const res = await fetch("/api/voz/hablar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
        signal: control.signal,
      });
      if (!res.ok) throw new Error(`hablar ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      if (detenido) return URL.revokeObjectURL(url);
      audio = obtenerReproductor();
      audio.src = url;
      await new Promise<void>((resolver, rechazar) => {
        audio!.onended = () => resolver();
        audio!.onpause = () => resolver(); // detener()
        audio!.onerror = () => rechazar(new Error("no se pudo reproducir"));
        audio!.play().catch(rechazar);
      });
      audio.onended = audio.onpause = audio.onerror = null;
      URL.revokeObjectURL(url);
    } catch (e) {
      if (detenido) return;
      console.warn(
        "[voz] ElevenLabs no disponible, uso la voz del navegador:",
        e instanceof Error ? e.message : e,
      );
      await hablarConNavegador(texto, () => detenido);
    }
  })();

  const yo: Hablando = {
    termino,
    detener: () => {
      detenido = true;
      control.abort();
      audio?.pause();
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    },
  };
  actual = yo;
  return yo;
}

function hablarConNavegador(texto: string, detenido: () => boolean): Promise<void> {
  if (typeof speechSynthesis === "undefined" || detenido()) return Promise.resolve();
  return new Promise((resolver) => {
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "es-AR";
    const voz = speechSynthesis.getVoices().find((v) => v.lang.startsWith("es"));
    if (voz) u.voice = voz;
    u.onend = () => resolver();
    u.onerror = () => resolver();
    speechSynthesis.speak(u);
  });
}
