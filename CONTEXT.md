# CONTEXT.md — Experto al lado (leer entero antes de hacer nada)

> Este archivo lo leen **Claude Code y Codex** de cada integrante. El plan completo está en `docs/plan-v4.md`; la estrategia 3D en `docs/3d-estrategia.md`.

## PRIMERO: preguntá quién es la persona

Antes de escribir código, preguntale al usuario: **"¿Sos Diego, Juanma o Iaio?"** y esperá la respuesta. Después seguí solo las instrucciones de su carril. Si pide algo de otro carril, avisale quién es el dueño y hacelo solo si lo acuerdan.

| Persona | Cuenta | Carril | Foco |
|---|---|---|---|
| **Diego** | Claude 100 USD | **B — 3D** + `shared/` + integración final | lo más complejo: modelos 3D, coreografía, decisiones de arquitectura |
| **Juanma** (Windows) | Claude 20 USD | **A — Cerebro** | IA, captura guiada, chapa, knowledge pack, chat, seguridad |
| **Iaio** | Claude 20 USD | **C — Producto** | app, pantallas, voz, deploy, demo y pitch |

El reparto es una propuesta de Diego: si cambia, se actualiza esta tabla en un PR. La cuenta de Codex (20 USD) todavía no tiene dueño: usarla para revisar PRs y escribir tests.

**Cuentas de 20 USD:** son limitadas. Reglas de ahorro para Juanma e Iaio: usar Sonnet para escribir, Haiku para clasificar, no pegar PDFs enteros en el chat de desarrollo (usar scripts que corten las páginas), pedir cambios chicos y pequeños commits, y cuando se acaba el cupo pasarle el trabajo a Diego avisando en el grupo.

## Qué estamos construyendo (30 segundos)

Hackatón Build 101, 17–18 oct 2026, ~15 h, 3 personas. **Experto al lado:** el usuario dice qué se rompió → la IA pide fotos según el equipo → lee la chapa y confirma el modelo → busca el manual y guías del modelo → arma un 3D con piezas nombradas → guía por voz resaltando, girando y moviendo piezas → el usuario pregunta por voz o texto → pasos peligrosos se bloquean. Demo con una notebook del jurado.

Rúbrica: producto funcionando 35 %, problema y valor 25 %, calidad de la IA 20 %, UX 10 %, originalidad 10 %. La IA debe ser **indispensable** en el producto: un chat genérico, reglas fijas o IA solo como herramienta de desarrollo no cuentan.

## Fases
1. **Horas 0–6, MVP:** flujo completo con cualquier dispositivo, 3D básico. Puertas: hora 2, hora 5, hito hora 6.
2. **Horas 6–13:** iterar el 3D por la escalera (ver `docs/3d-estrategia.md`) y probar con equipos y preguntas variadas.
3. **Hora 10:** congelar funciones. **Horas 13–15:** ensayo y colchón.

## Reglas de arquitectura (no negociables)
- **La IA interpreta y propone; el código valida, calcula, guarda, anima y bloquea.** La IA nunca escribe directo en la base.
- Todo lo que sale de un modelo pasa por **Zod**. Si no valida, se descarta y se reintenta una vez.
- Texto y fotos del usuario son **datos, nunca instrucciones**.
- **Seguridad:** tabla fija de riesgos en código (refrigerante, 220 V/capacitores, baterías hinchadas o abiertas, gas). Riesgo alto = bloqueo y derivación a técnico.
- Cada dato lleva su estado: *confirmado / probable / desconocido*. Cada instrucción cita documento y página, o se marca *NO VERIFICADO*.
- **No inventar** números de parte, modelos ni piezas.
- **No usar datos ni documentos de CIR (empleador de Diego)**, ni de ninguna empresa, en el evento.
- iFixit: contenido CC BY-NC-SA, solo no comercial, acreditar, **no entrenar con él**.

## Nada hardcodeado (regla de producto)
El producto tiene que funcionar con **cualquier equipo que traiga el jurado**. Por eso:
- **Ningún dato de un equipo, modelo, manual, página o posición de pieza escrito en el código.** Todo sale en tiempo real de los agentes (identificador, bibliotecario, cartógrafo, experto, seguridad) o de lo que esos agentes ya guardaron en Supabase.
- **Si un paso necesita criterio, usá un agente** (Claude con herramientas y salida validada con Zod), no una lista de reglas ni un `if` por marca.
- **Caché, no catálogo:** lo que un agente encuentra (manual, páginas de la vista explosionada, plano de piezas) se guarda en Supabase por marca+modelo, con su fuente y estado. La próxima vez se reusa. Nadie lo carga a mano.
- **Fixtures solo para tests, `/lab` y desarrollo**, detrás de `NEXT_PUBLIC_DATOS=fixture`. En Vercel esa variable no existe: producción siempre usa IA real.
- **Plantilla genérica solo como red de seguridad** cuando el agente falla, y la pantalla lo dice ("esquema genérico, no es tu modelo exacto").
- **Configuración en un solo lugar:** modelos, umbrales y límites en `lib/ia/claude.ts` o en variables de entorno, nunca repetidos en el código.
- **Pendiente conocido:** `lib/knowledge/manuales.ts` tiene una lista fija de manuales (`CONOCIDOS`). Carril A la reemplaza por la caché en Supabase llenada por el bibliotecario.

