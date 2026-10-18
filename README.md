# sayso — Experto al lado

Hackatón Build 101 (17–18 oct 2026). Guía de reparación con IA: captura guiada, identificación del modelo, manual, 3D animado y voz.

**Agentes (Claude Code / Codex): empezá por `CONTEXT.md`.**

## Arrancar
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

`npm run dev` a veces entra en un bucle de recargas ("[Fast Refresh] rebuilding" y la página se recarga sola, una y otra vez), sobre todo al abrirla por la IP de la Mac o con un Chrome sin ventana. Para recorrer la app conviene usar el **build de producción**, que no tiene recarga en caliente:

```bash
NEXT_PUBLIC_DATOS=fixture npm run build      # sin la variable, la app usa IA real al usarla (gasta)
NEXT_PUBLIC_DATOS=fixture npx next start -H 0.0.0.0
```

Después abrí `http://<IP de la Mac>:3000` en el celular (misma red). Cada cambio de código pide volver a hacer `npm run build`. Si `npm run dev` ya entró en el bucle, cortalo y volvé a arrancarlo.

