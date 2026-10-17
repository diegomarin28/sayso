# app/api/chat

Dueño: Juanma. Lógica en `lib/chat/`.

`POST { casoId, pack, manualFileId?, historial?: [{ rol: "persona"|"experto", texto }], pregunta, modo?: "auto"|"manual" }`
(`pack` y `manualFileId` salen de `/api/knowledge`)

Responde un **stream NDJSON** (una línea JSON por evento), frase por frase:

| Evento | Qué hacer |
|---|---|
| `{ tipo: "paso", coreografia }` | decir/mostrar `coreografia.dice`, pasar la `coreografia` al visor, mostrar la cita (`VERIFICADO p. N` o NO VERIFICADO si no hay `cita`) |
| `{ tipo: "buscando", texto }` | decir "Dejame buscarlo en el manual…" (lo que sigue tarda ~20 s) |
| `{ tipo: "bloqueo", coreografia }` | riesgo alto: decir la derivación al técnico; no vienen más pasos |
| `{ tipo: "fin" }` / `{ tipo: "error", mensaje }` | terminar / mostrar el error |

- Primero contesta con el knowledge pack (~2–4 s a la primera frase); si no alcanza, consulta el PDF completo con citas de la API.
- La pregunta pasa por `lib/safety` antes de llamar a la IA, y cada frase pasa por `filtrarCoreografia` antes de salir.
- Marcas que no corresponden a piezas del 3D se descartan.

Prueba real: `npx tsx --env-file=.env.local lib/chat/probar-chat.ts <pack.json fuera del repo> "Lenovo" "ThinkPad E14 Gen 2" "¿Dónde está el SSD?"`