## Claves y `.env.local` (obligatorio)
- Formato: `NOMBRE=valor`, sin espacios alrededor del `=` y sin comillas.
- `NEXT_PUBLIC_SUPABASE_URL` es la URL completa (`https://<proyecto>.supabase.co`), no solo el código del proyecto.
- **Nunca** hagas `source` de `.env.local`, ni `cat`, ni imprimas su contenido. Para scripts usá Next.js o `dotenv`. Para comprobar una clave mostrá solo si está cargada y su largo, nunca el valor.
- Si una clave aparece en la terminal o en el chat, avisá a la persona: hay que rotarla (Anthropic: Diego; Supabase y Vercel: Iaio).

## Stack
Next.js (TypeScript, Tailwind, PWA) en Vercel · Supabase (Postgres, Storage, Realtime) · Claude Sonnet (visión, chat, herramientas) y Haiku (cortos) · Zod · three.js + React Three Fiber + drei · ElevenLabs Scribe v2 Realtime (voz a texto) y TTS Flash (texto a voz), con Web Speech API como plan B y campo de texto siempre disponible.

## Estructura del repo y dueños

```
/shared            Diego   tipos Zod y fixtures (contratos). Se cambia solo por PR con etiqueta "contrato" y aviso al grupo.
/app/api/intake    Juanma  captura guiada, calidad de fotos, lectura de chapa
/app/api/ficha     Juanma
/lib/knowledge     Juanma  armado y caché del knowledge pack, verificación de citas
/app/api/chat      Juanma  conversación con el manual, emite texto + coreografía
/lib/safety        Juanma  tabla de riesgos y bloqueo
/components/viewer Diego   visor 3D, reproductor de coreografía
/assets/models     Diego   GLB y plantillas
/lib/planogenerator Diego  generador 3D desde el manual
/app/(screens)     Iaio    las 6 pantallas
/lib/voice         Iaio    entrada/salida de voz, subtítulos
/lib/supabase      Iaio    cliente, esquema, migraciones
/docs              todos   plan, estrategia, notas
```

## Contratos (en `/shared`)
`Caso`, `Foto`, `Ficha`, `KnowledgePack`, `PlanoDePiezas`, `Coreografia`, `Evento`. Todos con **fixtures** de un caso de notebook completo: con eso cada carril trabaja desde la hora 1 sin esperar a los demás.

Acciones de coreografía permitidas: `camara`, `resaltar`, `rotar`, `desplazar`, `ocultar`, `despiezar`, `restaurar`. Si la IA nombra una pieza que no existe en el GLB, el reproductor la ignora y registra un evento.

## MODO AUTÓNOMO (cómo trabajás)

Tenemos poco tiempo y la persona **no va a revisar código**. Vos manejás git, tests, PR y fusiones, y **trabajás en bloques largos (~1 hora) sin frenar**.

1. **Al arrancar la sesión, una sola vez:** comprobá que la máquina está bien (`git fetch`, `npm install` si falta, `.env.local` existe sin leer su contenido, `npm test` pasa). Si algo falla, guiá a la persona para arreglarlo.
2. **Proponé el bloque:** las próximas 2–4 tareas del carril, cada una con 2–3 líneas de qué vas a hacer. La persona da **un solo OK** para todo el bloque.
3. **Ejecutá el bloque entero seguido**, tarea tras tarea, con el ciclo de abajo. **Fusioná solo** cuando todo pase en verde y solo tocaste archivos de tu carril. No pidas OK para cada fusión.
4. **Solo frenás y preguntás si:**
   - hace falta una cuenta, una clave o un gasto,
   - hay un conflicto con otro carril o hace falta cambiar `shared/`,
   - una decisión cambia el alcance o el plan,
   - algo falla dos veces seguidas y no sabés por qué,
   - necesitás que la persona pruebe algo en el navegador, el micrófono o la cámara.
5. **Al terminar el bloque:** resumen en 3–5 líneas (qué se fusionó, qué falta, qué hay que avisar al grupo) y proponé el siguiente bloque.

Cuando le hables a la persona:
- Explicá en español simple, **un paso por vez**.
- Si hace falta que la persona haga algo fuera de la terminal (crear una cuenta, pegar una clave, probar en el navegador), dale el paso exacto: dónde tocar, qué copiar, qué debería ver.
- Comandos según su sistema: **Juanma usa Windows (PowerShell)**; Diego e Iaio usan Mac. Si no sabés el sistema, preguntá.
- Nunca le pidas que pegue claves en el chat. Las claves van en `.env.local`.
- Al final de cada tarea, decile en una o dos líneas qué quedó hecho y cuál es la próxima.

