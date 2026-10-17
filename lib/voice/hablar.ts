/**
 * Texto a voz en el navegador: ElevenLabs vía /api/voz/hablar y, si no está, la voz del
 * navegador (speechSynthesis). Solo una voz a la vez: hablar de nuevo corta la anterior.
 */

export type Hablando = { detener: () => void; termino: Promise<void> };

let actual: Hablando | null = null;

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
      audio = new Audio(url);
      await new Promise<void>((resolver, rechazar) => {
        audio!.onended = () => resolver();
        audio!.onpause = () => resolver(); // detener()
        audio!.onerror = () => rechazar(new Error("no se pudo reproducir"));
        audio!.play().catch(rechazar);
      });
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
