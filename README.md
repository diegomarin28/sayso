# sayso — Experto al lado

Hackatón Build 101 (17–18 oct 2026). Guía de reparación con IA: captura guiada, identificación del modelo, manual, 3D animado y voz.

**Agentes (Claude Code / Codex): empezá por `CONTEXT.md`.**

## Arrancar

Hace falta **Node 22 o más nuevo** (`.nvmrc`; con nvm: `nvm use`). Con Node 20 fallan `@supabase/supabase-js` en los scripts y algunos tests de `lib/knowledge`.

```bash
npm install
cp .env.example .env.local   # completar claves
npm run dev                  # http://localhost:3000
npm test                     # valida contratos y fixtures
npm run typecheck
```

- Contratos y casos de ejemplo: `shared/`
- Plan: `docs/plan-v4.md` · 3D: `docs/3d-estrategia.md`

## Probar en el celular (o con un navegador automático)

`NEXT_PUBLIC_DATOS=fixture npm run dev -- -H 0.0.0.0` y abrí `http://<IP de la Mac>:3000` en el celular (misma red). `next.config.ts` acepta los rangos de red local (`allowedDevOrigins`): antes aceptaba solo las IPs del momento en que arrancó, y al cambiar de Wi-Fi la página se recargaba sola cada tanto (B8).

Para un recorrido que se parezca a la demo, el **build de producción** (sin recarga en caliente):

```bash
NEXT_PUBLIC_DATOS=fixture npm run build      # sin la variable, la app usa IA real al usarla (gasta)
NEXT_PUBLIC_DATOS=fixture npx next start -H 0.0.0.0
```

Cada cambio de código pide volver a hacer `npm run build`.

