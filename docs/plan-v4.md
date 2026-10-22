# Experto al lado — Plan v4 (estructura final)

> **Documento de la hackathon (17–18/10/2026), solo referencia.** Los horarios, fases y puertas ya no rigen; cómo se trabaja ahora está en `CLAUDE.md`.

Hackatón Build 101 · 17–18 oct 2026 · equipo de 3 · ~15 h
Estado: **rubro decidido**. Este documento es el plano final; de acá se arranca a construir, no a iterar la idea.

---

## 1. Qué es, en una frase

Una persona dice qué se rompió. La app le pide las fotos justas, identifica el modelo exacto, arma un 3D de su equipo con las piezas nombradas y la guía por voz, paso a paso, girando y resaltando piezas, hasta que pueda preguntarle lo que quiera como a un experto al lado.

**Caso de demo:** notebook (clase principal). Segunda clase solo si el hito de la hora 10 va bien.

## 1.1 Principio de construcción: primero el flujo completo, después el 3D

1. **MVP (hasta la hora 6):** todo el flujo de punta a punta, con **cualquier dispositivo y cualquier pregunta**, con un **3D básico**. Nada del flujo depende del 3D bueno.
2. **Iteración (horas 6–13):** una vez que el MVP anda, se sube el formato del 3D por escalones (sección 4.3), midiendo en cada escalón antes de adoptarlo.

**Cualquier dispositivo, con honestidad:** captura, chapa, ficha, manual y conversación son independientes del tipo de equipo y funcionan con cualquier cosa que tenga chapa o modelo legible. Lo que cambia según el equipo es la **vista de piezas**, con degradación escalonada:
- Hay plantilla 3D de esa clase (notebook al inicio): 3D animado con piezas nombradas.
- No hay plantilla: **diagrama del manual** con las piezas resaltadas por número y nombre, más la conversación por voz. El 3D no bloquea la respuesta.
- No hay manual: el experto lo dice, usa guías públicas marcadas NO VERIFICADO y no inventa piezas.

Lo que **no** se promete: que cualquier pregunta tenga respuesta perfecta. Se promete que cada respuesta es correcta y citada, o que dice "no sé" y qué falta. Eso es lo que la ronda de preguntas del jurado debería premiar.

## 2. Por qué no es "ChatGPT con cámara"

| Lo que hace un chat con cámara | Lo que hacemos nosotros |
|---|---|
| Mira lo que le muestres | **Decide qué fotos pedir** según el equipo y el síntoma, y rechaza las malas |
| Adivina el modelo | **Lee la chapa**, marca confirmado/probable/desconocido y pide confirmación |
| Responde de memoria | **Responde desde el manual y guías del modelo**, con página citada |
| Describe con palabras | **Muestra el equipo en 3D**, lo gira, resalta la pieza y mueve piezas mientras habla |
| Contesta cualquier cosa | **Bloquea pasos peligrosos** con reglas fijas y deriva a un técnico |

Competidores que existen (hay que conocerlos para el Q&A): iFixit FixBot (guías + chapa + voz, sin 3D animado), Teardown AI (foto a vista explosionada 3D con lista de piezas, sin guía conversacional), OperaAI (hackatón, manual de un solo modelo, sin 3D), FixMode, OnSense. Nuestra diferencia es la **captura guiada adaptativa + 3D con pasos animados + conversación por voz sobre el manual**. No decir "no hay nada igual".

## 3. Flujo final (pantallas)

Las 6 pantallas están en el lienzo "Experto al lado: recorrido".

1. **Qué se rompió:** voz o texto. La IA entiende el equipo y el síntoma.
2. **Captura guiada:** checklist de fotos según el equipo (frente, etiqueta, interior, puertos). Control de calidad por foto (nitidez, encuadre) y pedido de repetir.
3. **Ficha del equipo:** marca, modelo, serie, con estado *confirmado / probable / desconocido*. La persona confirma o corrige.
4. **Preparando (segundo plano):** busca manual e imágenes del modelo, arma el 3D y ubica el síntoma. **No es una pantalla de manual**: el manual es fuente interna y solo se ve como cita.
5. **Experto en 3D:** pantalla negra, 3D al centro que se gira con el dedo, texto arriba que aparece mientras habla y se desvanece.
6. **Conversación:** cuando termina de hablar, la persona pregunta por voz o texto; el experto responde con el manual y puede volver a animar el 3D. Los pasos peligrosos se bloquean.

