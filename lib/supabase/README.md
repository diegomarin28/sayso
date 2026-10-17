# lib/supabase

Dueño: Iaio

Cliente, esquema y migraciones de Supabase.

- `migraciones/`: una sola carpeta para todos los carriles, numeradas en orden. Se aplican a mano en Supabase (**SQL Editor → New query → pegar → Run**), en orden, y se guarda la query con el nombre del archivo.

  | Archivo | Carril | Qué hace | ¿Aplicada? |
  |---|---|---|---|
  | `001_base.sql` | C | tablas `casos`, `fotos`, `fichas`, `eventos`, `knowledge_packs` y bucket `fotos` | sí |
  | `002_rls.sql` | C | permisos: el navegador solo lee `eventos` | sí |
  | `003_manuales.sql` | A | tabla `manuales`: caché de manuales del bibliotecario (solo servidor) | sí |
  | `004_planos.sql` | B | tabla `planos`: caché del plano 3D por marca + modelo (solo servidor) | sí |
  | `005_manuales_vista_interior.sql` | A | columna `pagina_vista_interior` en `manuales` (para /api/plano) | sí |
  | `006_gasto_ia.sql` | B | tabla `gasto_ia` y función `sumar_gasto_ia`: gasto diario de IA para el freno (solo servidor) | sí |

  Para una migración nueva: siguiente número (`007_…`), sumarla a esta tabla y avisar para que alguien la corra.
- `cliente.ts`: `supabaseServidor()` (clave secreta, solo en rutas de API) y `supabaseNavegador()` (clave pública, solo lee `eventos`). Si faltan variables devuelven `null` y nada se guarda: Supabase nunca frena la demo.
- `repo.ts`: `guardarCaso`, `guardarFoto`, `subirImagen`, `guardarFicha`, `guardarEventos`, `listarEventos`. Todo pasa por los esquemas de `shared/`.
- Escritura desde las pantallas: `POST /api/casos { caso?, fotos?: [{ foto, imagen? }], ficha?, eventos? }`, que llaman en segundo plano desde `app/(screens)/_estado/flujo.tsx`.

**Para el carril A:** la caché del knowledge pack en Supabase se pasa así:

```ts
import { supabaseServidor } from "@/lib/supabase/cliente";
import { cachePacksSupabase } from "@/lib/supabase/repo";

armarKnowledgePack(entrada, { cache: cachePacksSupabase<Armado>(supabaseServidor()) });
```
