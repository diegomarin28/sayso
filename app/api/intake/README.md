# app/api/intake

Dueño: Juanma

Captura guiada: decide qué foto pedir, controla calidad, lee la chapa. Usa los tipos de shared/.
La lógica está en `lib/intake/` y las llamadas a Claude en `lib/ia/claude.ts`.

Todas las rutas son `POST` con JSON y devuelven también `eventos: Evento[]` para el feed.
Las imágenes van en base64 (`{ base64, mediaType }`, máx. 5 MB; se acepta con o sin el prefijo `data:`).

| Ruta | Entrada | Salida |
|---|---|---|
| `/api/intake/entender` | `{ texto }` | `{ caso: Caso, tipoEquipo, bloqueo? }` — `tipoEquipo` en texto libre (cualquier dispositivo, ej. "heladera no frost") — Haiku saca clase y síntoma resumido; si falla, clase `otro` y el texto tal cual. `bloqueo.derivacion` si el texto es de riesgo alto (gas, batería hinchada...) |
| `/api/intake/pedidos` | `{ casoId, clase, sintoma, tipoEquipo? }` | `{ pedidos: PedidoDeFoto[] }` — Haiku arma de 2 a 5 fotos según el tipo de equipo (siempre etiqueta y frente); si falla, lista fija de la clase |
| `/api/intake/calidad` | `{ casoId, tipoPedido, imagen, url? }` | `{ foto: Foto }` — Sonnet mide nitidez/encuadre; el código acepta si nitidez ≥ 0.6, encuadre ok y muestra lo pedido |
| `/api/intake/chapa` | `{ casoId, clase, tipoEquipo?, imagenes: [0..3], imagenesFrente?: [0..2] }` (al menos una foto) | si la etiqueta no da el modelo, se reconoce por la foto del frente: marca/modelo `probable` con `fuente: "foto"` (la persona confirma). | `{ ficha: Ficha }` — `confirmado` solo si se leyó claro y aparece literal en la etiqueta; dudoso → `probable`; ausente → `desconocido` |

Errores: `400` entrada inválida, `502` la IA no respondió bien dos veces (mostrar "probá de nuevo").