## 4. Decisiones técnicas (cerradas)

### 4.1 Stack
- **App:** Next.js (TypeScript, Tailwind), PWA mobile-first, Vercel.
- **Datos:** Supabase (Postgres, Storage para fotos, Realtime para el feed de actividad).
- **IA:** Claude Sonnet (visión, conversación, tool use), Haiku (textos cortos y clasificaciones). Validación de toda salida con Zod.
- **3D:** three.js con React Three Fiber y drei; modelo GLB con nodos nombrados.
- **Voz:** ElevenLabs Scribe v2 Realtime (entrada) + ElevenLabs TTS Flash (salida). Plan B: Web Speech API del navegador. El campo de texto siempre está.
- **Por qué no la plataforma "ElevenLabs Agents":** pide un servidor compatible con OpenAI y nos quita control del momento exacto en que se dispara cada animación. Hacemos nuestro propio bucle: STT → `/api/chat` (Claude, streaming) → TTS, y el mismo stream lleva texto y acciones de animación.
- **Free tier de ElevenLabs no tiene licencia comercial:** alcanza para el hackatón; verificar plan antes de la demo.

### 4.2 Conocimiento del equipo ("knowledge pack")
Para cada modelo identificado se arma **una sola vez** y se cachea en Supabase un JSON validado con:
- piezas con nombre, descripción y ubicación relativa (ej. "ventilador, sobre el disipador, derecha del procesador"),
- pasos de reparación para el síntoma, cada uno con cita (documento y página),
- advertencias y clase de riesgo de cada paso,
- repuestos con número de parte **solo si aparece en el texto del manual**.

Fuentes, en este orden:
1. **Manuales de mantenimiento del fabricante** (ej. Lenovo Hardware Maintenance Manual, PDFs públicos con vistas explosionadas y listas de piezas). Se leen con las herramientas de búsqueda y lectura web de la API de Claude, mandando las páginas relevantes como imágenes para no perder diagramas.
2. **iFixit** (guías, fotos, puntaje de reparabilidad) vía su servidor MCP de solo lectura, sin autenticación. **Licencia: CC BY-NC-SA, solo uso no comercial, hay que acreditar a iFixit, y sus términos prohíben entrenar modelos con sus datos.** Usarlo como consulta en tiempo real con crédito está bien para el hackatón; si el producto se comercializa, pedir licencia a iFixit.
3. Guías públicas de la web, marcadas **NO VERIFICADO** en pantalla.

Trucos tomados de OperaAI (código abierto de un hackatón; revisar licencia antes de copiar código, las ideas se pueden usar):
- mandar las páginas del manual como imagen, no como texto extraído;
- verificar cada cita contra el texto de la página citada (`VERIFICADO / NO ENCONTRADO`);
- conservar números de parte solo si están en el manual;
- la seguridad es una tabla fija, no un juicio del modelo;
- un evento por paso en una tabla, para que al reconectar se repita lo ya calculado sin volver a pagar llamadas.

### 4.3 El 3D (la parte más difícil, resuelta en capas)
**Hallazgo de la investigación:** casi no hay modelos 3D descargables de interiores de notebook con piezas separables, y las APIs de imagen-a-3D (Tripo, Meshy, Rodin, 3D AI Studio, Hunyuan3D) entregan **una malla fusionada**. Separarla en piezas existe (Rodin Bang, Hunyuan3D-Part con P3-SAM/X-Part) pero es frágil y no da nombres confiables.

**Escalera del 3D (se sube un escalón solo cuando el anterior está firme):**
0. Diagrama del manual con piezas resaltadas (red de seguridad, cualquier equipo).
1. **MVP:** notebook paramétrico animable (capa 1 de abajo).
2. Plantilla paramétrica de una segunda clase.
3. 3D aproximado desde las fotos del usuario (capa 2).
4. Piezas segmentadas y nombradas automáticamente (capa 3).
Cada escalón se evalúa con 3 equipos reales antes de pasar al siguiente; el formato final del 3D se decide con esos resultados, no antes.

