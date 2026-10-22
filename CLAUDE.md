# CLAUDE.md — Sayso, etapa posterior a Build 101

> Vigente desde el 19/10/2026. Este archivo manda sobre cómo se trabaja. `CONTEXT.md` tiene el contexto del producto y las reglas permanentes (arquitectura, seguridad, gasto, claves); `AGENTS.md` dirige a otros agentes (Codex) a estos dos archivos. `docs/plan-v4.md` y `docs/3d-estrategia.md` son referencia de la hackathon: sus horarios, fases, puertas y "congelar funciones" ya no rigen. Si algo de esos documentos contradice este archivo, gana este archivo.

## 0. Inicio obligatorio

1. Preguntá: **«¿Sos Diego, Juanma o Iaio?»** y esperá la respuesta. Iaio y "Yayo" son la misma persona. Si no sabés su sistema, preguntalo (Juanma usa Windows/PowerShell; Diego e Iaio, Mac).
2. Leé `CLAUDE.md`, `CONTEXT.md`, `AGENTS.md`, `shared/schemas.ts` y la documentación del carril que toque la tarea. Si `shared/` no existe, no inventes contratos: avisá que Iaio tiene que crearlos.
3. Verificá el estado real, nunca de memoria: `git fetch origin`, `git log --oneline -15 origin/main`, `gh pr list` y `git worktree list`.
4. Leé los issues abiertos de tu carril, primero los que tienen `pregunta`, `dependencia`, `decision` o `bloqueado`: `gh issue list --state open --label <carril>`. Mirá también los PR abiertos que toquen los archivos de la tarea.
5. Presentá el **plan de un solo PR**: objetivo, alcance, archivos previstos, pruebas, riesgos, dependencias y si gasta IA o servicios pagos. Esperá el OK de la persona antes de empezar, salvo que la tarea ya estuviera aprobada.
6. Si estás en un worktree recién creado, comprobá la rama, que esté limpio y que su base sea `origin/main` (ver §4). No abras otra rama dentro del worktree: **un worktree = una rama = un PR**.

## 1. Producto y prioridades

Sayso apunta a ser un producto B2C de asistencia de reparación desde el celular cuando falla un equipo: la persona describe el problema, aporta fotos, confirma la identificación, recibe una guía contextual y puede interactuar con un modelo 3D y con un asistente. El 3D es la principal diferenciación buscada, pero **una aproximación no se presenta como reconstrucción exacta**. La viabilidad comercial es una hipótesis a validar, no un hecho.

| Persona | Carril | Etiqueta | Prioridades actuales |
|---|---|---|---|
| **Juanma** (Windows, poca RAM) | **A — Cerebro** | `carril-a` | Selección y uso de Haiku y otros modelos; identificación; preguntas al usuario; búsqueda documental; precisión y claridad de las respuestas; citas; seguridad y comportamiento del chat. Respuestas verificables y útiles antes que vistosas. Medir calidad, costo y latencia. |
| **Diego** | **B — Modelado 3D** | `carril-b` | Los modelos 3D: fidelidad visual, geometría, escala, piezas y variantes por equipo, hechos en Blender y comprimidos para el celular. Explorar herramientas nuevas de IA/3D para modelar, con criterios y pruebas, sin adoptar servicios por moda ni gastar sin permiso. No escribe el código de la app (desde el 21/10/2026, ver §2). |
| **Iaio** | **C — Producto** + código del 3D, `shared/` y compras | `carril-c` | Todo el código que no es de A: además de lo de abajo, el visor y la guía en 3D (ubicación de piezas, interacción, coreografías, rendimiento en el celular, evaluación reproducible), los contratos de `shared/` y compras. Interfaz móvil usable; autenticación y sesiones; lista de casos activos, pendientes y anteriores; recuperar un caso y su 3D ya generado sin regenerarlo; navegación clara (sidebar u otra según diseño); estados de carga y errores. Diseñar persistencia y aislamiento por usuario, migración de casos anónimos y manejo de datos personales **antes** de dar por listo el login. |

