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

## Generador desde el manual (B4) — `generador.ts`

`generarPlano({ casoId, knowledgePack, imagenes?, paginas? })` → `{ plano, avisos, origen }`. Ruta: `POST /api/plano`.

- **La IA interpreta:** con la vista explosionada / inferior del manual (imágenes) y la lista de piezas del knowledge pack, propone para cada pieza su **zona** en la planta (x, z de -1 a 1), su **capa** (`placa`, `sobre_placa`, `sobre_base`, `sobre_pieza`), su tamaño relativo, su número en el diagrama y la página. Modelo: `MODELOS.vision` de `lib/ia/claude.ts`, salida validada con Zod (un reintento).
- **El código calcula** (`planoDesdePropuesta`, pura y testeada): medidas en cm, alturas apilando capas, padres, límites dentro de la base y de su soporte, choques (coloca por capa y confianza; si choca, busca el lugar libre más cercano), tapa inferior encima de todo.
- **No se inventan piezas:** un id que no está en el knowledge pack se descarta. Lo que la IA no ubica sale de la plantilla. Todo queda en `avisos`.
- Las citas de posición quedan `NO_VERIFICABLE` (el código no puede verificar una ubicación en un diagrama).
- **Si la IA falla** dos veces → `origen: "plantilla"` (`planoDesdePlantilla`), nunca se corta el flujo.
- Prueba real (gasta créditos): `npx tsx --env-file=.env.local lib/planogenerator/probar-plano.ts [kp.json] [pagina.png …] --pag 54 --salida plano.json`, y pegá el JSON en `/lab/visor`.
- Evaluación con manuales reales (T480, E14 Gen 4, L14 Gen 2): ver `evaluacion/README.md`. Primera medición: IA 73 % vs plantilla 27 %.
