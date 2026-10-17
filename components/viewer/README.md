# components/viewer

Dueño: Diego

Visor 3D y reproductor de coreografía (React Three Fiber).

## Uso

```tsx
import { Visor } from "@/components/viewer";

<Visor
  plano={plano}                    // PlanoDePiezas (plantilla o el que genera la IA)
  coreografia={paso}               // cada objeto nuevo se reproduce; null = quieto
  piezas={knowledgePack.piezas}    // nombres para las etiquetas (opcional)
  casoId={caso.id}
  onEvento={(e) => feed.push(e)}   // "pieza_desconocida", "paso_bloqueado", "plano_corregido"
  onPaso={(p) => setSubtitulo(p.coreografia.dice)} // texto YA filtrado por seguridad
  efectos="auto"                   // "auto" | "si" | "no"
  className="h-[60vh] w-full"
/>
```

- **Seguridad:** toda coreografía pasa por `filtrarCoreografia` (lib/safety) antes de animarse (`paso.ts`). Si es de riesgo alto no se anima (solo `restaurar`) y `onPaso` trae la derivación en vez del texto de la IA. Mostrá siempre `onPaso(...).coreografia.dice`, no el original.
- **Estilo ilustración técnica** (`escena.ts`): bordes en todas las piezas, luz de estudio sin descargas, sombras de contacto, materiales por tipo y detalles (aspas, chips, etiquetas).
- **Rayos X:** si el paso resalta piezas, esas quedan sólidas en `#E8590C` con brillo; el resto, gris translúcido. Las hijas de una pieza activa se ven normales.
- **Etiquetas** con línea guía para las piezas activas: número del manual + nombre (del knowledge pack, o el id si no hay).
- **Vista:** botón para alternar perspectiva / isométrica (cámara ortográfica).
- **Transiciones** con easing (`tween.ts`); el despiece es escalonado pieza por pieza (al armar, en orden inverso).
- **Rendimiento:** con `efectos="auto"` el bloom está prendido y se apaga solo si el equipo no sostiene ~30 fps (también congela las sombras). `onEfectos` avisa el estado.
- Semántica de acciones: ver `reproductor.ts`. Son **idempotentes** (repetir un paso no acumula). `camara` acepta `"general"` para ver todo.
- Página de prueba: `/lab/visor` (`npm run dev`).