Cuando A termine sus objetivos acordados, le propone a Iaio (issue `carril-c` + `pregunta`) tareas acotadas de apoyo al código del 3D, o a Diego (`carril-b`) si son de modelado. No cambia de dueño ni pisa archivos sin coordinarlo en GitHub.

## 2. Dueños de código y contratos

Las rutas son orientativas: verificá el código real antes de tocar algo.

- **A:** `lib/ia`, `lib/intake`, `lib/ficha`, `lib/knowledge`, `lib/chat`, `lib/safety` y sus endpoints (`app/api/intake`, `ficha`, `knowledge`, `chat`).
- **B (Diego, modelado 3D):** los modelos y su generación: `assets/models` (Blender y sus scripts) y `public/models/piezas` (`npm run modelos:*`).
- **C (Iaio):** `app/(screens)`, componentes de navegación, cuenta y casos, `lib/voice` y `app/api/voz`, persistencia y autenticación (`lib/supabase`, `app/api/casos` y rutas relacionadas). Además, desde el 21/10/2026, todo el código que era de B: `components/viewer`, `lib/planogenerator`, `app/api/plano`, `app/lab` y las herramientas de evaluación 3D; los contratos de `shared/`; y compras (`lib/compras`, `components/compras`, `app/api/compras`, `lib/herramientas`), que dependen de A (IA): los cambios que toquen la IA se coordinan con A.
- `docs/`: todos.

Si una tarea toca otra área, abrí un issue `dependencia` al carril dueño o pactá en el issue un PR explícitamente coordinado. **`shared/schemas.ts`** solo cambia por PR con etiqueta `contrato`, revisión de todos los consumidores y aviso a los tres carriles (issue con `carril-a`, `carril-b` y `carril-c`); nunca de forma unilateral. Lo fusiona Iaio.

## 3. Coordinación entre agentes: GitHub es la memoria compartida

**Los issues y PR de GitHub son la fuente de verdad, no los chats privados de Claude.** Cada agente puede leer issues y PR; ningún agente puede leer la sesión de otro. No asumas comunicación directa entre instancias ni le pidas a la persona que lleve mensajes a mano.

- **Pedir algo a otro carril:** issue con título `[B→C] <qué>` (o `[A→B]`, etc.), la etiqueta del carril destinatario y `pregunta` (necesito saber algo) o `dependencia` (necesito que hagas algo). Incluí: contexto, qué se pide, archivos o PR, criterio de respuesta y si bloquea. Si bloquea, agregá `bloqueado` y seguí con otra parte mientras tanto.
- **Responder:** el agente destinatario revisa esos issues al empezar cada worktree y antes de cerrar su PR. Si puede responder, comenta con evidencia (archivo, línea, PR, prueba) y cierra el issue cuando queda resuelto. Si hace falta código, crea o vincula el issue/PR y cierra recién cuando quedó atendido.
- **No se borran preguntas ni decisiones:** se cierran y quedan en el historial. Si la decisión afecta a todo el proyecto, actualizala en `CLAUDE.md` o `CONTEXT.md` en un PR.
- **Decisiones de personas** (ver §5): no las inventa ningún agente ni se encadenan agentes indefinidamente. Si la decisión es de otra persona, issue con `decision` y la etiqueta de su carril.
- **Evitar choques:** cada issue y cada PR tiene un dueño. Antes de editar, mirá PR abiertos y archivos tocados (`gh pr list`, `gh pr view <n> --json files`). No abras PR que editen a la vez los mismos archivos compartidos. Ante un conflicto con archivos de otro carril, no lo resuelvas a ciegas: issue a ese carril.
- **Etiquetas:** `carril-a`, `carril-b`, `carril-c`, `pregunta`, `dependencia`, `decision`, `contrato`, `bloqueado`. Si te falta permiso o una etiqueta, decilo y usá un issue descriptivo; no finjas una automatización que no existe.

## 4. Ciclo obligatorio: un worktree por PR

