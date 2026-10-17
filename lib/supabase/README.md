# lib/supabase

Dueño: Iaio

Cliente, esquema y migraciones de Supabase.

- `migraciones/001_base.sql`: tablas `casos`, `fotos`, `fichas`, `eventos`, `knowledge_packs` y bucket público `fotos`. Se corre a mano en el SQL Editor del proyecto.
- `cliente.ts`: `supabaseServidor()` (clave secreta, solo en rutas de API) y `supabaseNavegador()` (clave pública, solo lee `eventos`). Si faltan variables devuelven `null` y nada se guarda: Supabase nunca frena la demo.
- `repo.ts`: `guardarCaso`, `guardarFoto`, `subirImagen`, `guardarFicha`, `guardarEventos`, `listarEventos`. Todo pasa por los esquemas de `shared/`.
- Escritura desde las pantallas: `POST /api/casos { caso?, fotos?: [{ foto, imagen? }], ficha?, eventos? }`, que llaman en segundo plano desde `app/(screens)/_estado/flujo.tsx`.

**Para el carril A:** la caché del knowledge pack en Supabase se pasa así:

```ts
import { supabaseServidor } from "@/lib/supabase/cliente";
import { cachePacksSupabase } from "@/lib/supabase/repo";

armarPack(entrada, { cache: cachePacksSupabase<Armado>(supabaseServidor()) });
```
