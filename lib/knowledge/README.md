# lib/knowledge

Dueño: Juanma

Armado y caché del knowledge pack; verificación de citas. Ruta: `POST /api/knowledge { ficha, sintoma }` → `{ pack, manualUrl, desdeCache, eventos }` (tarda ~30–60 s).

1. `manuales.ts`: manuales oficiales conocidos (URL verificada a mano). **Agregar acá las notebooks de la demo.**
2. Si no está, `buscar.ts` busca en la web (Sonnet + web_search).
3. `descargar.ts` baja el PDF y verifica que sea PDF real; se sube a la Files API (`fileId`, sirve para A4).
4. `armar.ts` lo lee con **citas de la API** (texto literal + página). Paso con cita de página = `VERIFICADO`; sin cita = sin `cita` (mostrar NO VERIFICADO). Números de parte solo si aparecen en el texto citado. El riesgo pasa por `lib/safety`.
5. Sin manual: guía pública con búsqueda web, `verificado: false`.

Caché en memoria por modelo + síntoma (`CachePacks`); se cambia por Supabase cuando exista `lib/supabase`.

Prueba real: `npx tsx --env-file=.env.local lib/knowledge/probar-pack.ts "Lenovo" "ThinkPad E14 Gen 2" "se apaga sola"` (~1 USD por manual).
