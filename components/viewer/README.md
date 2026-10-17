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
- **Piezas de Blender:** el visor carga `/models/piezas.glb` una vez (`biblioteca.ts`) y arma cada pieza con su forma típica (ventilador, RAM, SSD…). Si no carga en 4 s, usa las primitivas.
- **Estilo ilustración técnica** (`escena.ts`): bordes en todas las piezas, luz de estudio sin descargas, sombras de contacto, materiales por tipo y detalles (aspas, chips, etiquetas).
- **Rayos X:** si el paso resalta piezas, esas quedan sólidas en `#E8590C` con brillo; el resto, gris translúcido. Las hijas de una pieza activa se ven normales.
- **Etiquetas** con línea guía para las piezas activas: número del manual + nombre (del knowledge pack, o el id si no hay).
- **Vista:** botón para alternar perspectiva / isométrica (cámara ortográfica).
- **Transiciones** con easing (`tween.ts`); el despiece es escalonado pieza por pieza (al armar, en orden inverso).
- **Rendimiento:** con `efectos="auto"` el bloom está prendido y se apaga solo si el equipo no sostiene ~30 fps (también congela las sombras). `onEfectos` avisa el estado.
- Semántica de acciones: ver `reproductor.ts`. Son **idempotentes** (repetir un paso no acumula). `camara` acepta `"general"` para ver todo.
- Página de prueba: `/lab/visor` (`npm run dev`).

## `<GuiaExperto>` — pantallas 5 y 6 (B6)

Autocontenido: visor + stream de `/api/chat` + frase que aparece palabra por palabra y se desvanece al terminar + cita (`verificado` / `no verificado` / `NO VERIFICADO`) + aviso "Esquema genérico, no es tu modelo exacto" + caja para preguntar.

```tsx
import { GuiaExperto } from "@/components/viewer";

<GuiaExperto
  className="h-dvh"
  casoId={caso.id}
  pack={pack}                     // de /api/knowledge
  plano={plano}                   // de /api/plano
  origenPlano={origen}            // "ia" | "plantilla" (de /api/plano)
  manualFileId={manualFileId}     // de /api/knowledge
  preguntaInicial={caso.sintoma}  // arranca explicando solo
  decir={hablar}                  // C3: TTS; resolver cuando termina. Sin esto, tiempo de lectura.
  accesorioEntrada={<BotonMicrofono />}
  preguntaDictada={dictada}       // C3: { texto, id }; cada id nuevo se pregunta solo
  onEvento={agregarEvento}
/>
```

- Los pasos se muestran **en orden**: cada uno anima el 3D y se espera a que termine de decirse antes del siguiente. Una pregunta nueva corta la respuesta en curso.
- Bloqueo (riesgo alto): la derivación queda a la vista en rojo, el 3D vuelve al reposo y no se anima nada más.
- **Micrófono:** pasá lo transcripto en `preguntaDictada` con un `id` nuevo cada vez (ej. un contador). Se pregunta como si se hubiera escrito y corta la respuesta en curso.
- Ejemplo: `/lab/guia` (con `npm run dev`), con respuestas simuladas (sin gastar IA) o la API real.
