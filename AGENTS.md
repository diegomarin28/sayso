# AGENTS.md

Antes de hacer cualquier cosa, leé `CONTEXT.md` (en esta misma carpeta) entero y seguí sus instrucciones. Lo primero que tenés que hacer es preguntarle a la persona si es Diego, Juanma o Iaio.

- El plan está en `docs/plan-v4.md` y la estrategia 3D en `docs/3d-estrategia.md`.
- Si algo no está claro o falta una decisión, preguntá antes de construir.
- Si la carpeta `shared/` todavía no existe, no inventes los contratos: avisale a la persona que Diego tiene que crearlos primero.
- Seguí el MODO AUTÓNOMO y el "Ciclo de cada tarea" de `CONTEXT.md`: trabajás en bloques de ~1 hora, manejás git, PR y fusiones, y la persona da un solo OK por bloque.
- No hagas commits directos a `main`.
- Tu uso principal es revisar PRs y escribir tests.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