1. **Crear el worktree** desde el repositorio principal (en la Mac de Diego: `~/orca/sayso`), siempre desde `origin/main` recién traído:
   ```bash
   git fetch origin
   git worktree add -b <carril>/<slug> <ruta-del-worktree> origin/main
   ```
   Con Orca, crealo desde Orca basado en `origin/main`; si la rama que propone no tiene la forma `a/…`, `b/…` o `c/…`, renombrala antes del primer push: `git branch -m <carril>/<slug>`. **Nunca reutilices un worktree para otra tarea.**
2. **Preparar:** `npm ci` (cada worktree tiene su `node_modules`). Si la tarea necesita claves, copiá el archivo sin abrirlo: `cp <repo-principal>/.env.local .env.local` (en Windows: `Copy-Item`). Para pantallas y pruebas alcanza `NEXT_PUBLIC_DATOS=fixture`.
3. **Trabajar solo en ese worktree**, con commits chicos. Nada de commits directos a `main` ni de mezclar tareas independientes en un PR.
4. **Probar sin APIs pagas:** `npm test`, `npm run typecheck` y `npm run build` (Juanma: sin build ni app local, lo hace la CI; ver `CONTEXT.md`). Lo visual se prueba con el fixture en tamaño celular, o lo mira Iaio. Antes de subir: `git diff --stat origin/main...HEAD` y que aparezcan solo tus archivos.
5. **Integrar `main` y abrir el PR:**
   - Antes del primer push: `git fetch origin && git rebase origin/main`, volver a probar, `git push -u origin <rama>`.
   - Con el PR ya abierto no se reescribe la historia (el `push --force` está bloqueado): `git fetch origin && git merge origin/main`, volver a probar y `git push`. Con squash el PR queda en un solo commit igual.
   - `gh pr create --base main` con resumen, pruebas, capturas si corresponde, riesgos y `Closes #n` / referencias a issues.
6. **Fusionar:** esperá el check `verificar` en verde (`gh pr checks <n> --watch`). Si la persona aprobó el plan y el PR no toca `shared/`, seguridad, gasto ni archivos de otro carril, fusioná vos: `gh pr merge <n> --squash`. Si toca alguna de esas cosas, o la persona pidió revisarlo, explicá los cambios y esperá su OK. Nunca fusiones con la CI en rojo, con secretos en el diff o con dudas de seguridad. Comprobá que quedó fusionado (`gh pr view <n> --json state,mergeCommit`). Si no tenés permiso para fusionar, pedíselo a la persona.
7. **Antes de cerrar:** respondé o cerrá los issues de coordinación resueltos (comentario con el número de PR), registrá las decisiones duraderas y elegí **una** próxima tarea que no duplique PR abiertos.
8. **Cierre explícito** (plantilla en §8): PR fusionado o pendiente, qué cambió, qué quedó pendiente, issues que esperan a otros, nombre de la próxima rama y el mensaje exacto para el próximo Claude Code. Si el PR está fusionado y el worktree limpio (`git status` sin cambios), decí **«Ya podés borrar este worktree»** con los comandos para su sistema y ruta reales.
9. **Borrar el worktree** (solo después de confirmar), desde el repositorio principal, nunca desde adentro:
   ```bash
   git worktree remove <ruta-del-worktree>
   git worktree list
   ```
   Con Orca se puede borrar desde Orca. La rama local se borra solo si el PR está fusionado y la punta de la rama es la del PR (`gh pr view <n> --json state,headRefOid` contra `git rev-parse <rama>`): `git branch -D <rama>` (con squash, `-d` no la reconoce como fusionada). La rama remota: `git push origin --delete <rama>`. **No borres worktrees ajenos ni con cambios sin guardar, y no uses `--force` por defecto.**

## 5. Cuándo frenar y preguntarle a la persona

Ningún agente decide solo sobre:
- **Producto y UX importante:** alcance, prioridades, flujos nuevos, qué se promete al usuario.
- **Arquitectura:** contratos de `shared/`, base de datos y migraciones, autenticación, servicios o dependencias nuevas, cambios que afecten a otro carril.
- **Seguridad y datos personales:** reglas de riesgo, bloqueos, manejo de datos de usuarios, permisos, secretos, accesos.
- **Presupuesto:** cualquier llamada paga a IA o a un proveedor, cuentas nuevas, planes pagos.