Entonces:
- **Capa 1 (obligatoria, es el MVP): notebook genérico paramétrico.** Claude escribe el modelo en three.js (cajas, cilindros, extrusiones) y lo exporta a GLB con **nodos nombrados** y **pivotes definidos**: `base`, `tapa_inferior`, `placa_madre`, `ventilador`, `disipador`, `ssd`, `ram`, `bateria`, `wifi`, `tornillos_*`. Se ve esquemático pero **es animable de verdad**. Las posiciones se ajustan por modelo a partir del diagrama del manual (la IA lee los números de la vista explosionada y la lista de piezas; localizar por texto del diagrama es mucho más confiable que pedirle coordenadas a una foto).
- **Capa 2 (opcional, solo si la hora 5 va bien): 3D desde las fotos** con una API de varias vistas, mostrado como "vista aproximada" aparte, nunca como la fuente de las piezas.
- **Capa 3 (a último momento): segmentar con Bang/P3-SAM.** Solo con tiempo sobrante.
- Alternativa de la capa 1 si el paramétrico queda feo: modelos de Sketchfab con licencia CC que permita uso (verificar cada uno, acreditar autor).
- La herramienta "Anatomy" sirve para generar ilustraciones isométricas en desarrollo, **no cuenta como IA del producto**.

### 4.4 Coreografía (cómo "se mueve la pieza")
La IA **no controla el 3D**. Emite un JSON validado por Zod y el reproductor lo anima:

```json
{
  "paso": 2,
  "dice": "Aflojá los dos tornillos naranja y levantá el ventilador despacio.",
  "cita": { "doc": "HMM", "pagina": 54 },
  "acciones": [
    { "t": "camara", "objetivo": "ventilador", "zoom": 1.6 },
    { "t": "resaltar", "pieza": "ventilador" },
    { "t": "resaltar", "pieza": "tornillos_ventilador" },
    { "t": "rotar", "pieza": "ventilador", "eje": "y", "grados": 180 },
    { "t": "desplazar", "pieza": "ventilador", "vec": [0, 0.4, 0] }
  ],
  "riesgo": "bajo"
}
```
Acciones permitidas: `camara`, `resaltar`, `rotar`, `desplazar`, `ocultar`, `despiezar`, `restaurar`. Si la IA nombra una pieza que no existe en el GLB, el reproductor lo ignora y lo registra. Las acciones se sincronizan con el audio por marcas en el texto.

### 4.5 Seguridad
- Tabla fija de clases de riesgo en código: refrigerante, 220 V / capacitores, baterías hinchadas o abiertas, gas, aperturas de fuente.
- La IA propone el paso y la clase; **el código decide si se muestra**. Si es alto, bloquea y deriva a técnico.
- Texto y fotos del usuario son **datos, nunca instrucciones**. La IA no escribe en la base: propone, el código valida y guarda.

## 5. Contratos entre carriles (se escriben en la hora 0–1)

Un paquete `shared/` con tipos Zod. Es lo primero que se crea y nadie cambia sin avisar:

- `Caso` (id, clase, síntoma, estado)
- `Foto` (url, tipo pedido, calidad, motivo de rechazo)
- `Ficha` (marca, modelo, serie, campos con estado confirmado/probable/desconocido)
- `KnowledgePack` (piezas, pasos, citas, repuestos, riesgos)
- `Coreografia` (arriba)
- `Evento` (feed de actividad: quién hizo qué)

Además, **fixtures** (JSON de ejemplo ya validados) para un caso completo de notebook. Con eso los 3 trabajan en paralelo desde la hora 1 sin esperar a los otros.

## 6. Carriles del equipo

Todo el código lo escribe Claude; las personas dirigen, prueban y deciden. Cada carril usa su propia cuenta; la de 100 USD va al carril B (más iteración).

### Carril A — Cerebro (IA y datos)
Responsable de que la IA sea buena y esté fundada.
- A1. Captura guiada: pedir fotos según equipo/síntoma, control de calidad, lectura de chapa (`pedir_foto`, `leer_chapa`).
- A2. Ficha con estados y confirmación; guardado.
- A3. Armado del knowledge pack: búsqueda del manual, lectura de páginas como imagen, verificación de citas, caché.
- A4. `/api/chat`: conversación con el manual en contexto (con caché de prompt), emite texto + coreografía en el mismo stream.
- A5. Seguridad: tabla de riesgos, bloqueo, derivación.
- A6. Repuestos y presupuesto simple (P1).

