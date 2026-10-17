# lib/knowledge

Dueño: Juanma

Armado y caché del knowledge pack; verificación de citas. Ruta: `POST /api/knowledge { ficha, sintoma }` → `{ pack, manualUrl, desdeCache, eventos }` (tarda ~30–60 s).

1. `manuales.ts`: caché en Supabase (tabla `manuales`, migración `lib/supabase/migraciones/003_manuales.sql`). Si el modelo ya tiene un manual verificado, se reusa. Nadie la carga a mano.
2. Si no está, `buscar.ts` (bibliotecario) es un agente con `web_search`, `web_fetch` y `probar_pdf`: el código baja cada URL candidata y verifica que sea un PDF real; solo se acepta una URL verificada.
3. El PDF se sube a la Files API (`fileId`, sirve para A4).
4. `armar.ts` lo lee con **citas de la API** (texto literal + página). Paso con cita de página = `VERIFICADO`; sin cita = sin `cita` (mostrar NO VERIFICADO). Números de parte solo si aparecen en el texto citado. El riesgo pasa por `lib/safety`.
5. Se guarda el manual en la caché con las páginas de la vista explosionada (líneas `VISTA`) y `verificado`.
6. Sin manual: guía pública con búsqueda web, `verificado: false`, y no se guarda como manual.

Packs: caché en memoria por modelo + síntoma (`CachePacks`). Manuales: Supabase; si las claves o la tabla no están, memoria.
Umbrales y límites: `LIMITES` en `lib/ia/claude.ts`.

Prueba real: `npx tsx --env-file=.env.local lib/knowledge/probar-pack.ts "Lenovo" "ThinkPad E14 Gen 2" "se apaga sola"` (~1 USD por manual).
