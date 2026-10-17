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