### Carril B — 3D
Responsable de que el 3D se vea bien y se mueva.
- B1. Notebook paramétrico en three.js → GLB con nodos nombrados y pivotes.
- B2. Visor con React Three Fiber: giro con el dedo, zoom, iluminación sobre fondo negro.
- B3. Reproductor de coreografía: cámara, resaltado, rotación, desplazamiento, despiece, con suavizado.
- B4. Ajuste de posiciones por modelo a partir del knowledge pack.
- B5. Capa 2 y 3 (P2): 3D desde fotos y segmentación, solo si hay tiempo.

### Carril C — Producto (app, voz, demo)
Responsable de que se sienta como un producto y de la demo.
- C1. Esqueleto Next.js, deploy en Vercel, Supabase, autenticación mínima, PWA.
- C2. Las 6 pantallas (partiendo del lienzo de diseño).
- C3. Voz: entrada con Scribe Realtime, salida con TTS en streaming, subtítulos que aparecen y se desvanecen, texto siempre disponible.
- C4. Feed de actividad y estados de carga ("Preparando a tu experto").
- C5. Conjunto de pruebas y guion de demo, ensayos.
- C6. Pitch (3 min) y respuestas al Q&A.

## 7. Cronograma (15 h)

| Hora | A — Cerebro | B — 3D | C — Producto |
|---|---|---|---|
| 0–1 | `shared/` + fixtures (los 3 juntos) | igual | igual |
| 1–3 | Chapa → ficha; primer knowledge pack de 1 notebook | Notebook paramétrico en GLB con nodos nombrados | Esqueleto, deploy, pantallas 1–3 |
| **Hora 2: puerta 1** | 10 chapas leídas y 5 búsquedas de manual bien | GLB cargando en el visor | App desplegada |
| 3–5 | `/api/chat` con manual y citas; seguridad | Visor + reproductor de coreografía con fixture | Voz: entrada y salida; pantallas 4–6 |
| **Hora 5: puerta 2** | Chat responde con cita en 3 equipos | Coreografía del fixture se anima fluida (cámara, resaltar, rotar, desplazar) | Voz de punta a punta |
| 5–6 | Conectar todo | Conectar todo | Conectar todo |
| **Hora 6: hito** | **Flujo completo con un notebook real**: decir síntoma → fotos → ficha → preparando → 3D con voz → pregunta → respuesta | | |
| 6–10 | Segunda y tercera notebook; guardrails; repuestos | Ajuste por modelo; pulido visual; capa 2 si va bien | Pulido UX, estados de error, feed |
| **Hora 10: congelar funciones** | Solo arreglos | Solo arreglos | Solo arreglos |
| 10–13 | Pruebas de calidad (sección 9) | Rendimiento en celular | Ensayos de demo, grabar video de respaldo |
| 13–15 | Colchón, pitch, Q&A | | |

**Dos fases:** horas 0–6 = MVP completo con 3D básico (el hito de la hora 6 es el flujo entero); horas 6–13 = iterar el formato del 3D por la escalera de la sección 4.3, más pruebas con equipos y preguntas variadas.

**Si falla un hito, se recorta, no se corre:** primero se cae la capa 2/3, luego repuestos, luego la segunda clase. Nunca el hilo principal.

## 8. Demo (≤ 90 s dentro de los 3 min)

1. El jurado pone **su notebook** (o usamos una nuestra) y dice un síntoma por voz.
2. La app pide 3 fotos, rechaza una movida, lee la chapa y confirma el modelo.
3. "Preparando a tu experto" (segundos); aparece el 3D negro, resalta el ventilador y gira.
4. El jurado pregunta por voz: *"¿dónde está el SSD?"* → el 3D resalta el SSD y la voz cita la página.
5. El jurado pide algo peligroso (abrir la batería) → bloqueo con derivación al técnico.

Plan B: video grabado del flujo completo en la hora 13 y un caso ya guardado en la base. Si falla el micrófono, texto.

## 9. Controles de calidad (hora 10–13)

- 15 chapas/etiquetas de notebooks: % leído bien. Meta: que lo dudoso quede en "probable" y nunca en "confirmado".
- 12 búsquedas de manual: % que encuentra el documento correcto del modelo.
- 20 preguntas de ubicación de piezas: % que coincide con el manual.
- Consistencia: la misma pregunta dos veces da la misma pieza.
- 10 pedidos peligrosos: 10 bloqueados.
- Verificación de citas: % de citas que aparecen en la página indicada.

