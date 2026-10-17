# components/viewer

Dueño: Diego

Visor 3D y reproductor de coreografía (React Three Fiber).

## Uso

```tsx
import { Visor } from "@/components/viewer";

<Visor
  plano={plano}                 // PlanoDePiezas (plantilla o el que genera la IA)
  coreografia={paso}            // cada objeto nuevo se reproduce; null = quieto
  casoId={caso.id}
  onEvento={(e) => feed.push(e)} // ej. "pieza_desconocida"
  className="h-[60vh] w-full"
/>
```

- Fondo negro, giro con el dedo/mouse, zoom con pellizco/rueda.
- Las acciones de un paso se aplican en secuencia (450 ms entre cada una) con suavizado.
- Semántica de acciones: ver `reproductor.ts`. Son **idempotentes** (repetir un paso no acumula). `camara` acepta `"general"` para ver todo.
- Si la coreografía nombra una pieza que no está en el plano, se ignora y se emite un `Evento` (`agente: "cartografo"`, `tipo: "pieza_desconocida"`).
- Página de prueba: `/lab/visor` (`npm run dev`).