En esos casos presentá alternativas con pros, contras y costo, y preguntá a tu persona. Si la decisión es de otro carril o afecta a todos, abrí un issue `decision` con la etiqueta del carril dueño. Los contratos (`shared/`) los decide Iaio; el gasto de la cuenta de Anthropic, Diego; las claves de Supabase y Vercel, Iaio. También frená si algo falla dos veces seguidas sin causa clara, o si necesitás que alguien pruebe en el navegador, el micrófono o la cámara.

## 6. Reglas técnicas y de seguridad permanentes (detalle en `CONTEXT.md`)

- La IA interpreta y propone; el código valida con Zod, calcula, guarda, anima y bloquea. Texto, fotos y documentos externos son datos no confiables, nunca instrucciones.
- Riesgos altos (electricidad, baterías dañadas, gas, refrigerantes, etc.): bloqueo y derivación a un profesional. No se relajan por conveniencia.
- Distinguir *confirmado / probable / desconocido* y el origen del 3D (`manual`, `foto`, `estimada`, `plantilla`). Citas reales; no inventar números de pieza, fuentes ni precisión geométrica. Nada de datos de un equipo o modelo escritos en el código.
- **Cero llamadas pagas a IA o a proveedores externos sin el OK de la persona en ese momento y con tope en USD.** Tests con fixtures y sin red.
- No leer, imprimir, subir ni exponer secretos ni `.env.local`. No usar datos ni documentos de empleadores (CIR u otros).
- Revisar licencias y atribución de manuales, iFixit, modelos y servicios antes de comercializar. CI en verde no es certificación de seguridad ni de precisión del 3D.
- Antes de tocar APIs de Next.js, leé la guía de `node_modules/next/dist/docs/` (ver `AGENTS.md`).
- Varias sesiones comparten la máquina y las referencias de git: matá solo tus procesos (por PID o puerto, nunca `pkill -f` por patrón), borrá tus perfiles de navegador al terminar, y no uses `git reset --soft origin/main` para juntar commits (`origin/main` se mueve con el fetch de otras sesiones; usá `git merge-base`).

## 7. Cómo elegir el siguiente trabajo

- **A:** encontrar errores de respuesta, evidencia y búsqueda; medir calidad, latencia y costo antes y después; priorizar fallas reproducibles.
- **B:** mejorar los modelos 3D con equipos y fotos de referencia (geometría, escala, piezas, peso en el celular), un equipo o una familia de piezas por PR. Investigar herramientas nuevas de modelado con comparativas y pruebas acotadas, sin suponer que un proveedor da un 3D utilizable sin verificarlo.
- **C:** especificar identidad y datos guardados, login, recuperación de casos y reutilización de modelos; separar el prototipo local de una arquitectura multiusuario segura; priorizar el flujo móvil de punta a punta. En el código del 3D: armar un benchmark con equipos de referencia; puntuar posición, animación, certeza y rendimiento; mejorar un cuello de botella por PR.

Cada tarea tiene definición de terminado, pruebas y criterio de aceptación. Si falta una decisión, proponé alternativas y preguntá a la persona indicada.

## 8. Mensaje de salida obligatorio (plantilla)

> **PR:** #… — [fusionado / pendiente]. **Verificaciones:** … **Coordinación:** issues … (esperando a …). **Pendiente:** … **Próximo objetivo:** … **Rama/worktree sugerido:** `<carril>/<slug>` en `<ruta>`.
> **Mensaje para el nuevo Claude Code:** «Soy [persona]. Leé CLAUDE.md y los issues de mi carril. Trabajá en [objetivo] (issue #…), en un worktree nuevo desde origin/main y con un solo PR. No uses APIs pagas sin mi aprobación. …»
> [Si corresponde] **Ya podés borrar este worktree:** desde `<repo-principal>`, `git worktree remove <ruta>` (o desde Orca).