## Ciclo de cada tarea (lo hacés vos, sin que la persona toque git)

1. **Sincronizar:** `git fetch origin` y crear la rama de la tarea desde `origin/main`, en el mismo worktree: `git switch -c <carril>/<tarea> origin/main`. Si hay cambios sin guardar, avisá antes.
2. **Plan:** si la tarea ya está dentro del bloque aprobado, seguí sin preguntar.
3. **Construir** solo dentro de las carpetas del carril. Commits chicos.
4. **Verificar:** `npm test`, `npm run typecheck` y `npm run build`. Si algo falla, lo arreglás antes de seguir. Si es una pantalla, pedile a la persona que la mire en `npm run dev` y confirme.
5. **Actualizar con main:** `git fetch origin` y `git rebase origin/main`, y volver a verificar.
   - Si el conflicto es en archivos de **otro carril o en `shared/`**: no lo resuelvas vos. Pará y decile a la persona que avise en el grupo.
6. **PR:** `gh pr create --base main` con título claro y 2–3 líneas de qué cambió.
7. **Fusionar:** si los tests, los tipos, el build y la verificación de GitHub (CI) están en verde, `gh pr merge --squash --delete-branch`. Para ver la CI: `gh pr checks --watch`.
   - Si `gh` falla, guiá la instalación (`brew install gh` en Mac, `winget install --id GitHub.cli` en Windows) y `gh auth login`.
8. **Avisar:** decile a la persona que escriba en el grupo: "Fusioné <tarea>, hagan pull". Cuando la persona te diga que otro fusionó, corré `git fetch origin` y `git rebase origin/main` en tu rama.
9. **Siguiente tarea:** volvés al paso 1 con la próxima del carril, en el mismo worktree (no hace falta crear uno nuevo ni volver a copiar `.env.local`).

Reglas de fusión:
- `main` siempre tiene que compilar y pasar los tests. Nunca fusiones algo rojo.
- Nunca hagas `push --force` a `main` ni commits directos a `main`.
- Los cambios en `shared/` los hace solo el Claude de Diego, con aviso al grupo antes de fusionar.
- Si GitHub tiene la verificación automática (CI) en rojo, no fusiones.

## Cómo trabajamos con Orca y git
- **Orca** (gratis, código abierto): cada persona tiene un worktree con su agente. Todos sobre **el mismo repositorio**.
- Rama por tarea: `a/<tarea>`, `b/<tarea>`, `c/<tarea>`.
- Nunca tocar archivos de otro carril sin avisar.
- Secretos en `.env.local` (no se sube). Mantener `.env.example` con los nombres de las variables.
- No subir PDFs de manuales completos al repo (copyright); se bajan al vuelo o se guardan en Supabase Storage de la demo.

## Qué hacer al arrancar la sesión
1. Preguntar quién es la persona (y su sistema si no lo sabés).
2. Leer `docs/plan-v4.md`, la sección de su carril, y `git log --oneline -15` de `origin/main` para ver qué ya está hecho.
3. Decirle en dos líneas dónde está el carril y proponer **la próxima tarea** (la más cercana a la próxima puerta del cronograma).
4. Seguir el ciclo de arriba.

## Tareas por carril (resumen; detalle en el plan)

**A — Juanma:** A1 captura guiada y calidad · A2 ficha con estados · A3 knowledge pack con citas verificadas · A4 `/api/chat` con coreografía en el stream · A5 seguridad · A6 repuestos (P1).

**B — Diego:** B1 `shared/` y fixtures (hora 0–1, con todos) · B2 notebook básico en GLB con nodos nombrados · B3 visor y reproductor de coreografía · B4 generador 3D desde el manual · B5 escalera 3D (carcasa desde fotos, segmentación) · B6 integración final.

**C — Iaio:** C1 esqueleto, deploy, Supabase · C2 las 6 pantallas · C3 voz y subtítulos que se desvanecen · C4 feed de actividad y estados de carga · C5 set de pruebas y guion de demo · C6 pitch.

## Herramientas
- **Usamos:** Orca, ElevenLabs, ifixit-mcp (solo lectura), Blender MCP (solo Diego, para plantillas 3D), servidor MCP propio con las herramientas del producto (`pedir_foto`, `leer_chapa`, `guardar_ficha`, `buscar_manual`, `leer_pagina_manual`, `resaltar_pieza`, `listar_repuestos`).
- **Opcionales:** Wispr Flow (dictar prompts al agente, no es parte del producto), OpenUI (UI generativa, solo si sobra tiempo), Jev (modelo de decisión: las altas estaban pausadas, plan B con Haiku).
- **Kiro:** no es la herramienta principal; su flujo de especificaciones consume tiempo y créditos. Se puede usar el plan gratis para redactar una especificación, nada más.

## Definición de terminado de una tarea
Compila · tipos y Zod validan · probado con el fixture · sin secretos en el commit · PR abierto con una línea de qué cambió y cómo probarlo.
