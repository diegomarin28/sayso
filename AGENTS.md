# AGENTS.md

Este repositorio tiene una sola fuente de instrucciones para todos los agentes (Claude Code, Codex u otros):

1. **`CLAUDE.md`**: cómo se trabaja. Inicio de sesión (preguntar si la persona es Diego, Juanma o Iaio), carriles y dueños, coordinación por GitHub Issues, un worktree por PR, cuándo preguntar a las personas y mensaje de salida.
2. **`CONTEXT.md`**: contexto del producto y reglas permanentes (arquitectura, seguridad, gasto de IA, claves, stack).

Leé los dos enteros antes de hacer nada y seguilos como si estuvieran escritos acá. Si algo de este archivo choca con `CLAUDE.md`, manda `CLAUDE.md`.

- La cuenta de Codex no tiene dueño: su uso principal es revisar PRs y escribir tests, con las mismas reglas (sin IA real ni servicios pagos sin OK con monto en USD, sin commits a `main`, un worktree por PR).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
