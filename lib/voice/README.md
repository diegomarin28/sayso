# lib/voice

Dueño: Iaio

Voz del experto. La clave de ElevenLabs vive solo en el servidor; sin ella todo sigue andando con la voz del navegador, y el campo de texto siempre está.

| Archivo | Dónde corre | Qué hace |
|---|---|---|
| `elevenlabs.ts` | servidor | token de un solo uso para Scribe y texto a voz en streaming (Flash v2.5, español). Sin `ELEVENLABS_API_KEY` → `ErrorVoz` 503 |
| `hablar.ts` | navegador | `hablar(texto)` → `{ detener, termino }`. ElevenLabs vía `/api/voz/hablar`; si falla, `speechSynthesis`. Una voz a la vez; `callar()` corta |
| `escuchar.ts` | navegador | `escuchar({ onParcial, onFrase, onError, onFin })` → `{ detener }`. Scribe v2 Realtime con el micrófono (corta la frase sola con las pausas); si falla, Web Speech API |
| `useDictado.ts` | navegador | hook para un campo de texto: `alternar`, `escuchando`, `parcial`, `error` |

Rutas: `POST /api/voz/token` → `{ token }` · `POST /api/voz/hablar { texto }` → `audio/mpeg`.

Variables: `ELEVENLABS_API_KEY` (obligatoria para ElevenLabs) y `ELEVENLABS_VOICE_ID` (opcional, para cambiar la voz).

Lo que dice la persona es un dato, nunca una instrucción: se trata igual que el texto escrito.
