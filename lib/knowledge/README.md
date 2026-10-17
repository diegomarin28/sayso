# lib/knowledge

Dueño: Juanma

Armado y caché del knowledge pack; verificación de citas; vistas del manual para el cartógrafo.
Ruta: `POST /api/knowledge { ficha, sintoma }` → `{ pack, manualUrl, manualFileId, paginasVistaExplosionada, paginaVistaInterior, desdeCache, eventos }` (tarda ~30–60 s; más si hay que buscar el manual).

1. `manuales.ts`: caché en Supabase (tabla `manuales`, migración `lib/supabase/migraciones/003_manuales.sql`). Si el modelo ya tiene un manual verificado, se reusa con sus vistas. Nadie la carga a mano.
2. Si no está, `buscar.ts` (bibliotecario) es un agente con `web_search`, `web_fetch` y `probar_pdf`: el código baja cada URL candidata y verifica que sea un PDF real; solo se acepta una URL verificada.
3. El PDF se sube a la Files API (`fileId`, sirve para A4).
4. `armar.ts` lo lee con **citas de la API** (texto literal + página). Paso con cita de página = `VERIFICADO`; sin cita = sin `cita` (mostrar NO VERIFICADO). Números de parte solo si aparecen en el texto citado. El riesgo pasa por `lib/safety`.
5. En esa misma lectura se ubican las **vistas** (líneas `VISTA|explosionada|…` y `VISTA|interior|…`). Si falta alguna, `vistas.ts` la busca sola reusando el manual de la caché de prompts (`lector.ts`: todas las lecturas comparten modelo, system, effort y documento).
6. Se guarda el manual en la caché con sus vistas y `verificado` (un manual verificado no pierde la marca).
7. Sin manual: guía pública con búsqueda web, `verificado: false`, sin vistas, y no se guarda como manual.

## Vistas (para `/api/plano`)

`/api/knowledge` devuelve `paginasVistaExplosionada` (lista con la vista explosionada general, o vacía) y `paginaVistaInterior` (número o `null`). Se pasan tal cual a `/api/plano` junto con `manualFileId`:

- **explosionada:** la vista explosionada general (piezas separadas y numeradas). Sirve para saber qué pieza es cada número.
- **interior:** el interior completo con el equipo abierto (en una notebook: dada vuelta y sin la tapa inferior, como en la página del ventilador). Sirve para ubicar las piezas.
- Son páginas **físicas** del PDF (1 = primera hoja; la misma numeración que `gs -dFirstPage`), tomadas de la cita de la API, no del número impreso en la hoja (en el HMM de la E14 Gen 2 la hoja impresa "45" es la física 51).
- En la tabla `manuales`: columnas `paginas_vista_explosionada` (lista) y `pagina_vista_interior`. Si la migración de la vista interior todavía no se aplicó, el manual se guarda sin ella y las vistas se vuelven a ubicar en la próxima lectura (sin costo extra: van en la misma lectura del pack).

Packs: caché por modelo + síntoma (`CachePacks`). Manuales: Supabase; si las claves o la tabla no están, memoria.
Umbrales y límites: `LIMITES` en `lib/ia/claude.ts`.

Prueba real: `npx tsx --env-file=.env.local lib/knowledge/probar-pack.ts "Lenovo" "ThinkPad E14 Gen 2" "se apaga sola"` (~1 USD por manual nuevo; con el manual en caché, menos).
