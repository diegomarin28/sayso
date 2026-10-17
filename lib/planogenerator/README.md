# lib/planogenerator

Dueño: Diego

Construye la escena 3D (three.js) a partir de un `PlanoDePiezas` (`shared/`).
La misma función sirve para la plantilla fija (MVP) y para el plano que genera la IA desde el manual (B4).

```ts
import { construirEscena, planoNotebookBase } from "@/lib/planogenerator";
const { raiz, nodos, avisos } = construirEscena(planoNotebookBase);
```

## Convención de coordenadas (unidades: cm)

- x a la derecha, y hacia arriba, z hacia el frente (donde está la persona).
- `pos`: **centro** de la pieza en coordenadas del **mundo** (no relativo al padre).
- `pivote`: punto de giro, **relativo al centro** de la pieza.
- `padre`: solo jerarquía. Si el padre se mueve, el hijo lo acompaña.
- `dim`: ancho (x), alto (y), profundidad (z). En `cilindro`, el eje es y.

## Estructura de la escena

- `raiz` (`Group` "plano") → un `Group` por pieza, con `name` = id de la pieza, ubicado en su pivote. Ese es el nodo que anima el reproductor.
- Dentro de cada nodo, una `Mesh` llamada `<id>__malla` y los nodos de las piezas hijas.
- `userData` del nodo: `{ pieza, dim, centro, etiquetaManual, cita }`.
- El plano se tolera con errores: ids repetidos, padres que no existen o ciclos se resuelven colgando de la raíz y quedan en `avisos`.

## Plantillas

- `plantillas/notebook.ts`: notebook genérica, esquemática, vista desde abajo con la tapa inferior translúcida (se abre como bisagra desde el borde trasero).

## Generador desde el manual (B4) — `generador.ts`, `obtener.ts`, `cache.ts`

`POST /api/plano { casoId, knowledgePack, ficha?, manualFileId?, manualUrl?, paginasVistaExplosionada?, imagenes?, paginas? }`
→ `{ plano, origen: "ia" | "plantilla", desdeCache, avisos, eventos }`

- **Flujo en la pantalla 4:** `/api/knowledge` devuelve `manualFileId` y `paginasVistaExplosionada`; se pasan tal cual a `/api/plano` junto con el pack y la ficha. Después, el mismo `plano` va al `<Visor>` y a `/api/chat` (el chat solo usa ids de ese plano).
- **La IA interpreta:** lee el manual completo por `file_id` (sin renderizar páginas), identifica las piezas con la vista explosionada y las ubica con las ilustraciones del interior que busca ella misma. Propone zona, capa, tamaño relativo, n.º del diagrama y página. Modelo `MODELOS.vision`, salida validada con Zod (un reintento).
- **El código calcula** (`planoDesdePropuesta`, pura y testeada): medidas en cm, alturas por capas, padres, límites, choques (lugar libre más cercano por confianza), tapa inferior. Descarta ids fuera del pack y completa con la plantilla; todo queda en `avisos`. Citas de posición: `NO_VERIFICABLE`.
- **Caché** (`cache.ts`, tabla `planos`, migración `lib/supabase/migraciones/004_planos.sql`): un plano por marca + modelo (misma clave que la tabla `manuales`). Se reusa si al generarlo ya se pidieron todas las piezas del pack actual. La plantilla genérica nunca se guarda. Sin Supabase, caché en memoria.
- **Si la IA falla** → `origen: "plantilla"`: la pantalla tiene que mostrar "esquema genérico, no es tu modelo exacto".
- Medición (3 manuales de prueba, escala 0–2): leyendo el PDF completo 65 % (1 corrida por manual); con imágenes recortadas 60 % (58–62, 3 corridas); plantilla sin IA 27 %.
- Evaluación contra manuales reales (casos locales, fuera del repo): ver `evaluacion/README.md`.
