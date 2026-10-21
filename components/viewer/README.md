# components/viewer

Dueño: Iaio (desde el 21/10/2026; antes, Diego).

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
- **Piezas de Blender:** el visor lee `/models/piezas/indice.json` y baja solo las familias (GLB) de las formas que puede elegir para las piezas del plano, una vez cada una (`biblioteca.ts`, `formasPara`): la `formaBiblioteca` si la hay; si no, las variantes que deja el tipo de equipo y, con las medidas del plano, las que pueden quedar a un empate de la que menos se deforma (una notebook no baja la pantalla del reloj, #313). Arma cada pieza con su forma típica (ventilador, RAM, compresor, carcasa…). Si no carga en 4 s, usa las primitivas. `tipoEquipo` ayuda a elegir la variante. La precarga de «preparando» no tiene medidas: baja todas las que deja el tipo de equipo.
- **Origen visible:** las piezas con origen "estimada" o "plantilla" se dibujan con contorno punteado y más transparentes (resaltadas, un poco menos); las del manual, sólidas. Sin origen (planos viejos, fixtures), como siempre.
- **Piezas que llegan tarde:** si los GLB tardan más de 4 s, el visor arranca con primitivas y, cuando termina la descarga, las cambia por las piezas reales sin perder la cámara, el estado ni el paso en curso (`continuarAnimacion` en `escena.ts`, `siguienteBiblioteca` en `biblioteca.ts`).
- **Estilo ilustración técnica** (`escena.ts`): bordes en todas las piezas, luz de estudio sin descargas, sombras de contacto, materiales por tipo y detalles (aspas, chips, etiquetas).
- **Rayos X:** si el paso resalta piezas, esas quedan sólidas en `#E8590C` con brillo; el resto, gris translúcido. Las hijas de una pieza activa se ven normales.
- **Etiquetas** con línea guía para las piezas activas: número del manual + nombre (del knowledge pack, o el id si no hay).
- **Vista:** botón para alternar perspectiva / isométrica (cámara ortográfica).
- **Transiciones** con easing (`tween.ts`); el despiece es escalonado pieza por pieza (al armar, en orden inverso).
- **Rendimiento:** con `efectos="auto"` el bloom está prendido y se apaga solo si el equipo no sostiene ~30 fps (también congela las sombras). `onEfectos` avisa el estado.
- **Nunca negro** (`salud.ts`): antes de prender efectos se mira el WebGL del equipo (sin buffers de color flotante no hay bloom ni luz de entorno; en celulares, sin multisampling). Un vigía mira el centro de la imagen los primeros segundos: si queda negro, apaga los efectos y después la luz de entorno; si igual sigue negro, muestra un aviso con "Reintentar". Si el GLB rompe la escena, se arma con primitivas (`prepararEscenaSegura`). Si iOS pierde el contexto WebGL, el lienzo se rearma solo. Sin WebGL2, aviso en vez del lienzo.
- **Probar en el celular con `npm run dev`:** abrí la app por la IP de la Mac (ej. `http://10.x.x.x:3000`). `next.config.ts` permite las IPs de red de la máquina (`allowedDevOrigins`); sin eso, Next bloquea sus recursos de desarrollo y la página no arranca (3D negro). Si cambiás de red, reiniciá `npm run dev`.
- Semántica de acciones: ver `reproductor.ts`. Son **idempotentes** (repetir un paso no acumula). `camara` acepta `"general"` para ver todo.
- Página de prueba: `/lab/visor` (`npm run dev`).
- **Galería para el pitch:** `/lab/galeria` (`galeria/`): los 13 tipos de equipo que cubre la biblioteca con un plano de ejemplo cada uno (`ejemplos.ts`), en tarjetas que se abren en grande con "Despiezar". Fondo negro y títulos grandes (celular y proyector). Las tarjetas usan `controles={false}` (solo el 3D) y montan el visor solo cerca de la pantalla (pocos lienzos WebGL en el celular).
- **Vigía de pantalla negra** (`salud.ts`): mira una grilla de 5×5 puntos, no solo el centro (un televisor de frente tiene en el centro su pantalla apagada, que es negra de verdad). Al desmontar el visor, la pérdida de contexto no se toma como falla.

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
  onCambiarPieza={(pieza) => abrirCompras(pieza)} // cuando la IA dice que una pieza hay que cambiarla
  onEvento={agregarEvento}
/>
```

- Los pasos se muestran **en orden**: cada uno anima el 3D y se espera a que termine de decirse antes del siguiente. Una pregunta nueva corta la respuesta en curso.
- Bloqueo (riesgo alto): la derivación queda a la vista en rojo, el 3D vuelve al reposo y no se anima nada más.
- **Micrófono:** pasá lo transcripto en `preguntaDictada` con un `id` nuevo cada vez (ej. un contador). Se pregunta como si se hubiera escrito y corta la respuesta en curso.
- Ejemplo: `/lab/guia` (con `npm run dev`), con respuestas simuladas (sin gastar IA) o la API real.

- **Cambiar una pieza:** si un paso de `/api/chat` trae `cambiar: "<id de pieza>"`, `<GuiaExperto>` llama a `onCambiarPieza(id)`. Solo con ids del plano y nunca en un paso bloqueado. La pantalla 6 abre `<OpcionesCompra>` con esa pieza.
- **Llegó al último paso:** `onUltimoPaso(pasos)` se llama una vez por respuesta cuando terminó de decirse su último paso (no en un bloqueo, con un error ni si la persona preguntó otra cosa a mitad). Sirve para preguntar «¿Se resolvió?» en el momento justo. En `/lab/guia` se ve en el panel.
