# lib/knowledge

Dueño: Juanma

Armado y caché del knowledge pack; verificación de citas; vistas del manual para el cartógrafo.
Ruta: `POST /api/knowledge { ficha, sintoma }` → `{ pack, manualUrl, manualFileId, paginasVistaExplosionada, paginaVistaInterior, desdeCache, eventos }` (tarda ~30–60 s; más si hay que buscar el manual).

1. `manuales.ts`: caché en Supabase (tabla `manuales`, migración `lib/supabase/migraciones/003_manuales.sql`). Si el modelo ya tiene un manual verificado, se reusa con sus vistas. Nadie la carga a mano.
2. Si no está, `buscar.ts` (bibliotecario) es un agente con `web_search`, `web_fetch` y `probar_pdf`: el código baja cada URL candidata y verifica que sea un PDF real; solo se acepta una URL verificada.
3. **Extracto** (`extracto.ts`): a la IA nunca se le manda el PDF entero. El código lee los marcadores del PDF (y el inicio del texto de las primeras páginas), Haiku elige hasta 14 páginas (índice, vista explosionada, vista interior y sección del síntoma) y el código las recorta en un PDF chico que se sube a la Files API (`fileId`, lo leen A4 y /api/plano). El nombre del archivo (`extracto_3-4-51-73.pdf`) guarda qué páginas del manual completo tiene. Costo medido (E14 Gen 2): elegir páginas US$ 0,0003 + leer 13 páginas con Sonnet US$ 0,156 (antes ~0,62 con el manual entero).
4. `armar.ts` lee el extracto con **citas de la API** y traduce cada página citada a la del manual completo (texto literal + página). Paso con cita de página = `VERIFICADO`; sin cita = sin `cita` (mostrar NO VERIFICADO). Números de parte solo si aparecen en el texto citado. El riesgo pasa por `lib/safety`.
5. En esa misma lectura se ubican las **vistas** (líneas `VISTA|explosionada|…` y `VISTA|interior|…`). Si la lectura no marca alguna, queda la que eligió Haiku para el extracto. **Parte fija para la caché de prompts:** `prefijoManual(m)` en `lector.ts` (modelo, effort, system y bloque del extracto con citas); otra lectura del mismo extracto que empiece igual sale de la caché.
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
