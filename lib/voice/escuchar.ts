/**
 * Voz a texto en el navegador: ElevenLabs Scribe v2 Realtime con el micrófono y, si no está,
 * el reconocimiento del navegador (Web Speech API). Si no hay ninguno, se avisa: el campo
 * de texto siempre está. Lo que dice la persona son datos, nunca instrucciones.
 */

export type Escucha = { detener: () => void };

export type AlEscuchar = {
  /** Texto provisional mientras habla (para mostrarlo en vivo). */
  onParcial?: (texto: string) => void;
  /** Frase terminada (la persona hizo una pausa). */
  onFrase: (texto: string) => void;
  onError?: (mensaje: string) => void;
  /** Se cerró el micrófono (por detener() o por error). */
  onFin?: () => void;
};

export const SIN_MICROFONO = "No puedo usar el micrófono acá. Escribilo abajo.";

export async function escuchar(cb: AlEscuchar): Promise<Escucha> {
  try {
    return await escucharConScribe(cb);
  } catch (e) {
    console.warn("[voz] Scribe no disponible, uso el navegador:", e instanceof Error ? e.message : e);
    return escucharConNavegador(cb);
  }
}

async function escucharConScribe(cb: AlEscuchar): Promise<Escucha> {
  const res = await fetch("/api/voz/token", { method: "POST" });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const { token } = (await res.json()) as { token: string };
  const { Scribe, CommitStrategy, RealtimeEvents } = await import("@elevenlabs/client");

  const conexion = Scribe.connect({
    token,
    modelId: "scribe_v2_realtime",
    languageCode: "es",
    // Corta la frase sola cuando la persona hace una pausa.
    commitStrategy: CommitStrategy.VAD,
    vadSilenceThresholdSecs: 1.2,
    microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });

  let cerrado = false;
  const fin = () => {
    if (cerrado) return;
    cerrado = true;
    cb.onFin?.();
  };
  conexion.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (m) => cb.onParcial?.(m.text));
  conexion.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (m) => {
    if (m.text.trim()) cb.onFrase(m.text.trim());
  });
  for (const ev of [
    RealtimeEvents.ERROR,
    RealtimeEvents.AUTH_ERROR,
    RealtimeEvents.QUOTA_EXCEEDED,
  ] as const) {
    conexion.on(ev, (m) => {
      console.error("[voz] Scribe", ev, m.error);
      cb.onError?.("Se cortó el micrófono. Probá de nuevo o escribilo.");
    });
  }
  conexion.on(RealtimeEvents.CLOSE, fin);

  return {
    detener: () => {
      conexion.close();
      fin();
    },
  };
}

type Reconocedor = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function escucharConNavegador(cb: AlEscuchar): Escucha {
  const w = window as unknown as {
    SpeechRecognition?: new () => Reconocedor;
    webkitSpeechRecognition?: new () => Reconocedor;
  };
  const Clase = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Clase) {
    cb.onError?.(SIN_MICROFONO);
    cb.onFin?.();
    return { detener: () => {} };
  }
  const rec = new Clase();
  rec.lang = "es-AR";
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) cb.onFrase(r[0].transcript.trim());
      else cb.onParcial?.(r[0].transcript);
    }
  };
  rec.onerror = (e) => {
    if (e.error !== "no-speech" && e.error !== "aborted") cb.onError?.(SIN_MICROFONO);
  };
  rec.onend = () => cb.onFin?.();
  rec.start();
  return { detener: () => rec.stop() };
}