## 10. Transparencia de la IA (para el jurado)

- Se dice qué hace la IA (decidir fotos, leer la chapa, buscar y leer el manual, razonar con el manual, emitir la coreografía) y qué hace el código (validar, guardar, animar, bloquear).
- Etiquetas visibles: *confirmado / probable / desconocido*, *verificado / no verificado*, citas con página.
- El 3D es un modelo **esquemático del tipo de equipo**, con posiciones ajustadas al manual del modelo; no es un escaneo. Se dice en voz alta.

## 11. Riesgos y qué hacemos

| Riesgo | Plan |
|---|---|
| No se encuentra el manual exacto | Guía pública marcada NO VERIFICADO; el experto lo avisa |
| El 3D paramétrico se ve pobre | Mejorar materiales/iluminación; plan B modelo CC de Sketchfab con crédito |
| Latencia de voz | Texto en streaming, frase de espera con puntos suspensivos, texto siempre visible |
| Copyright de manuales | Usar solo para consulta de la demo, citar, no redistribuir |
| Datos de iFixit (no comercial) | Crédito visible; consulta en vivo; no entrenar |
| Wi-Fi del evento | Hotspot propio; caso guardado y video de respaldo |
| Alguien trabaja con datos del empleador | **No usar datos ni documentos de CIR en el evento** |

## 12. Lo que hace Claude por vos antes de arrancar

- Escribir `shared/` (tipos Zod) y fixtures de un notebook completo.
- Armar el notebook paramétrico en three.js y exportarlo a GLB.
- Juntar **3 notebooks de prueba** con sus manuales públicos y vistas explosionadas, y una lista de chapas de ejemplo para el set de pruebas. Limitación: desde el entorno de Claude no se pueden bajar archivos de cualquier sitio; las búsquedas y lecturas web sí funcionan, y los PDFs que no pasen los bajan ustedes con el navegador.
- Preparar los prompts de cada carril, con contrato y ejemplos.

**Fotos de las chapas reales** (para probar lectura) las tiene que sacar el equipo con equipos reales; no se pueden bajar de Google sin riesgo de que no sean etiquetas legibles ni representativas.

## 13. Pendientes que necesitan decisión humana

1. Quién toma el carril A, B y C (sugerencia: A = el más fuerte en backend/IA, B = el que quiera 3D, C = el que más cuide la experiencia y el pitch).
2. Confirmar las reglas del organizador sobre trabajo previo (¿se puede llegar con el esqueleto y el GLB hechos?).
3. Validar el flujo con una persona que repare equipos antes de la demo, si se puede.
4. Verificar precios y licencias de ElevenLabs y de la API de imagen-a-3D elegida antes de gastar créditos.

## 14. Fuentes consultadas

- iFixit FixBot — https://www.ifixit.com/News/114700/introducing-fixbot
- Teardown AI — https://teardownai.app/
- OperaAI (GitHub) — https://github.com/JinayD1/OperaAI
- iFixit licencia de contenido — https://www.ifixit.com/Info/Licensing
- iFixit MCP (solo lectura) — https://glama.ai/mcp/servers/Dthen/ifixit-mcp
- Comparación de APIs de 3D — https://www.3daistudio.com/blog/best-3d-model-generation-apis-2026
- Hunyuan3D-Part (P3-SAM, X-Part) — https://huggingface.co/tencent/Hunyuan3D-Part
- Rodin Bang — https://help.scenario.com/articles/7603337491-rodin-hyper3d-bang-the-essentials
- ElevenLabs LLM propio — https://elevenlabs.io/docs/eleven-agents/customization/llm/custom-llm.md
- ElevenLabs precios — https://www.happyrobot.ai/hub/elevenlabs-pricing
- Lenovo Hardware Maintenance Manual (ejemplo) — https://www.ifixit.com/Document/ZL32imJmtLMTvgTO/Lenovo-ThinkPad-L570-Hardware-Maintenance-Manual.pdf

> Actualización: la estrategia 3D ampliada (generador desde el manual, plantillas con Blender MCP, bucle de corrección) está en `docs/3d-estrategia.md` y reemplaza a la sección 4.3 donde difieran.
